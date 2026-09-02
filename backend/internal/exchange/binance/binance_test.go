package binance

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
)

var (
	btc = domain.Pair{Base: "BTC", Quote: "USDT"}
	eth = domain.Pair{Base: "ETH", Quote: "USDT"}
	now = time.Date(2026, 9, 2, 12, 0, 0, 0, time.UTC)
)

// Binance の Partial Book Depth（combined stream）の実際の形式に沿ったサンプル。
const sampleDepth = `{"stream":"btcusdt@depth20@100ms","data":{"lastUpdateId":160,"bids":[["65433.79","0.52000000"],["65433.00","1.20000000"]],"asks":[["65433.80","0.30000000"],["65434.10","0.00000000"],["65435.00","2.00000000"]]}}`

func TestSymbolAndStreamURL(t *testing.T) {
	t.Parallel()
	if got := Symbol(btc); got != "BTCUSDT" {
		t.Fatalf("Symbol=%s", got)
	}
	want := "wss://stream.binance.com:9443/stream?streams=btcusdt@depth20@100ms/ethusdt@depth20@100ms"
	if got := StreamURL(DefaultURL, []domain.Pair{btc, eth}); got != want {
		t.Fatalf("StreamURL=%s", got)
	}
}

func TestParseMessage(t *testing.T) {
	t.Parallel()
	streams := map[string]domain.Pair{"btcusdt@depth20@100ms": btc}

	t.Run("板メッセージを OrderBook に変換する", func(t *testing.T) {
		t.Parallel()
		book, ok, err := parseMessage([]byte(sampleDepth), streams, now)
		if err != nil || !ok {
			t.Fatalf("err=%v ok=%v", err, ok)
		}
		if book.Exchange != ID || book.Pair != btc || !book.ReceivedAt.Equal(now) {
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
	})

	t.Run("stream の無いメッセージは無視する", func(t *testing.T) {
		t.Parallel()
		_, ok, err := parseMessage([]byte(`{"result":null,"id":1}`), streams, now)
		if err != nil || ok {
			t.Fatalf("err=%v ok=%v", err, ok)
		}
	})

	t.Run("未知のストリームはエラー", func(t *testing.T) {
		t.Parallel()
		msg := strings.Replace(sampleDepth, "btcusdt", "solusdt", 1)
		if _, _, err := parseMessage([]byte(msg), streams, now); err == nil {
			t.Fatal("エラーを期待した")
		}
	})

	t.Run("壊れた JSON はエラー", func(t *testing.T) {
		t.Parallel()
		if _, _, err := parseMessage([]byte(`{"stream":`), streams, now); err == nil {
			t.Fatal("エラーを期待した")
		}
	})

	t.Run("数値でない価格はエラー", func(t *testing.T) {
		t.Parallel()
		msg := strings.Replace(sampleDepth, `"65433.79"`, `"abc"`, 1)
		if _, _, err := parseMessage([]byte(msg), streams, now); err == nil {
			t.Fatal("エラーを期待した")
		}
	})
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

func TestFeed_DeliversBooksFromServer(t *testing.T) {
	t.Parallel()
	var requestedPath string
	upgrader := websocket.Upgrader{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestedPath = r.URL.RequestURI()
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		_ = conn.WriteMessage(websocket.TextMessage, []byte(sampleDepth))
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}))
	defer srv.Close()

	sink := newRecordingSink()
	feed := NewFeed(exchange.FeedConfig{
		URL:   "ws" + strings.TrimPrefix(srv.URL, "http") + "/stream",
		Pairs: []domain.Pair{btc, eth},
		Sink:  sink,
		Now:   func() time.Time { return now },
	})
	if feed.Exchange() != ID {
		t.Fatalf("Exchange=%s", feed.Exchange())
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go feed.Run(ctx)

	select {
	case <-sink.gotBook:
	case <-time.After(3 * time.Second):
		t.Fatal("板が届かない")
	}
	if requestedPath != "/stream?streams=btcusdt@depth20@100ms/ethusdt@depth20@100ms" {
		t.Fatalf("購読 URL が不正: %s", requestedPath)
	}
	sink.mu.Lock()
	defer sink.mu.Unlock()
	if len(sink.books) != 1 || sink.books[0].Pair != btc {
		t.Fatalf("books=%+v", sink.books)
	}
	if len(sink.statuses) == 0 || !sink.statuses[0] {
		t.Fatalf("接続状態が通知されるはず: %v", sink.statuses)
	}
}
