package server_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/engine"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/server"
)

var btc = domain.Pair{Base: "BTC", Quote: "USDT"}

// fakeState は固定のスナップショットを返す。
type fakeState struct{ state engine.State }

func (f fakeState) Snapshot() engine.State { return f.state }

func pairEvent(seq uint64, pair domain.Pair) engine.Event {
	return engine.Event{Seq: seq, Kind: engine.EventPairUpdated, Pair: &engine.PairSnapshot{Pair: pair, Quotes: map[domain.Exchange]engine.Quote{}}}
}

type testServer struct {
	hub *server.Hub
	srv *httptest.Server
}

func newTestServer(t *testing.T, state engine.State, opts server.Options) *testServer {
	t.Helper()
	hub := server.NewHub(fakeState{state: state}, opts, nil)
	srv := httptest.NewServer(hub)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = hub.Shutdown(ctx)
		srv.Close()
	})
	return &testServer{hub: hub, srv: srv}
}

func (ts *testServer) wsURL() string {
	return "ws" + strings.TrimPrefix(ts.srv.URL, "http")
}

func (ts *testServer) dial(t *testing.T, header http.Header) *websocket.Conn {
	t.Helper()
	conn, resp, err := websocket.DefaultDialer.Dial(ts.wsURL(), header)
	if err != nil {
		t.Fatalf("dial: %v (resp=%v)", err, resp)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

func readMessage(t *testing.T, conn *websocket.Conn, timeout time.Duration) map[string]any {
	t.Helper()
	_ = conn.SetReadDeadline(time.Now().Add(timeout))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("unmarshal: %v\n%s", err, data)
	}
	return m
}

func waitFor(t *testing.T, cond func() bool, msg string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal(msg)
}

func TestHub_SendsInitThenUpdates(t *testing.T) {
	t.Parallel()
	state := engine.State{Seq: 10, Pairs: []engine.PairSnapshot{{Pair: btc, Quotes: map[domain.Exchange]engine.Quote{}}}}
	ts := newTestServer(t, state, server.Options{})
	conn := ts.dial(t, nil)

	init := readMessage(t, conn, time.Second)
	if init["type"] != "init" || init["seq"] != float64(10) {
		t.Fatalf("最初は init のはず: %v", init)
	}
	if pairs := init["pairs"].([]any); len(pairs) != 1 {
		t.Fatalf("pairs=%v", pairs)
	}
	waitFor(t, func() bool { return ts.hub.ClientCount() == 1 }, "クライアントが登録されるはず")

	ts.hub.HandleEvent(pairEvent(11, btc))
	upd := readMessage(t, conn, time.Second)
	if upd["type"] != "pair" || upd["seq"] != float64(11) {
		t.Fatalf("更新が届くはず: %v", upd)
	}
}

func TestHub_DropsEventsOlderThanSnapshot(t *testing.T) {
	t.Parallel()
	ts := newTestServer(t, engine.State{Seq: 10}, server.Options{})
	conn := ts.dial(t, nil)
	readMessage(t, conn, time.Second) // init
	waitFor(t, func() bool { return ts.hub.ClientCount() == 1 }, "クライアントが登録されるはず")

	ts.hub.HandleEvent(pairEvent(5, btc))  // 初期状態に含まれている古いイベント
	ts.hub.HandleEvent(pairEvent(11, btc)) // 新しいイベント

	got := readMessage(t, conn, time.Second)
	if got["seq"] != float64(11) {
		t.Fatalf("古いイベントは捨てられ、新しいものだけ届くはず: %v", got)
	}
}

func TestHub_SlowClientDoesNotBlockHandleEvent(t *testing.T) {
	t.Parallel()
	ts := newTestServer(t, engine.State{}, server.Options{})
	conn := ts.dial(t, nil)
	readMessage(t, conn, time.Second) // init 以降は一切読まない
	waitFor(t, func() bool { return ts.hub.ClientCount() == 1 }, "クライアントが登録されるはず")

	start := time.Now()
	for i := 1; i <= 20000; i++ {
		ts.hub.HandleEvent(pairEvent(uint64(i), btc))
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("読まないクライアントがいても HandleEvent はブロックしない: %v", elapsed)
	}
}

func TestHub_UnregistersOnDisconnect(t *testing.T) {
	t.Parallel()
	ts := newTestServer(t, engine.State{}, server.Options{})
	conn := ts.dial(t, nil)
	readMessage(t, conn, time.Second)
	waitFor(t, func() bool { return ts.hub.ClientCount() == 1 }, "クライアントが登録されるはず")

	_ = conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
	_ = conn.Close()
	waitFor(t, func() bool { return ts.hub.ClientCount() == 0 }, "切断後に登録が解除されるはず")
}

func TestHub_ShutdownClosesClients(t *testing.T) {
	t.Parallel()
	hub := server.NewHub(fakeState{}, server.Options{}, nil)
	srv := httptest.NewServer(hub)
	defer srv.Close()

	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	readMessage(t, conn, time.Second)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := hub.Shutdown(ctx); err != nil {
		t.Fatalf("Shutdown: %v", err)
	}
	_ = conn.SetReadDeadline(time.Now().Add(time.Second))
	if _, _, err := conn.ReadMessage(); err == nil {
		t.Fatal("停止後はクライアント側の読み込みがエラーになるはず")
	}
	// 停止後の接続は拒否される
	if c2, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http"), nil); err == nil {
		_ = c2.SetReadDeadline(time.Now().Add(time.Second))
		if _, _, err := c2.ReadMessage(); err == nil {
			t.Fatal("停止後の接続はすぐ閉じられるはず")
		}
		_ = c2.Close()
	}
}

func TestHub_OriginCheck(t *testing.T) {
	t.Parallel()

	t.Run("同一オリジンは許可", func(t *testing.T) {
		t.Parallel()
		ts := newTestServer(t, engine.State{}, server.Options{})
		ts.dial(t, http.Header{"Origin": []string{ts.srv.URL}})
	})

	t.Run("別オリジンは拒否", func(t *testing.T) {
		t.Parallel()
		ts := newTestServer(t, engine.State{}, server.Options{})
		_, resp, err := websocket.DefaultDialer.Dial(ts.wsURL(), http.Header{"Origin": []string{"http://evil.example"}})
		if err == nil {
			t.Fatal("拒否されるはず")
		}
		if resp == nil || resp.StatusCode != http.StatusForbidden {
			t.Fatalf("403 のはず: %v", resp)
		}
	})

	t.Run("設定で許可したオリジンは受け入れる", func(t *testing.T) {
		t.Parallel()
		ts := newTestServer(t, engine.State{}, server.Options{AllowedOrigins: []string{"http://localhost:3000"}})
		ts.dial(t, http.Header{"Origin": []string{"http://localhost:3000"}})
	})
}

func TestHub_PingKeepsConnectionAlive(t *testing.T) {
	t.Parallel()
	ts := newTestServer(t, engine.State{}, server.Options{PingInterval: 20 * time.Millisecond, PongTimeout: 200 * time.Millisecond})
	conn := ts.dial(t, nil)
	readMessage(t, conn, time.Second)

	pings := 0
	conn.SetPingHandler(func(data string) error {
		pings++
		return conn.WriteControl(websocket.PongMessage, []byte(data), time.Now().Add(time.Second))
	})
	// ping は制御フレームなので、読み続けることでハンドラが呼ばれる
	_ = conn.SetReadDeadline(time.Now().Add(300 * time.Millisecond))
	for {
		if _, _, err := conn.NextReader(); err != nil {
			break
		}
	}
	if pings < 3 {
		t.Fatalf("定期的に ping が届くはず: %d", pings)
	}
	if ts.hub.ClientCount() != 1 {
		t.Fatal("pong を返している間は接続が維持されるはず")
	}
}
