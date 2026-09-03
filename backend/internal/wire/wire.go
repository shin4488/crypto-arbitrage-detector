// Package wire はフロントエンドへ WebSocket で送る JSON メッセージの形式を定義する。
// エンジン内部の型をそのまま送らず、ここで変換する。内部の構造を変えても通信の形式に影響が出ないようにするため。
//
// 形式の方針:
//   - キーは camelCase（TypeScript 側の慣習に合わせる）
//   - 金額・数量は文字列（JavaScript の浮動小数点で誤差を出さないため）
//   - 時刻は UTC・ミリ秒精度の RFC 3339
//   - 配列は空でも null ではなく [] にする
package wire

import (
	"time"

	"github.com/shopspring/decimal"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/arbitrage"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/engine"
)

// メッセージ種別。フロントエンドはこの値で判別する。
const (
	TypeInit     = "init"
	TypePair     = "pair"
	TypeEpisode  = "episode"
	TypeExchange = "exchange"
)

// Timestamp は UTC・ミリ秒精度で JSON 化する時刻。
type Timestamp time.Time

// MarshalJSON は "2026-09-02T12:00:00.123Z" 形式で出力する。
func (t Timestamp) MarshalJSON() ([]byte, error) {
	return []byte(`"` + time.Time(t).UTC().Format("2006-01-02T15:04:05.000Z07:00") + `"`), nil
}

// Exchange は取引所の設定と接続状態。
type Exchange struct {
	ID           string          `json:"id"`
	Name         string          `json:"name"`
	TakerFeeRate decimal.Decimal `json:"takerFeeRate"`
	Connected    bool            `json:"connected"`
	Since        Timestamp       `json:"since"`
}

// ExchangeStatus は接続状態の変化。
type ExchangeStatus struct {
	ID        string    `json:"id"`
	Connected bool      `json:"connected"`
	Since     Timestamp `json:"since"`
}

// Level は板の1段。
type Level struct {
	Price    decimal.Decimal `json:"price"`
	Quantity decimal.Decimal `json:"quantity"`
}

// Quote は取引所ごとの最良気配。
type Quote struct {
	Bid       Level     `json:"bid"`
	Ask       Level     `json:"ask"`
	BidLevels int       `json:"bidLevels"`
	AskLevels int       `json:"askLevels"`
	UpdatedAt Timestamp `json:"updatedAt"`
}

// Direction は「買い元→売り先」方向の評価結果。
type Direction struct {
	BuyExchange      string          `json:"buyExchange"`
	SellExchange     string          `json:"sellExchange"`
	BestAsk          Level           `json:"bestAsk"`
	BestBid          Level           `json:"bestBid"`
	GrossSpread      decimal.Decimal `json:"grossSpread"`
	GrossSpreadRatio decimal.Decimal `json:"grossSpreadRatio"`
	NetSpread        decimal.Decimal `json:"netSpread"`
	Profitable       bool            `json:"profitable"`
	Quantity         decimal.Decimal `json:"quantity"`
	BuyCost          decimal.Decimal `json:"buyCost"`
	SellProceeds     decimal.Decimal `json:"sellProceeds"`
	BuyFee           decimal.Decimal `json:"buyFee"`
	SellFee          decimal.Decimal `json:"sellFee"`
	GrossProfit      decimal.Decimal `json:"grossProfit"`
	NetProfit        decimal.Decimal `json:"netProfit"`
	AvgBuyPrice      decimal.Decimal `json:"avgBuyPrice"`
	AvgSellPrice     decimal.Decimal `json:"avgSellPrice"`
	DepthExhausted   bool            `json:"depthExhausted"`
}

// Pair は通貨ペアの現在の評価結果。
type Pair struct {
	Pair       string           `json:"pair"`
	Base       string           `json:"base"`
	Quote      string           `json:"quote"`
	Quotes     map[string]Quote `json:"quotes"`
	Directions []Direction      `json:"directions"`
	UpdatedAt  Timestamp        `json:"updatedAt"`
}

// Episode は機会の履歴1件。
type Episode struct {
	ID                uint64          `json:"id"`
	Pair              string          `json:"pair"`
	BuyExchange       string          `json:"buyExchange"`
	SellExchange      string          `json:"sellExchange"`
	StartedAt         Timestamp       `json:"startedAt"`
	EndedAt           *Timestamp      `json:"endedAt"`
	MaxNetProfit      decimal.Decimal `json:"maxNetProfit"`
	MaxNetProfitAt    Timestamp       `json:"maxNetProfitAt"`
	QuantityAtMax     decimal.Decimal `json:"quantityAtMax"`
	AvgBuyPriceAtMax  decimal.Decimal `json:"avgBuyPriceAtMax"`
	AvgSellPriceAtMax decimal.Decimal `json:"avgSellPriceAtMax"`
}

// InitMessage は接続直後に送る全状態。
type InitMessage struct {
	Type      string     `json:"type"`
	Seq       uint64     `json:"seq"`
	Exchanges []Exchange `json:"exchanges"`
	Pairs     []Pair     `json:"pairs"`
	History   []Episode  `json:"history"`
}

// PairMessage は通貨ペアの評価結果の更新。
type PairMessage struct {
	Type string `json:"type"`
	Seq  uint64 `json:"seq"`
	Pair Pair   `json:"pair"`
}

// EpisodeMessage は機会の開始・更新・終了。
type EpisodeMessage struct {
	Type    string  `json:"type"`
	Seq     uint64  `json:"seq"`
	Episode Episode `json:"episode"`
}

// ExchangeStatusMessage は取引所の接続状態の変化。
type ExchangeStatusMessage struct {
	Type     string         `json:"type"`
	Seq      uint64         `json:"seq"`
	Exchange ExchangeStatus `json:"exchange"`
}

// NewInitMessage はエンジンの状態から初期メッセージを作る。
func NewInitMessage(s engine.State) InitMessage {
	msg := InitMessage{
		Type:      TypeInit,
		Seq:       s.Seq,
		Exchanges: make([]Exchange, 0, len(s.Exchanges)),
		Pairs:     make([]Pair, 0, len(s.Pairs)),
		History:   make([]Episode, 0, len(s.History)),
	}
	for _, ex := range s.Exchanges {
		msg.Exchanges = append(msg.Exchanges, Exchange{
			ID:           string(ex.ID),
			Name:         ex.Name,
			TakerFeeRate: ex.TakerFeeRate,
			Connected:    ex.Connected,
			Since:        Timestamp(ex.Since),
		})
	}
	for i := range s.Pairs {
		msg.Pairs = append(msg.Pairs, newPair(&s.Pairs[i]))
	}
	for i := range s.History {
		msg.History = append(msg.History, newEpisode(&s.History[i]))
	}
	return msg
}

// NewMessage はエンジンのイベントを送信用メッセージに変換する。未知の種類なら nil。
func NewMessage(ev engine.Event) any {
	switch ev.Kind {
	case engine.EventPairUpdated:
		return PairMessage{Type: TypePair, Seq: ev.Seq, Pair: newPair(ev.Pair)}
	case engine.EventEpisodeChanged:
		return EpisodeMessage{Type: TypeEpisode, Seq: ev.Seq, Episode: newEpisode(ev.Episode)}
	case engine.EventExchangeStatusChanged:
		return ExchangeStatusMessage{Type: TypeExchange, Seq: ev.Seq, Exchange: ExchangeStatus{
			ID:        string(ev.Status.Exchange),
			Connected: ev.Status.Connected,
			Since:     Timestamp(ev.Status.Since),
		}}
	default:
		return nil
	}
}

func newPair(s *engine.PairSnapshot) Pair {
	p := Pair{
		Pair:       s.Pair.String(),
		Base:       s.Pair.Base,
		Quote:      s.Pair.Quote,
		Quotes:     make(map[string]Quote, len(s.Quotes)),
		Directions: make([]Direction, 0, len(s.Directions)),
		UpdatedAt:  Timestamp(s.UpdatedAt),
	}
	for ex, q := range s.Quotes {
		p.Quotes[string(ex)] = Quote{
			Bid:       newLevel(q.Bid),
			Ask:       newLevel(q.Ask),
			BidLevels: q.BidLevels,
			AskLevels: q.AskLevels,
			UpdatedAt: Timestamp(q.UpdatedAt),
		}
	}
	for i := range s.Directions {
		p.Directions = append(p.Directions, newDirection(&s.Directions[i]))
	}
	return p
}

func newLevel(l domain.Level) Level {
	return Level{Price: l.Price, Quantity: l.Quantity}
}

func newDirection(r *arbitrage.Result) Direction {
	return Direction{
		BuyExchange:      string(r.BuyExchange),
		SellExchange:     string(r.SellExchange),
		BestAsk:          newLevel(r.BestAsk),
		BestBid:          newLevel(r.BestBid),
		GrossSpread:      r.GrossSpread,
		GrossSpreadRatio: r.GrossSpreadRatio,
		NetSpread:        r.NetSpread,
		Profitable:       r.Profitable,
		Quantity:         r.Quantity,
		BuyCost:          r.BuyCost,
		SellProceeds:     r.SellProceeds,
		BuyFee:           r.BuyFee,
		SellFee:          r.SellFee,
		GrossProfit:      r.GrossProfit,
		NetProfit:        r.NetProfit,
		AvgBuyPrice:      r.AvgBuyPrice,
		AvgSellPrice:     r.AvgSellPrice,
		DepthExhausted:   r.DepthExhausted,
	}
}

func newEpisode(ep *engine.Episode) Episode {
	e := Episode{
		ID:                ep.ID,
		Pair:              ep.Pair.String(),
		BuyExchange:       string(ep.BuyExchange),
		SellExchange:      string(ep.SellExchange),
		StartedAt:         Timestamp(ep.StartedAt),
		MaxNetProfit:      ep.MaxNetProfit,
		MaxNetProfitAt:    Timestamp(ep.MaxNetProfitAt),
		QuantityAtMax:     ep.QuantityAtMax,
		AvgBuyPriceAtMax:  ep.AvgBuyPriceAtMax,
		AvgSellPriceAtMax: ep.AvgSellPriceAtMax,
	}
	if !ep.EndedAt.IsZero() {
		ended := Timestamp(ep.EndedAt)
		e.EndedAt = &ended
	}
	return e
}
