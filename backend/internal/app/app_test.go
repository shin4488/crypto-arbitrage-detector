package app_test

import (
	"context"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/app"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/config"
)

// fakeBinance は Binance 互換の板を1回送る WebSocket サーバー。
func fakeBinance(t *testing.T) string {
	t.Helper()
	upgrader := websocket.Upgrader{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		_ = conn.WriteMessage(websocket.TextMessage, []byte(`{"stream":"btcusdt@depth20@100ms","data":{"lastUpdateId":1,"bids":[["100","1"]],"asks":[["100.5","1"]]}}`))
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}))
	t.Cleanup(srv.Close)
	return "ws" + strings.TrimPrefix(srv.URL, "http") + "/stream"
}

// fakeOKX は OKX 互換の板を1回送る WebSocket サーバー。binance 側より高い bid を出して機会を作る。
func fakeOKX(t *testing.T) string {
	t.Helper()
	upgrader := websocket.Upgrader{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		if _, _, err := conn.ReadMessage(); err != nil { // 購読リクエスト
			return
		}
		_ = conn.WriteMessage(websocket.TextMessage, []byte(`{"arg":{"channel":"books5","instId":"BTC-USDT"},"data":[{"asks":[["102","1","0","1"]],"bids":[["101","1","0","1"]],"ts":"1"}]}`))
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}))
	t.Cleanup(srv.Close)
	return "ws" + strings.TrimPrefix(srv.URL, "http")
}

func freePort(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	_ = ln.Close()
	return addr
}

func TestApp_EndToEnd(t *testing.T) {
	cfg := config.Default()
	cfg.Server.Addr = freePort(t)
	cfg.Pairs = []string{"BTC/USDT"}
	cfg.Exchanges[0].WSURL = fakeBinance(t)
	cfg.Exchanges[1].WSURL = fakeOKX(t)

	a, err := app.New(cfg, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	runErr := make(chan error, 1)
	go func() { runErr <- a.Run(ctx) }()

	// サーバーが待ち受けるまで待つ
	var conn *websocket.Conn
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		c, _, err := websocket.DefaultDialer.Dial("ws://"+cfg.Server.Addr+"/ws", nil)
		if err == nil {
			conn = c
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if conn == nil {
		t.Fatal("WebSocket に接続できない")
	}
	defer conn.Close()

	// init に続いて更新が届き、最終的に機会（episode）が観測できるはず
	sawEpisode := false
	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	for i := 0; i < 20 && !sawEpisode; i++ {
		_, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("read: %v", err)
		}
		var m map[string]any
		if err := json.Unmarshal(data, &m); err != nil {
			t.Fatal(err)
		}
		switch m["type"] {
		case "init":
			if hist, ok := m["history"].([]any); ok && len(hist) > 0 {
				sawEpisode = true
			}
		case "episode":
			sawEpisode = true
		}
	}
	if !sawEpisode {
		t.Fatal("binance で買って okx で売る機会が検知されるはず")
	}

	resp, err := http.Get("http://" + cfg.Server.Addr + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var health map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		t.Fatal(err)
	}
	if health["status"] != "ok" || health["clients"] != float64(1) {
		t.Fatalf("health=%v", health)
	}
	exchanges := health["exchanges"].(map[string]any)
	if exchanges["binance"] != true || exchanges["okx"] != true {
		t.Fatalf("両取引所とも接続中のはず: %v", exchanges)
	}

	cancel()
	select {
	case err := <-runErr:
		if err != nil {
			t.Fatalf("Run: %v", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("停止しない")
	}
}

func TestApp_RejectsUnknownExchange(t *testing.T) {
	t.Parallel()
	cfg := config.Default()
	cfg.Exchanges[1].ID = "bybit"
	if _, err := app.New(cfg, slog.New(slog.DiscardHandler)); err == nil {
		t.Fatal("未対応の取引所はエラー")
	}
}

func TestApp_FailsWhenPortInUse(t *testing.T) {
	t.Parallel()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()

	cfg := config.Default()
	cfg.Server.Addr = ln.Addr().String()
	cfg.Exchanges[0].WSURL = "ws://127.0.0.1:1"
	cfg.Exchanges[1].WSURL = "ws://127.0.0.1:1"
	a, err := app.New(cfg, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatal(err)
	}
	if err := a.Run(context.Background()); err == nil {
		t.Fatal("ポートが使用中ならエラーで戻る")
	}
}
