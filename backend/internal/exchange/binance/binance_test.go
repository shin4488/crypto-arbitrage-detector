package binance_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange/binance"
)

var (
	btc = domain.Pair{Base: "BTC", Quote: "USDT"}
	eth = domain.Pair{Base: "ETH", Quote: "USDT"}
	now = time.Date(2026, 9, 2, 12, 0, 0, 0, time.UTC)
)

// Binance の Partial Book Depth（combined stream）の実際の形式に沿ったサンプル。
const sampleDepth = `{"stream":"btcusdt@depth20@100ms","data":{"lastUpdateId":160,"bids":[["65433.79","0.52000000"],["65433.00","1.20000000"]],"asks":[["65433.80","0.30000000"],["65434.10","0.00000000"],["65435.00","2.00000000"]]}}`

// ethDepth は正しい板。読み飛ばすべきメッセージの後に送り、受信が続いていることを確かめるのに使う。
const ethDepth = `{"stream":"ethusdt@depth20@100ms","data":{"lastUpdateId":7,"bids":[["2500.1","3"]],"asks":[["2500.2","4"]]}}`

func TestSymbolAndStreamURL(t *testing.T) {
	t.Parallel()
	if got := binance.Symbol(btc); got != "BTCUSDT" {
		t.Fatalf("Symbol=%s", got)
	}
	want := "wss://stream.binance.com:9443/stream?streams=btcusdt@depth20@100ms/ethusdt@depth20@100ms"
	if got := binance.StreamURL(binance.DefaultURL, []domain.Pair{btc, eth}); got != want {
		t.Fatalf("StreamURL=%s", got)
	}
}

// recordingSink はフィードから渡された板と接続状態を記録する。
type recordingSink struct {
	mu       sync.Mutex
	books    []domain.OrderBook
	statuses []bool
	gotBook  chan struct{}
}

func newRecordingSink() *recordingSink { return &recordingSink{gotBook: make(chan struct{}, 100)} }

func (s *recordingSink) UpdateBook(b domain.OrderBook) error {
	s.mu.Lock()
	s.books = append(s.books, b)
	s.mu.Unlock()
	s.gotBook <- struct{}{}
	return nil
}

func (s *recordingSink) SetConnected(_ domain.Exchange, connected bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.statuses = append(s.statuses, connected)
}

// waitBooks は板が n 件届くまで待ち、届いた板と接続状態の記録を返す。
func (s *recordingSink) waitBooks(t *testing.T, n int) ([]domain.OrderBook, []bool) {
	t.Helper()
	for range n {
		select {
		case <-s.gotBook:
		case <-time.After(3 * time.Second):
			t.Fatal("板が届かない")
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]domain.OrderBook(nil), s.books...), append([]bool(nil), s.statuses...)
}

// fakeBinance は接続してきたフィードへ messages を順に送り、その後は接続を保つ Binance 互換のサーバー。
// 戻り値は接続先の URL と、フィードが要求したパス（購読するストリームを含む）を受け取るチャネル。
func fakeBinance(t *testing.T, messages ...string) (string, <-chan string) {
	t.Helper()
	requested := make(chan string, 10)
	upgrader := websocket.Upgrader{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requested <- r.URL.RequestURI()
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		for _, m := range messages {
			_ = conn.WriteMessage(websocket.TextMessage, []byte(m))
		}
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}))
	t.Cleanup(srv.Close)
	return "ws" + strings.TrimPrefix(srv.URL, "http") + "/stream", requested
}

// startFeed は BTC/USDT と ETH/USDT を購読するフィードを url へ接続させる。テストの終了時に停止を待つ。
func startFeed(t *testing.T, url string) (*binance.Feed, *recordingSink) {
	t.Helper()
	sink := newRecordingSink()
	feed := binance.NewFeed(exchange.FeedConfig{
		URL:   url,
		Pairs: []domain.Pair{btc, eth},
		Sink:  sink,
		Now:   func() time.Time { return now },
	})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		feed.Run(ctx)
		close(done)
	}()
	t.Cleanup(func() {
		cancel()
		<-done
	})
	return feed, sink
}

func TestFeed_DeliversBooksFromServer(t *testing.T) {
	t.Parallel()
	url, requested := fakeBinance(t, sampleDepth)
	feed, sink := startFeed(t, url)
	if feed.Exchange() != binance.ID {
		t.Fatalf("Exchange=%s", feed.Exchange())
	}

	books, statuses := sink.waitBooks(t, 1)
	if got := <-requested; got != "/stream?streams=btcusdt@depth20@100ms/ethusdt@depth20@100ms" {
		t.Fatalf("購読 URL が不正: %s", got)
	}
	if len(statuses) == 0 || !statuses[0] {
		t.Fatalf("接続状態が通知されるはず: %v", statuses)
	}
	if len(books) != 1 {
		t.Fatalf("books=%+v", books)
	}
	book := books[0]
	if book.Exchange != binance.ID || book.Pair != btc || !book.ReceivedAt.Equal(now) {
		t.Fatalf("book=%+v", book)
	}
	if len(book.Bids) != 2 || book.Bids[0].Price.String() != "65433.79" || book.Bids[0].Quantity.String() != "0.52" {
		t.Fatalf("bids=%+v", book.Bids)
	}
	// 数量 0 の段は除外される
	if len(book.Asks) != 2 || book.Asks[1].Price.String() != "65435" {
		t.Fatalf("asks=%+v", book.Asks)
	}
	if err := book.Validate(); err != nil {
		t.Fatalf("変換結果はエンジンに渡せる形のはず: %v", err)
	}
}

func TestFeed_SkipsMessagesThatAreNotBooks(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		msg  string
	}{
		{"stream の無いメッセージ（購読応答など）", `{"result":null,"id":1}`},
		{"購読していないストリーム", strings.Replace(sampleDepth, "btcusdt", "solusdt", 1)},
		{"壊れた JSON", `{"stream":`},
		{"数値でない価格", strings.Replace(sampleDepth, `"65433.79"`, `"abc"`, 1)},
	}
	for _, tt := range tests {
		t.Run(tt.name+"は板として渡さず、接続を保って次の板を受け取る", func(t *testing.T) {
			t.Parallel()
			url, _ := fakeBinance(t, tt.msg, ethDepth)
			_, sink := startFeed(t, url)

			books, statuses := sink.waitBooks(t, 1)
			if len(books) != 1 || books[0].Pair != eth || books[0].Bids[0].Price.String() != "2500.1" {
				t.Fatalf("後に届いた ETH/USDT の板だけが渡るはず: %+v", books)
			}
			if len(statuses) != 1 || !statuses[0] {
				t.Fatalf("接続は維持されるはず: %v", statuses)
			}
		})
	}
}
