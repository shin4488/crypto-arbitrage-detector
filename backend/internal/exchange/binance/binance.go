// Package binance は Binance の Partial Book Depth ストリームから板を受信するフィード。
//
// 利用する API: wss://stream.binance.com:9443/stream?streams=<symbol>@depth20@100ms/...
//   - 上位20段のスナップショットが100msごとに届く（差分ではないので状態管理が不要で、取りこぼしに強い）
//   - サーバーは20秒ごとに ping フレームを送り、pong が返らないと切断する（gorilla が自動で pong を返す）
//   - 接続は24時間で切られるため、再接続は必須
package binance

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange/wsclient"
)

const (
	// ID はこの取引所の識別子。
	ID domain.Exchange = "binance"
	// Name は表示名。
	Name = "Binance"
	// DefaultURL は combined stream のエンドポイント。
	DefaultURL = "wss://stream.binance.com:9443/stream"
	// depthSuffix は購読するストリームの種類。20段・100ms更新。
	depthSuffix = "@depth20@100ms"
)

// Symbol は通貨ペアを Binance のシンボル表記にする（BTC/USDT → BTCUSDT）。
func Symbol(p domain.Pair) string {
	return p.Base + p.Quote
}

// streamName は購読するストリーム名（btcusdt@depth20@100ms）。ストリーム名は小文字。
func streamName(p domain.Pair) string {
	return strings.ToLower(Symbol(p)) + depthSuffix
}

// StreamURL は複数ペアをまとめて購読する combined stream の URL を組み立てる。
func StreamURL(base string, pairs []domain.Pair) string {
	names := make([]string, 0, len(pairs))
	for _, p := range pairs {
		names = append(names, streamName(p))
	}
	return base + "?streams=" + strings.Join(names, "/")
}

// combinedMessage は combined stream のメッセージ形式。
type combinedMessage struct {
	Stream string `json:"stream"`
	Data   struct {
		LastUpdateID int64      `json:"lastUpdateId"`
		Bids         [][]string `json:"bids"`
		Asks         [][]string `json:"asks"`
	} `json:"data"`
}

// Feed は Binance への接続。
type Feed struct {
	cfg          exchange.FeedConfig
	streamToPair map[string]domain.Pair
}

// NewFeed はフィードを作る。
func NewFeed(cfg exchange.FeedConfig) *Feed {
	cfg = cfg.Normalize()
	if cfg.URL == "" {
		cfg.URL = DefaultURL
	}
	f := &Feed{cfg: cfg, streamToPair: make(map[string]domain.Pair, len(cfg.Pairs))}
	for _, p := range cfg.Pairs {
		f.streamToPair[streamName(p)] = p
	}
	return f
}

// Exchange は取引所の識別子を返す。
func (f *Feed) Exchange() domain.Exchange { return ID }

// Run は ctx が終わるまで接続を維持する。
func (f *Feed) Run(ctx context.Context) {
	wsclient.Run(ctx, wsclient.Options{
		Name:   string(ID),
		URL:    StreamURL(f.cfg.URL, f.cfg.Pairs),
		Logger: f.cfg.Logger,
		OnStatus: func(connected bool) {
			f.cfg.Sink.SetConnected(ID, connected)
		},
		OnMessage: f.handleMessage,
	})
}

func (f *Feed) handleMessage(raw []byte) error {
	book, ok, err := parseMessage(raw, f.streamToPair, f.cfg.Now())
	if err != nil || !ok {
		return err
	}
	return f.cfg.Sink.UpdateBook(book)
}

// parseMessage は受信メッセージを板に変換する。板以外のメッセージなら ok=false。
func parseMessage(raw []byte, streamToPair map[string]domain.Pair, now time.Time) (domain.OrderBook, bool, error) {
	var msg combinedMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		return domain.OrderBook{}, false, fmt.Errorf("binance: JSON を解釈できません: %w", err)
	}
	if msg.Stream == "" {
		// 購読応答やエラー通知など。現在の購読方式（URL 指定）では通常届かない。
		return domain.OrderBook{}, false, nil
	}
	pair, ok := streamToPair[msg.Stream]
	if !ok {
		return domain.OrderBook{}, false, fmt.Errorf("binance: 未知のストリームです: %s", msg.Stream)
	}
	bids, err := exchange.ParseLevels(msg.Data.Bids, exchange.ParseLevel)
	if err != nil {
		return domain.OrderBook{}, false, fmt.Errorf("binance: bid: %w", err)
	}
	asks, err := exchange.ParseLevels(msg.Data.Asks, exchange.ParseLevel)
	if err != nil {
		return domain.OrderBook{}, false, fmt.Errorf("binance: ask: %w", err)
	}
	return domain.OrderBook{Exchange: ID, Pair: pair, Bids: bids, Asks: asks, ReceivedAt: now}, true, nil
}
