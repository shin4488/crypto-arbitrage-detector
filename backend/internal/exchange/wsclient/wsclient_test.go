package wsclient_test

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange/wsclient"
)

// echoServer はテスト用の WebSocket サーバー。接続ごとに handler を呼ぶ。
type echoServer struct {
	srv      *httptest.Server
	upgrader websocket.Upgrader
	mu       sync.Mutex
	conns    []*websocket.Conn
	accepted atomic.Int32
}

func newEchoServer(t *testing.T, handler func(conn *websocket.Conn)) *echoServer {
	t.Helper()
	s := &echoServer{}
	s.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := s.upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		s.accepted.Add(1)
		s.mu.Lock()
		s.conns = append(s.conns, conn)
		s.mu.Unlock()
		handler(conn)
	}))
	t.Cleanup(s.srv.Close)
	return s
}

func (s *echoServer) url() string { return "ws" + strings.TrimPrefix(s.srv.URL, "http") }

func (s *echoServer) closeAll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range s.conns {
		_ = c.Close()
	}
	s.conns = nil
}

// statusLog は OnStatus の呼び出しを記録する。
type statusLog struct {
	mu   sync.Mutex
	log  []bool
	cond chan struct{}
}

func newStatusLog() *statusLog { return &statusLog{cond: make(chan struct{}, 100)} }

func (s *statusLog) record(connected bool) {
	s.mu.Lock()
	s.log = append(s.log, connected)
	s.mu.Unlock()
	s.cond <- struct{}{}
}

func (s *statusLog) snapshot() []bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]bool(nil), s.log...)
}

func (s *statusLog) waitFor(t *testing.T, want []bool) {
	t.Helper()
	deadline := time.After(3 * time.Second)
	for {
		got := s.snapshot()
		if len(got) >= len(want) && equalPrefix(got, want) {
			return
		}
		select {
		case <-s.cond:
		case <-deadline:
			t.Fatalf("状態の遷移が期待と違う: got=%v want=%v", got, want)
		}
	}
}

func equalPrefix(got, want []bool) bool {
	for i := range want {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}

func fastOptions(url string) wsclient.Options {
	return wsclient.Options{
		Name:              "test",
		URL:               url,
		KeepAliveInterval: 10 * time.Millisecond,
		ReadTimeout:       500 * time.Millisecond,
		MinBackoff:        10 * time.Millisecond,
		MaxBackoff:        40 * time.Millisecond,
	}
}

func TestRun_ConnectsSubscribesAndReceives(t *testing.T) {
	t.Parallel()
	subscribed := make(chan string, 1)
	srv := newEchoServer(t, func(conn *websocket.Conn) {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return
		}
		subscribed <- string(msg)
		_ = conn.WriteMessage(websocket.TextMessage, []byte(`{"hello":"world"}`))
		select {} // 接続を維持
	})

	received := make(chan string, 1)
	statuses := newStatusLog()
	opts := fastOptions(srv.url())
	opts.Subscribe = func(_ context.Context, conn *websocket.Conn) error {
		return conn.WriteMessage(websocket.TextMessage, []byte(`{"op":"subscribe"}`))
	}
	opts.OnMessage = func(msg []byte) error {
		received <- string(msg)
		return nil
	}
	opts.OnStatus = statuses.record

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		wsclient.Run(ctx, opts)
		close(done)
	}()

	select {
	case got := <-subscribed:
		if got != `{"op":"subscribe"}` {
			t.Fatalf("購読メッセージが不正: %s", got)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("購読メッセージが届かない")
	}
	select {
	case got := <-received:
		if got != `{"hello":"world"}` {
			t.Fatalf("受信内容が不正: %s", got)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("メッセージが届かない")
	}
	statuses.waitFor(t, []bool{true})

	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("ctx 終了で Run が戻るはず")
	}
	statuses.waitFor(t, []bool{true, false})
}

func TestRun_ReconnectsAfterServerCloses(t *testing.T) {
	t.Parallel()
	srv := newEchoServer(t, func(conn *websocket.Conn) {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	})
	statuses := newStatusLog()
	opts := fastOptions(srv.url())
	opts.OnStatus = statuses.record

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go wsclient.Run(ctx, opts)

	statuses.waitFor(t, []bool{true})
	srv.closeAll()
	statuses.waitFor(t, []bool{true, false, true})
	if srv.accepted.Load() < 2 {
		t.Fatalf("再接続されているはず: %d", srv.accepted.Load())
	}
}

func TestRun_ReconnectsOnReadTimeout(t *testing.T) {
	t.Parallel()
	// 何も送らないサーバー。ReadTimeout で切断→再接続されるはず。
	srv := newEchoServer(t, func(conn *websocket.Conn) {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	})
	statuses := newStatusLog()
	opts := fastOptions(srv.url())
	opts.ReadTimeout = 50 * time.Millisecond
	// ping フレームで ReadTimeout が延びないよう keep-alive を無効化する（pong は ReadMessage に届かない）
	opts.KeepAlive = func(*websocket.Conn) error { return nil }
	opts.OnStatus = statuses.record

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go wsclient.Run(ctx, opts)

	statuses.waitFor(t, []bool{true, false, true})
}

func TestRun_ReconnectsWhenHandlerAsksTo(t *testing.T) {
	t.Parallel()
	srv := newEchoServer(t, func(conn *websocket.Conn) {
		_ = conn.WriteMessage(websocket.TextMessage, []byte(`{"event":"error"}`))
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	})
	statuses := newStatusLog()
	opts := fastOptions(srv.url())
	opts.OnMessage = func([]byte) error { return wsclient.ErrReconnect }
	opts.OnStatus = statuses.record

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go wsclient.Run(ctx, opts)

	statuses.waitFor(t, []bool{true, false, true})
}

func TestRun_HandlerErrorsDoNotDisconnect(t *testing.T) {
	t.Parallel()
	srv := newEchoServer(t, func(conn *websocket.Conn) {
		for i := 0; i < 3; i++ {
			_ = conn.WriteMessage(websocket.TextMessage, []byte("x"))
		}
		select {}
	})
	var count atomic.Int32
	statuses := newStatusLog()
	opts := fastOptions(srv.url())
	opts.OnMessage = func([]byte) error {
		count.Add(1)
		return errors.New("parse error")
	}
	opts.OnStatus = statuses.record

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go wsclient.Run(ctx, opts)

	deadline := time.Now().Add(2 * time.Second)
	for count.Load() < 3 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if count.Load() < 3 {
		t.Fatalf("エラーがあっても読み続けるはず: %d", count.Load())
	}
	if got := statuses.snapshot(); len(got) != 1 || !got[0] {
		t.Fatalf("接続は維持されるはず: %v", got)
	}
}

func TestRun_SendsKeepAlive(t *testing.T) {
	t.Parallel()
	pings := make(chan string, 100)
	srv := newEchoServer(t, func(conn *websocket.Conn) {
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			pings <- string(msg)
		}
	})
	opts := fastOptions(srv.url())
	opts.KeepAlive = func(conn *websocket.Conn) error {
		return conn.WriteMessage(websocket.TextMessage, []byte("ping"))
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go wsclient.Run(ctx, opts)

	for i := 0; i < 3; i++ {
		select {
		case got := <-pings:
			if got != "ping" {
				t.Fatalf("keep-alive の内容が不正: %s", got)
			}
		case <-time.After(2 * time.Second):
			t.Fatal("keep-alive が届かない")
		}
	}
}

func TestRun_BacksOffWhenDialFails(t *testing.T) {
	t.Parallel()
	var attempts atomic.Int32
	dialer := &websocket.Dialer{
		NetDialContext: func(context.Context, string, string) (net.Conn, error) {
			attempts.Add(1)
			return nil, errors.New("connection refused")
		},
	}
	opts := wsclient.Options{
		Name:       "test",
		URL:        "ws://127.0.0.1:1/ws",
		MinBackoff: 50 * time.Millisecond,
		MaxBackoff: 100 * time.Millisecond,
		Dialer:     dialer,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 400*time.Millisecond)
	defer cancel()
	wsclient.Run(ctx, opts)

	// 50ms→100ms→100ms... の待ちなので 400ms では多くても 6 回程度。ジッタを考慮して上限を緩めに見る。
	if n := attempts.Load(); n < 2 || n > 8 {
		t.Fatalf("バックオフが効いていない: attempts=%d", n)
	}
}
