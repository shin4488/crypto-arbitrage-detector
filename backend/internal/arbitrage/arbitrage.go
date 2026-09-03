// Package arbitrage は、2つの取引所の板から裁定機会を評価する計算だけを担当する。
// 状態を持たない純粋関数なので、接続や配信の都合と切り離して、仕様どおりに動くことをテストで確かめやすい。
package arbitrage

import (
	"github.com/shopspring/decimal"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
)

// Fees は評価に使う taker 手数料率（0.001 = 0.1%）。
// 裁定は板に並んだ注文を即座に取る（taker）前提なので maker 手数料は考慮しない。
type Fees struct {
	// Buy は買い元取引所の手数料率。
	Buy decimal.Decimal
	// Sell は売り先取引所の手数料率。
	Sell decimal.Decimal
}

// Result は「買い元で買って売り先で売る」方向の評価結果。
//
// 手数料の扱い: 実際の取引所は買いの手数料を受け取った Base 通貨から差し引くことが多いが、
// ここでは損益を Quote 通貨（USDT）に統一するため、買いは約定代金への上乗せ、
// 売りは受取代金からの控除として計算する。
type Result struct {
	BuyExchange  domain.Exchange
	SellExchange domain.Exchange

	// BestAsk は買い元の最良ask、BestBid は売り先の最良bid。
	BestAsk domain.Level
	BestBid domain.Level

	// GrossSpread は最良気配ベースの1単位あたり価格差（BestBid − BestAsk）。手数料前。負になり得る。
	GrossSpread decimal.Decimal
	// GrossSpreadRatio は GrossSpread / BestAsk.Price。
	GrossSpreadRatio decimal.Decimal
	// NetSpread は最良気配ベースの1単位あたり手数料込み損益。負になり得る。
	NetSpread decimal.Decimal
	// Profitable は NetSpread > 0 かどうか。これより下の板走査の結果は、Profitable のときだけ意味がある。
	Profitable bool

	// Quantity は手数料込みで利益が出る範囲で板を突き合わせて得た取引可能数量（Base 通貨建て）。
	Quantity decimal.Decimal
	// BuyCost は買いの約定代金（手数料前）、SellProceeds は売りの受取代金（手数料前）。
	BuyCost      decimal.Decimal
	SellProceeds decimal.Decimal
	BuyFee       decimal.Decimal
	SellFee      decimal.Decimal
	// GrossProfit は SellProceeds − BuyCost、NetProfit はそこから両手数料を引いた純利益。
	GrossProfit decimal.Decimal
	NetProfit   decimal.Decimal
	// AvgBuyPrice / AvgSellPrice は数量加重の平均約定価格。
	AvgBuyPrice  decimal.Decimal
	AvgSellPrice decimal.Decimal
	// DepthExhausted は、まだ利益が出る状態のまま受信済みの板を使い切ったことを示す。
	// 取引所から受け取る板の段数には上限があるため、真なら実際の機会はこの結果より大きい可能性がある。
	DepthExhausted bool
}

// Evaluate は buy 取引所の ask と sell 取引所の bid を突き合わせ、裁定機会を評価する。
// どちらかの板が空で評価できない場合は ok=false を返す。
func Evaluate(buy, sell domain.OrderBook, fees Fees) (Result, bool) {
	bestAsk, okAsk := buy.BestAsk()
	bestBid, okBid := sell.BestBid()
	if !okAsk || !okBid {
		return Result{}, false
	}

	buyMultiplier := decimal.NewFromInt(1).Add(fees.Buy)   // 1 + 買い手数料率
	sellMultiplier := decimal.NewFromInt(1).Sub(fees.Sell) // 1 − 売り手数料率

	// 1単位あたりの手数料込み損益。板の各段の採否もこの式で判断する。
	netPerUnit := func(ask, bid decimal.Decimal) decimal.Decimal {
		return bid.Mul(sellMultiplier).Sub(ask.Mul(buyMultiplier))
	}

	r := Result{
		BuyExchange:  buy.Exchange,
		SellExchange: sell.Exchange,
		BestAsk:      bestAsk,
		BestBid:      bestBid,
		GrossSpread:  bestBid.Price.Sub(bestAsk.Price),
		NetSpread:    netPerUnit(bestAsk.Price, bestBid.Price),
	}
	r.GrossSpreadRatio = r.GrossSpread.Div(bestAsk.Price)
	r.Profitable = r.NetSpread.IsPositive()
	if !r.Profitable {
		return r, true
	}

	walk(&r, buy.Asks, sell.Bids, netPerUnit)

	r.BuyFee = r.BuyCost.Mul(fees.Buy)
	r.SellFee = r.SellProceeds.Mul(fees.Sell)
	r.GrossProfit = r.SellProceeds.Sub(r.BuyCost)
	r.NetProfit = r.GrossProfit.Sub(r.BuyFee).Sub(r.SellFee)
	r.AvgBuyPrice = r.BuyCost.Div(r.Quantity)
	r.AvgSellPrice = r.SellProceeds.Div(r.Quantity)
	return r, true
}

// walk は ask（昇順）と bid（降順）を先頭から突き合わせ、手数料込みで利益が出る限り数量を積み上げる。
// 2本のポインタで同時に進めるため、計算量は段数の和に比例する。
func walk(r *Result, asks, bids []domain.Level, netPerUnit func(ask, bid decimal.Decimal) decimal.Decimal) {
	i, j := 0, 0
	askRemaining := asks[0].Quantity
	bidRemaining := bids[0].Quantity

	for i < len(asks) && j < len(bids) {
		ask, bid := asks[i], bids[j]
		if !netPerUnit(ask.Price, bid.Price).IsPositive() {
			// この段以降は逆ざや（板は単調なので、それより深い段も全て赤字）。
			return
		}
		q := decimal.Min(askRemaining, bidRemaining)
		r.Quantity = r.Quantity.Add(q)
		r.BuyCost = r.BuyCost.Add(q.Mul(ask.Price))
		r.SellProceeds = r.SellProceeds.Add(q.Mul(bid.Price))

		askRemaining = askRemaining.Sub(q)
		bidRemaining = bidRemaining.Sub(q)
		if askRemaining.IsZero() {
			i++
			if i < len(asks) {
				askRemaining = asks[i].Quantity
			}
		}
		if bidRemaining.IsZero() {
			j++
			if j < len(bids) {
				bidRemaining = bids[j].Quantity
			}
		}
	}
	// ここに来るのは、まだ黒字のままどちらかの板を使い切ったとき。
	r.DepthExhausted = true
}
