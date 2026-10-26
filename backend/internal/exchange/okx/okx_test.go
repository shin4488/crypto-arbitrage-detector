package okx_test

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange/okx"
)

var (
	btc = domain.Pair{Base: "BTC", Quote: "USDT"}
	eth = domain.Pair{Base: "ETH", Quote: "USDT"}
	now = time.Date(2026, 9, 2, 12, 0, 0, 0, time.UTC)
)

// OKX books5 チャネルの実際の形式に沿ったサンプル（各段は4要素）。
const sampleBooks = `{"arg":{"channel":"books5","instId":"BTC-USDT"},"data":[{"asks":[["65436.9","0.8","0","3"],["65437.0","0","0","0"],["65438.5","1.5","0","2"]],"bids":[["65436.8","0.3","0","1"],["65436.0","2.1","0","4"]],"ts":"1756814400000","seqId":123}]}`

// ethBooks は正しい板。読み飛ばすべきメッセージの後に送り、受信が続いていることを確かめるのに使う。
const ethBooks = `{"arg":{"channel":"books5","instId":"ETH-USDT"},"data":[{"asks":[["2500.2","4","0","1"]],"bids":[["2500.1","3","0","1"]],"ts":"1756814400000","seqId":7}]}`

func TestInstIDAndSubscribeRequest(t *testing.T) {
	t.Parallel()
	if got := okx.InstID(btc); got != "BTC-USDT" {
		t.Fatalf("InstID=%s", got)
	}
	body, err := okx.SubscribeRequest([]domain.Pair{btc, eth})
	if err != nil {
		t.Fatal(err)
	}
	want := `{"op":"subscribe","args":[{"channel":"books5","instId":"BTC-USDT"},{"channel":"books5","instId":"ETH-USDT"}]}`
	if string(body) != want {
		t.Fatalf("got=%s", body)
	}
}

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

// logRecorder はフィードが出力したログを記録する。
type logRecorder struct {
	mu      sync.Mutex
	records []slog.Record
}

func (h *logRecorder) Enabled(context.Context, slog.Level) bool { return true }

func (h *logRecorder) Handle(_ context.Context, r slog.Record) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.records = append(h.records, r.Clone())
	return nil
}

func (h *logRecorder) WithAttrs([]slog.Attr) slog.Handler { return h }
func (h *logRecorder) WithGroup(string) slog.Handler      { return h }

// hasRecord は level のログのうち、属性 key が value のものがあるかを返す。
func (h *logRecorder) hasRecord(level slog.Level, key, value string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, r := range h.records {
		if r.Level != level {
			continue
		}
		found := false
		r.Attrs(func(a slog.Attr) bool {
			found = a.Key == key && a.Value.String() == value
			return !found
		})
		if found {
			return true
		}
	}
	return false
}

// fakeOKX は購読リクエストを受け取ってから messages を順に送り、その後は接続を保つ OKX 互換のサーバー。
// 戻り値は接続先の URL と、受け取った購読リクエストを受け取るチャネル。
func fakeOKX(t *testing.T, messages ...string) (string, <-chan string) {
	t.Helper()
	subscribed := make(chan string, 10)
	upgrader := websocket.Upgrader{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return
		}
		subscribed <- string(msg)
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
	return "ws" + strings.TrimPrefix(srv.URL, "http"), subscribed
}

// startFeed は BTC/USDT と ETH/USDT を購読するフィードを url へ接続させる。テストの終了時に停止を待つ。
func startFeed(t *testing.T, url string, logger *slog.Logger) *recordingSink {
	t.Helper()
	sink := newRecordingSink()
	feed := okx.NewFeed(exchange.FeedConfig{
		URL:    url,
		Pairs:  []domain.Pair{btc, eth},
		Sink:   sink,
		Logger: logger,
		Now:    func() time.Time { return now },
	})
	if feed.Exchange() != okx.ID {
		t.Fatalf("Exchange=%s", feed.Exchange())
	}
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
	return sink
}

func TestFeed_SubscribesAndDeliversBooks(t *testing.T) {
	t.Parallel()
	url, subscribed := fakeOKX(t, sampleBooks)
	sink := startFeed(t, url, slog.New(slog.DiscardHandler))

	books, statuses := sink.waitBooks(t, 1)
	if got := <-subscribed; !strings.Contains(got, `"instId":"BTC-USDT"`) || !strings.Contains(got, `"instId":"ETH-USDT"`) {
		t.Fatalf("購読内容が不正: %s", got)
	}
	if len(statuses) == 0 || !statuses[0] {
		t.Fatalf("接続状態が通知されるはず: %v", statuses)
	}
	if len(books) != 1 {
		t.Fatalf("books=%+v", books)
	}
	book := books[0]
	if book.Exchange != okx.ID || book.Pair != btc || !book.ReceivedAt.Equal(now) {
		t.Fatalf("book=%+v", book)
	}
	// 数量 0 の段は除外される
	if len(book.Asks) != 2 || book.Asks[0].Price.String() != "65436.9" || book.Asks[0].Quantity.String() != "0.8" {
		t.Fatalf("asks=%+v", book.Asks)
	}
	if len(book.Bids) != 2 || book.Bids[1].Price.String() != "65436" {
		t.Fatalf("bids=%+v", book.Bids)
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
		{"pong", "pong"},
		{"購読応答", `{"event":"subscribe","arg":{"channel":"books5","instId":"BTC-USDT"},"connId":"abc"}`},
		{"購読していない instId", strings.Replace(sampleBooks, "BTC-USDT", "SOL-USDT", 1)},
		{"壊れた JSON", `{"arg":`},
	}
	for _, tt := range tests {
		t.Run(tt.name+"は板として渡さず、接続を保って次の板を受け取る", func(t *testing.T) {
			t.Parallel()
			url, _ := fakeOKX(t, tt.msg, ethBooks)
			sink := startFeed(t, url, slog.New(slog.DiscardHandler))

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

func TestFeed_LogsRejectedSubscriptionAndKeepsConnection(t *testing.T) {
	t.Parallel()
	url, _ := fakeOKX(t, `{"event":"error","code":"60012","msg":"Invalid request","connId":"abc"}`, ethBooks)
	logs := &logRecorder{}
	sink := startFeed(t, url, slog.New(logs))

	books, statuses := sink.waitBooks(t, 1)
	// 購読の拒否は設定の誤りなどが原因でつなぎ直しても直らないため、理由のコードをエラーとして残す
	if !logs.hasRecord(slog.LevelError, "code", "60012") {
		t.Fatal("拒否の理由がエラーログに残るはず")
	}
	if len(books) != 1 || books[0].Pair != eth {
		t.Fatalf("拒否の後も届いた板は渡すはず: %+v", books)
	}
	if len(statuses) != 1 || !statuses[0] {
		t.Fatalf("接続は維持されるはず: %v", statuses)
	}
}
