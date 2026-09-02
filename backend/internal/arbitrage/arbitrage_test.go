package arbitrage_test

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/arbitrage"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
)

var (
	btcusdt = domain.Pair{Base: "BTC", Quote: "USDT"}
	noFees  = arbitrage.Fees{}
	// 0.1% ずつの taker 手数料（Binance / OKX の既定値と同じ）
	tenBps = arbitrage.Fees{Buy: d("0.001"), Sell: d("0.001")}
)

func d(s string) decimal.Decimal { return decimal.RequireFromString(s) }

func lv(price, qty string) domain.Level {
	return domain.Level{Price: d(price), Quantity: d(qty)}
}

// book は買い取引所（asks が意味を持つ）または売り取引所（bids が意味を持つ）の板を組み立てる。
func book(ex domain.Exchange, bids, asks []domain.Level) domain.OrderBook {
	return domain.OrderBook{Exchange: ex, Pair: btcusdt, Bids: bids, Asks: asks, ReceivedAt: time.Now()}
}

func assertEq(t *testing.T, label string, got decimal.Decimal, want string) {
	t.Helper()
	if !got.Equal(d(want)) {
		t.Fatalf("%s: got=%s want=%s", label, got, want)
	}
}

func TestEvaluate_NoOpportunity(t *testing.T) {
	t.Parallel()

	t.Run("売り先の最良bidが買い元の最良ask以下なら機会なし（価格差は負）", func(t *testing.T) {
		t.Parallel()
		buy := book("binance", []domain.Level{lv("99", "1")}, []domain.Level{lv("100", "1")})
		sell := book("okx", []domain.Level{lv("99.5", "1")}, []domain.Level{lv("100.5", "1")})

		r, ok := arbitrage.Evaluate(buy, sell, noFees)
		if !ok {
			t.Fatal("両方の板があるので ok=true のはず")
		}
		if r.Profitable {
			t.Fatal("機会なしのはず")
		}
		assertEq(t, "GrossSpread", r.GrossSpread, "-0.5")
		assertEq(t, "NetSpread", r.NetSpread, "-0.5")
		if !r.Quantity.IsZero() || !r.NetProfit.IsZero() {
			t.Fatalf("機会なしでは数量・利益はゼロ: qty=%s net=%s", r.Quantity, r.NetProfit)
		}
	})

	t.Run("価格差が正でも手数料を引くと負なら機会なし", func(t *testing.T) {
		t.Parallel()
		buy := book("binance", nil, []domain.Level{lv("100", "1")})
		sell := book("okx", []domain.Level{lv("100.1", "1")}, nil)

		r, ok := arbitrage.Evaluate(buy, sell, tenBps)
		if !ok || r.Profitable {
			t.Fatalf("手数料込みで赤字なので機会なし: ok=%v profitable=%v", ok, r.Profitable)
		}
		assertEq(t, "GrossSpread", r.GrossSpread, "0.1")
		// 100.1×0.999 − 100×1.001 = 99.9999 − 100.1 = −0.1001
		assertEq(t, "NetSpread", r.NetSpread, "-0.1001")
	})

	t.Run("手数料込みでちょうど0なら機会なし（厳密に正のみ）", func(t *testing.T) {
		t.Parallel()
		buy := book("binance", nil, []domain.Level{lv("100", "1")})
		sell := book("okx", []domain.Level{lv("100", "1")}, nil)

		r, _ := arbitrage.Evaluate(buy, sell, noFees)
		if r.Profitable {
			t.Fatal("利益0は機会なし")
		}
	})

	t.Run("買い元のaskが空なら評価不能", func(t *testing.T) {
		t.Parallel()
		buy := book("binance", []domain.Level{lv("99", "1")}, nil)
		sell := book("okx", []domain.Level{lv("100", "1")}, nil)
		if _, ok := arbitrage.Evaluate(buy, sell, noFees); ok {
			t.Fatal("askが無いので ok=false のはず")
		}
	})

	t.Run("売り先のbidが空なら評価不能", func(t *testing.T) {
		t.Parallel()
		buy := book("binance", nil, []domain.Level{lv("100", "1")})
		sell := book("okx", nil, []domain.Level{lv("101", "1")})
		if _, ok := arbitrage.Evaluate(buy, sell, noFees); ok {
			t.Fatal("bidが無いので ok=false のはず")
		}
	})
}

func TestEvaluate_SingleLevel(t *testing.T) {
	t.Parallel()

	t.Run("1段ずつの板では数量は少ない方に揃う", func(t *testing.T) {
		t.Parallel()
		buy := book("okx", nil, []domain.Level{lv("100", "0.5")})
		sell := book("binance", []domain.Level{lv("101", "2")}, nil)

		r, ok := arbitrage.Evaluate(buy, sell, noFees)
		if !ok || !r.Profitable {
			t.Fatalf("機会ありのはず: ok=%v r=%+v", ok, r)
		}
		if r.BuyExchange != "okx" || r.SellExchange != "binance" {
			t.Fatalf("取引所の向きが不正: %s -> %s", r.BuyExchange, r.SellExchange)
		}
		assertEq(t, "Quantity", r.Quantity, "0.5")
		assertEq(t, "BuyCost", r.BuyCost, "50")
		assertEq(t, "SellProceeds", r.SellProceeds, "50.5")
		assertEq(t, "GrossProfit", r.GrossProfit, "0.5")
		assertEq(t, "NetProfit", r.NetProfit, "0.5")
		assertEq(t, "AvgBuyPrice", r.AvgBuyPrice, "100")
		assertEq(t, "AvgSellPrice", r.AvgSellPrice, "101")
		assertEq(t, "GrossSpread", r.GrossSpread, "1")
		assertEq(t, "GrossSpreadRatio", r.GrossSpreadRatio, "0.01")
		if !r.DepthExhausted {
			t.Fatal("買い元の板を使い切ったので DepthExhausted=true のはず")
		}
	})

	t.Run("手数料は買いは約定代金に上乗せ、売りは受取代金から控除する", func(t *testing.T) {
		t.Parallel()
		buy := book("binance", nil, []domain.Level{lv("100", "1")})
		sell := book("okx", []domain.Level{lv("100.5", "1")}, nil)

		r, _ := arbitrage.Evaluate(buy, sell, tenBps)
		if !r.Profitable {
			t.Fatal("機会ありのはず")
		}
		assertEq(t, "Quantity", r.Quantity, "1")
		assertEq(t, "BuyFee", r.BuyFee, "0.1")      // 100 × 0.001
		assertEq(t, "SellFee", r.SellFee, "0.1005") // 100.5 × 0.001
		assertEq(t, "GrossProfit", r.GrossProfit, "0.5")
		assertEq(t, "NetProfit", r.NetProfit, "0.2995") // 0.5 − 0.1 − 0.1005
		assertEq(t, "NetSpread", r.NetSpread, "0.2995")
	})
}

func TestEvaluate_WalksDepth(t *testing.T) {
	t.Parallel()

	t.Run("複数段を突き合わせて利益が出る範囲の数量を積み上げる", func(t *testing.T) {
		t.Parallel()
		buy := book("binance", nil, []domain.Level{lv("100", "1"), lv("101", "2"), lv("103", "5")})
		sell := book("okx", []domain.Level{lv("102.5", "2"), lv("101.5", "2"), lv("100.5", "1")}, nil)

		r, _ := arbitrage.Evaluate(buy, sell, noFees)
		if !r.Profitable {
			t.Fatal("機会ありのはず")
		}
		// 突き合わせの経過:
		//   ask100(1) × bid102.5 → 1 (ask段を消費)
		//   ask101(2) × bid102.5 → 1 (bid段を消費)
		//   ask101(残1) × bid101.5 → 1 (ask段を消費)
		//   ask103 × bid101.5 → 逆ざやなので終了
		assertEq(t, "Quantity", r.Quantity, "3")
		assertEq(t, "BuyCost", r.BuyCost, "302")             // 100 + 101 + 101
		assertEq(t, "SellProceeds", r.SellProceeds, "306.5") // 102.5 + 102.5 + 101.5
		assertEq(t, "GrossProfit", r.GrossProfit, "4.5")
		assertEq(t, "NetProfit", r.NetProfit, "4.5")
		if r.DepthExhausted {
			t.Fatal("両側とも段が残っているので DepthExhausted=false のはず")
		}
		// 最良気配ベースの指標は板走査の結果に左右されない
		assertEq(t, "GrossSpread", r.GrossSpread, "2.5")
		assertEq(t, "NetSpread", r.NetSpread, "2.5")
	})

	t.Run("手数料込みで赤字になる段で走査を止める", func(t *testing.T) {
		t.Parallel()
		buy := book("binance", nil, []domain.Level{lv("100", "1"), lv("100.15", "1")})
		sell := book("okx", []domain.Level{lv("100.5", "5")}, nil)

		r, _ := arbitrage.Evaluate(buy, sell, tenBps)
		if !r.Profitable {
			t.Fatal("1段目は黒字なので機会あり")
		}
		// 2段目: 100.5×0.999 − 100.15×1.001 = 100.3995 − 100.25015 = 0.14935 > 0 → まだ黒字
		// なので2段目も取り込まれる。3段目は無いので DepthExhausted。
		assertEq(t, "Quantity", r.Quantity, "2")
		if !r.DepthExhausted {
			t.Fatal("買い元の板を使い切ったので DepthExhausted=true")
		}
	})

	t.Run("手数料込みで赤字になる段は取り込まない", func(t *testing.T) {
		t.Parallel()
		buy := book("binance", nil, []domain.Level{lv("100", "1"), lv("100.4", "1")})
		sell := book("okx", []domain.Level{lv("100.5", "5")}, nil)

		r, _ := arbitrage.Evaluate(buy, sell, tenBps)
		// 2段目: 100.3995 − 100.5004 < 0 → 取り込まない
		assertEq(t, "Quantity", r.Quantity, "1")
		if r.DepthExhausted {
			t.Fatal("2段目が残っているので DepthExhausted=false")
		}
	})

	t.Run("売り先の板を使い切った場合も DepthExhausted", func(t *testing.T) {
		t.Parallel()
		buy := book("binance", nil, []domain.Level{lv("100", "10")})
		sell := book("okx", []domain.Level{lv("101", "1"), lv("100.5", "1")}, nil)

		r, _ := arbitrage.Evaluate(buy, sell, noFees)
		assertEq(t, "Quantity", r.Quantity, "2")
		if !r.DepthExhausted {
			t.Fatal("売り先の板を使い切ったので DepthExhausted=true")
		}
	})

	t.Run("平均約定価格は加重平均", func(t *testing.T) {
		t.Parallel()
		buy := book("binance", nil, []domain.Level{lv("100", "1"), lv("102", "1")})
		sell := book("okx", []domain.Level{lv("104", "2")}, nil)

		r, _ := arbitrage.Evaluate(buy, sell, noFees)
		assertEq(t, "Quantity", r.Quantity, "2")
		assertEq(t, "AvgBuyPrice", r.AvgBuyPrice, "101")
		assertEq(t, "AvgSellPrice", r.AvgSellPrice, "104")
	})
}

func TestEvaluate_AtMostOneDirectionIsProfitable(t *testing.T) {
	t.Parallel()
	// 同一取引所内で bid < ask が保証されている限り、両方向が同時に黒字になることはない。
	a := book("binance", []domain.Level{lv("100", "1")}, []domain.Level{lv("100.2", "1")})
	b := book("okx", []domain.Level{lv("100.3", "1")}, []domain.Level{lv("100.5", "1")})

	ab, _ := arbitrage.Evaluate(a, b, noFees) // binance で買い okx で売り: 100.3 − 100.2 = +0.1
	ba, _ := arbitrage.Evaluate(b, a, noFees) // okx で買い binance で売り: 100 − 100.5 = −0.5
	if !ab.Profitable || ba.Profitable {
		t.Fatalf("ab=%v ba=%v", ab.Profitable, ba.Profitable)
	}
}
