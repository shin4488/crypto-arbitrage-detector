package wire_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/shopspring/decimal"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/arbitrage"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/engine"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/wire"
)

var (
	btc = domain.Pair{Base: "BTC", Quote: "USDT"}
	at  = time.Date(2026, 9, 2, 12, 0, 0, 123_000_000, time.UTC)
)

func d(s string) decimal.Decimal { return decimal.RequireFromString(s) }

// roundTrip は JSON にして map に戻す（キー名と値の形式を検証するため）。
func roundTrip(t *testing.T, v any) map[string]any {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatalf("Unmarshal: %v\n%s", err, b)
	}
	return m
}

func TestInitMessage(t *testing.T) {
	t.Parallel()

	state := engine.State{
		Seq: 42,
		Exchanges: []engine.ExchangeState{
			{ExchangeInfo: engine.ExchangeInfo{ID: "binance", Name: "Binance", TakerFeeRate: d("0.001")}, Connected: true, Since: at},
		},
		Pairs: []engine.PairSnapshot{{
			Pair: btc,
			Quotes: map[domain.Exchange]engine.Quote{
				"binance": {Bid: domain.Level{Price: d("100"), Quantity: d("1")}, Ask: domain.Level{Price: d("100.5"), Quantity: d("2")}, BidLevels: 20, AskLevels: 20, UpdatedAt: at},
			},
			UpdatedAt: at,
		}},
		History: []engine.Episode{{
			ID: 7, Pair: btc, BuyExchange: "binance", SellExchange: "okx",
			StartedAt: at, MaxNetProfit: d("1.5"), MaxNetProfitAt: at,
			QuantityAtMax: d("0.3"), AvgBuyPriceAtMax: d("100"), AvgSellPriceAtMax: d("105"),
		}},
	}

	m := roundTrip(t, wire.NewInitMessage(state))

	if m["type"] != "init" {
		t.Fatalf("type=%v", m["type"])
	}
	if m["seq"] != float64(42) {
		t.Fatalf("seq=%v", m["seq"])
	}
	ex := m["exchanges"].([]any)[0].(map[string]any)
	if ex["id"] != "binance" || ex["name"] != "Binance" || ex["takerFeeRate"] != "0.001" || ex["connected"] != true {
		t.Fatalf("exchange=%v", ex)
	}
	if ex["since"] != "2026-09-02T12:00:00.123Z" {
		t.Fatalf("since=%v", ex["since"])
	}

	pair := m["pairs"].([]any)[0].(map[string]any)
	if pair["pair"] != "BTC/USDT" || pair["base"] != "BTC" || pair["quote"] != "USDT" {
		t.Fatalf("pair=%v", pair)
	}
	quote := pair["quotes"].(map[string]any)["binance"].(map[string]any)
	bid := quote["bid"].(map[string]any)
	if bid["price"] != "100" || bid["quantity"] != "1" {
		t.Fatalf("bid=%v", bid)
	}
	if quote["bidLevels"] != float64(20) || quote["askLevels"] != float64(20) {
		t.Fatalf("levels=%v", quote)
	}
	// 方向が無いときは null ではなく空配列（フロントの扱いを単純にするため）
	if dirs, ok := pair["directions"].([]any); !ok || len(dirs) != 0 {
		t.Fatalf("directions=%v", pair["directions"])
	}

	ep := m["history"].([]any)[0].(map[string]any)
	if ep["id"] != float64(7) || ep["pair"] != "BTC/USDT" || ep["buyExchange"] != "binance" || ep["sellExchange"] != "okx" {
		t.Fatalf("episode=%v", ep)
	}
	if ep["maxNetProfit"] != "1.5" || ep["quantityAtMax"] != "0.3" {
		t.Fatalf("episode=%v", ep)
	}
	// 継続中は endedAt が null
	if v, ok := ep["endedAt"]; !ok || v != nil {
		t.Fatalf("endedAt=%v", ep["endedAt"])
	}
}

func TestInitMessage_EmptyCollectionsAreArrays(t *testing.T) {
	t.Parallel()
	m := roundTrip(t, wire.NewInitMessage(engine.State{}))
	for _, key := range []string{"exchanges", "pairs", "history"} {
		if _, ok := m[key].([]any); !ok {
			t.Fatalf("%s は空配列のはず: %v", key, m[key])
		}
	}
}

func TestPairMessage_WithDirections(t *testing.T) {
	t.Parallel()

	snap := engine.PairSnapshot{
		Pair:   btc,
		Quotes: map[domain.Exchange]engine.Quote{},
		Directions: []arbitrage.Result{{
			BuyExchange: "binance", SellExchange: "okx",
			BestAsk: domain.Level{Price: d("100"), Quantity: d("1")}, BestBid: domain.Level{Price: d("101"), Quantity: d("1")},
			GrossSpread: d("1"), GrossSpreadRatio: d("0.01"), NetSpread: d("0.799"), Profitable: true,
			Quantity: d("1"), BuyCost: d("100"), SellProceeds: d("101"), BuyFee: d("0.1"), SellFee: d("0.101"),
			GrossProfit: d("1"), NetProfit: d("0.799"), AvgBuyPrice: d("100"), AvgSellPrice: d("101"), DepthExhausted: true,
		}},
		UpdatedAt: at,
	}
	ev := engine.Event{Seq: 9, Kind: engine.EventPairUpdated, Pair: &snap}

	m := roundTrip(t, wire.NewMessage(ev))
	if m["type"] != "pair" || m["seq"] != float64(9) {
		t.Fatalf("m=%v", m)
	}
	pair := m["pair"].(map[string]any)
	dir := pair["directions"].([]any)[0].(map[string]any)
	if dir["buyExchange"] != "binance" || dir["sellExchange"] != "okx" || dir["profitable"] != true {
		t.Fatalf("dir=%v", dir)
	}
	if dir["netProfit"] != "0.799" || dir["grossSpreadRatio"] != "0.01" || dir["depthExhausted"] != true {
		t.Fatalf("dir=%v", dir)
	}
	if dir["bestAsk"].(map[string]any)["price"] != "100" {
		t.Fatalf("bestAsk=%v", dir["bestAsk"])
	}
	if pair["updatedAt"] != "2026-09-02T12:00:00.123Z" {
		t.Fatalf("updatedAt=%v", pair["updatedAt"])
	}
}

func TestEpisodeMessage_Ended(t *testing.T) {
	t.Parallel()
	ended := at.Add(3 * time.Second)
	ev := engine.Event{Seq: 3, Kind: engine.EventEpisodeChanged, Episode: &engine.Episode{
		ID: 1, Pair: btc, BuyExchange: "okx", SellExchange: "binance", StartedAt: at, EndedAt: ended,
		MaxNetProfit: d("0.5"), MaxNetProfitAt: at, QuantityAtMax: d("1"), AvgBuyPriceAtMax: d("1"), AvgSellPriceAtMax: d("2"),
	}}
	m := roundTrip(t, wire.NewMessage(ev))
	if m["type"] != "episode" {
		t.Fatalf("type=%v", m["type"])
	}
	ep := m["episode"].(map[string]any)
	if ep["endedAt"] != "2026-09-02T12:00:03.123Z" {
		t.Fatalf("endedAt=%v", ep["endedAt"])
	}
}

func TestExchangeStatusMessage(t *testing.T) {
	t.Parallel()
	ev := engine.Event{Seq: 5, Kind: engine.EventExchangeStatusChanged, Status: &engine.ExchangeStatus{Exchange: "okx", Connected: false, Since: at}}
	m := roundTrip(t, wire.NewMessage(ev))
	if m["type"] != "exchange" {
		t.Fatalf("type=%v", m["type"])
	}
	st := m["exchange"].(map[string]any)
	if st["id"] != "okx" || st["connected"] != false || st["since"] != "2026-09-02T12:00:00.123Z" {
		t.Fatalf("status=%v", st)
	}
}

func TestNewMessage_UnknownKind(t *testing.T) {
	t.Parallel()
	if msg := wire.NewMessage(engine.Event{Kind: engine.EventKind(99)}); msg != nil {
		t.Fatalf("未知の種類は nil: %v", msg)
	}
}

func TestTimestampsAreUTCMilliseconds(t *testing.T) {
	t.Parallel()
	// ローカル時刻を渡しても UTC のミリ秒精度で出力する（ブラウザでの解釈を単純にするため）
	jst := time.FixedZone("JST", 9*60*60)
	local := time.Date(2026, 9, 2, 21, 0, 0, 999_999_999, jst)
	ev := engine.Event{Kind: engine.EventExchangeStatusChanged, Status: &engine.ExchangeStatus{Exchange: "okx", Since: local}}
	m := roundTrip(t, wire.NewMessage(ev))
	if got := m["exchange"].(map[string]any)["since"]; got != "2026-09-02T12:00:00.999Z" {
		t.Fatalf("since=%v", got)
	}
}
