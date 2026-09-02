package okx

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
)

var (
	btc = domain.Pair{Base: "BTC", Quote: "USDT"}
	eth = domain.Pair{Base: "ETH", Quote: "USDT"}
	now = time.Date(2026, 9, 2, 12, 0, 0, 0, time.UTC)
)

// OKX books5 チャネルの実際の形式に沿ったサンプル（各段は4要素）。
const sampleBooks = `{"arg":{"channel":"books5","instId":"BTC-USDT"},"data":[{"asks":[["65436.9","0.8","0","3"],["65437.0","0","0","0"],["65438.5","1.5","0","2"]],"bids":[["65436.8","0.3","0","1"],["65436.0","2.1","0","4"]],"ts":"1756814400000","seqId":123}]}`

func TestInstIDAndSubscribeRequest(t *testing.T) {
	t.Parallel()
	if got := InstID(btc); got != "BTC-USDT" {
		t.Fatalf("InstID=%s", got)
	}
	body, err := SubscribeRequest([]domain.Pair{btc, eth})
	if err != nil {
		t.Fatal(err)
	}
	want := `{"op":"subscribe","args":[{"channel":"books5","instId":"BTC-USDT"},{"channel":"books5","instId":"ETH-USDT"}]}`
	if string(body) != want {
		t.Fatalf("got=%s", body)
	}
}

func TestParseMessage(t *testing.T) {
	t.Parallel()
	insts := map[string]domain.Pair{"BTC-USDT": btc}

	t.Run("板メッセージを OrderBook に変換する", func(t *testing.T) {
		t.Parallel()
		book, ok, err := parseMessage([]byte(sampleBooks), insts, now)
		if err != nil || !ok {
			t.Fatalf("err=%v ok=%v", err, ok)
		}
		if book.Exchange != ID || book.Pair != btc || !book.ReceivedAt.Equal(now) {
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
	})

	t.Run("pong は無視する", func(t *testing.T) {
		t.Parallel()
		if _, ok, err := parseMessage([]byte("pong"), insts, now); err != nil || ok {
			t.Fatalf("err=%v ok=%v", err, ok)
		}
	})

	t.Run("購読応答は無視する", func(t *testing.T) {
		t.Parallel()
		raw := `{"event":"subscribe","arg":{"channel":"books5","instId":"BTC-USDT"},"connId":"abc"}`
		if _, ok, err := parseMessage([]byte(raw), insts, now); err != nil || ok {
			t.Fatalf("err=%v ok=%v", err, ok)
		}
	})

	t.Run("エラーイベントは購読エラーとして返す", func(t *testing.T) {
		t.Parallel()
		raw := `{"event":"error","code":"60012","msg":"Invalid request","connId":"abc"}`
		_, _, err := parseMessage([]byte(raw), insts, now)
		var subErr *subscriptionError
		if !asSubscriptionError(err, &subErr) || subErr.code != "60012" {
			t.Fatalf("err=%v", err)
		}
	})

	t.Run("未知の instId はエラー", func(t *testing.T) {
		t.Parallel()
		raw := strings.Replace(sampleBooks, "BTC-USDT", "SOL-USDT", 1)
		if _, _, err := parseMessage([]byte(raw), insts, now); err == nil {
			t.Fatal("エラーを期待した")
		}
	})

	t.Run("壊れた JSON はエラー", func(t *testing.T) {
		t.Parallel()
		if _, _, err := parseMessage([]byte(`{"arg":`), insts, now); err == nil {
			t.Fatal("エラーを期待した")
		}
	})
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

func TestFeed_SubscribesAndDeliversBooks(t *testing.T) {
	t.Parallel()
	subscribed := make(chan string, 1)
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
		_ = conn.WriteMessage(websocket.TextMessage, []byte(`{"event":"subscribe","arg":{"channel":"books5","instId":"BTC-USDT"}}`))
		_ = conn.WriteMessage(websocket.TextMessage, []byte(`{"event":"error","code":"60012","msg":"Invalid request"}`))
		_ = conn.WriteMessage(websocket.TextMessage, []byte(sampleBooks))
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}))
	defer srv.Close()

	sink := newRecordingSink()
	feed := NewFeed(exchange.FeedConfig{
		URL:    "ws" + strings.TrimPrefix(srv.URL, "http"),
		Pairs:  []domain.Pair{btc, eth},
		Sink:   sink,
		Logger: slog.New(slog.DiscardHandler),
		Now:    func() time.Time { return now },
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go feed.Run(ctx)

	select {
	case got := <-subscribed:
		if !strings.Contains(got, `"instId":"BTC-USDT"`) || !strings.Contains(got, `"instId":"ETH-USDT"`) {
			t.Fatalf("購読内容が不正: %s", got)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("購読が届かない")
	}
	select {
	case <-sink.gotBook:
	case <-time.After(3 * time.Second):
		t.Fatal("板が届かない")
	}
	sink.mu.Lock()
	defer sink.mu.Unlock()
	if len(sink.books) != 1 || sink.books[0].Pair != btc {
		t.Fatalf("books=%+v", sink.books)
	}
	// エラーイベントを受けても切断はしない
	if len(sink.statuses) != 1 || !sink.statuses[0] {
		t.Fatalf("接続は維持されるはず: %v", sink.statuses)
	}
}
