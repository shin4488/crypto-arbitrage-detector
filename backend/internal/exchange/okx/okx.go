// Package okx は OKX の books5 チャネルから板を受信するフィード。
//
// 利用する API: wss://ws.okx.com:8443/ws/v5/public の books5 チャネル
//   - 上位5段のスナップショットが、板に変化があったとき100msごとに届く（差分ではない）
//   - 30秒間データが無いとサーバーが切断するため、クライアントから文字列 "ping" を送り "pong" を受け取る
//   - 板の各段は [price, size, "0"(廃止項目), 注文数] の4要素
package okx

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gorilla/websocket"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange/wsclient"
)

const (
	// ID はこの取引所の識別子。
	ID domain.Exchange = "okx"
	// Name は表示名。
	Name = "OKX"
	// DefaultURL は公開チャネルのエンドポイント。
	DefaultURL = "wss://ws.okx.com:8443/ws/v5/public"
	channel    = "books5"
	// keepAliveInterval は "ping" の送信間隔。サーバーの無通信切断（30秒）より十分短くする。
	keepAliveInterval = 20 * time.Second
)

// InstID は通貨ペアを OKX の instId 表記にする（BTC/USDT → BTC-USDT）。
func InstID(p domain.Pair) string {
	return p.Base + "-" + p.Quote
}

type subscribeArg struct {
	Channel string `json:"channel"`
	InstID  string `json:"instId"`
}

type subscribeRequest struct {
	Op   string         `json:"op"`
	Args []subscribeArg `json:"args"`
}

// message は受信メッセージ。イベント通知（subscribe/error）とデータ通知の両方をこの型で受ける。
type message struct {
	Event string       `json:"event"`
	Code  string       `json:"code"`
	Msg   string       `json:"msg"`
	Arg   subscribeArg `json:"arg"`
	Data  []struct {
		Asks [][]string `json:"asks"`
		Bids [][]string `json:"bids"`
		TS   string     `json:"ts"`
	} `json:"data"`
}

// Feed は OKX への接続。
type Feed struct {
	cfg        exchange.FeedConfig
	instToPair map[string]domain.Pair
}

// NewFeed はフィードを作る。
func NewFeed(cfg exchange.FeedConfig) *Feed {
	cfg = cfg.Normalize()
	if cfg.URL == "" {
		cfg.URL = DefaultURL
	}
	f := &Feed{cfg: cfg, instToPair: make(map[string]domain.Pair, len(cfg.Pairs))}
	for _, p := range cfg.Pairs {
		f.instToPair[InstID(p)] = p
	}
	return f
}

// Exchange は取引所の識別子を返す。
func (f *Feed) Exchange() domain.Exchange { return ID }

// Run は ctx が終わるまで接続を維持する。
func (f *Feed) Run(ctx context.Context) {
	wsclient.Run(ctx, wsclient.Options{
		Name:              string(ID),
		URL:               f.cfg.URL,
		Logger:            f.cfg.Logger,
		Subscribe:         f.subscribe,
		OnMessage:         f.handleMessage,
		KeepAlive:         sendPing,
		KeepAliveInterval: keepAliveInterval,
		OnStatus: func(connected bool) {
			f.cfg.Sink.SetConnected(ID, connected)
		},
	})
}

// SubscribeRequest は購読リクエストの JSON を返す（テストや動作確認用に公開）。
func SubscribeRequest(pairs []domain.Pair) ([]byte, error) {
	req := subscribeRequest{Op: "subscribe", Args: make([]subscribeArg, 0, len(pairs))}
	for _, p := range pairs {
		req.Args = append(req.Args, subscribeArg{Channel: channel, InstID: InstID(p)})
	}
	return json.Marshal(req)
}

func (f *Feed) subscribe(_ context.Context, conn *websocket.Conn) error {
	body, err := SubscribeRequest(f.cfg.Pairs)
	if err != nil {
		return err
	}
	return conn.WriteMessage(websocket.TextMessage, body)
}

func sendPing(conn *websocket.Conn) error {
	return conn.WriteMessage(websocket.TextMessage, []byte("ping"))
}

func (f *Feed) handleMessage(raw []byte) error {
	book, ok, err := parseMessage(raw, f.instToPair, f.cfg.Now())
	if err != nil {
		var subErr *subscriptionError
		if asSubscriptionError(err, &subErr) {
			// 購読が拒否されるのは設定ミスなどが原因で、つなぎ直しても直らない。ログに残して処理は続ける。
			f.cfg.Logger.Error("OKX の購読が拒否されました", "code", subErr.code, "msg", subErr.msg)
			return nil
		}
		return err
	}
	if !ok {
		return nil
	}
	return f.cfg.Sink.UpdateBook(book)
}

// subscriptionError はサーバーからのエラーイベント。
type subscriptionError struct {
	code string
	msg  string
}

func (e *subscriptionError) Error() string {
	return fmt.Sprintf("okx: エラーイベント code=%s msg=%s", e.code, e.msg)
}

func asSubscriptionError(err error, target **subscriptionError) bool {
	se, ok := err.(*subscriptionError) //nolint:errorlint // parseMessage が直接返すためラップされない
	if ok {
		*target = se
	}
	return ok
}

// parseMessage は受信メッセージを板に変換する。板以外（pong、購読応答）なら ok=false。
func parseMessage(raw []byte, instToPair map[string]domain.Pair, now time.Time) (domain.OrderBook, bool, error) {
	if string(raw) == "pong" {
		return domain.OrderBook{}, false, nil
	}
	var msg message
	if err := json.Unmarshal(raw, &msg); err != nil {
		return domain.OrderBook{}, false, fmt.Errorf("okx: JSON を解釈できません: %w", err)
	}
	switch msg.Event {
	case "error":
		return domain.OrderBook{}, false, &subscriptionError{code: msg.Code, msg: msg.Msg}
	case "subscribe", "unsubscribe":
		return domain.OrderBook{}, false, nil
	}
	if msg.Arg.Channel != channel || len(msg.Data) == 0 {
		return domain.OrderBook{}, false, nil
	}
	pair, ok := instToPair[msg.Arg.InstID]
	if !ok {
		return domain.OrderBook{}, false, fmt.Errorf("okx: 未知の instId です: %s", msg.Arg.InstID)
	}
	// books5 はスナップショットなので配列には常に1件しか入らないが、複数あれば最後（最新）を使う。
	data := msg.Data[len(msg.Data)-1]
	bids, err := exchange.ParseLevels(data.Bids, exchange.ParseLevel)
	if err != nil {
		return domain.OrderBook{}, false, fmt.Errorf("okx: bid: %w", err)
	}
	asks, err := exchange.ParseLevels(data.Asks, exchange.ParseLevel)
	if err != nil {
		return domain.OrderBook{}, false, fmt.Errorf("okx: ask: %w", err)
	}
	return domain.OrderBook{Exchange: ID, Pair: pair, Bids: bids, Asks: asks, ReceivedAt: now}, true, nil
}
