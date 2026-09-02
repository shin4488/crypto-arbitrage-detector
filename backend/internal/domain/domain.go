// Package domain は、取引所・通貨ペア・板といったアプリ全体で共有する基本の型を定義する。
// 依存は decimal だけに絞り、どのパッケージからも気兼ねなく参照できるようにしている。
package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/shopspring/decimal"
)

// Exchange は取引所の識別子（"binance", "okx" など、小文字）。
// 表示名や手数料率などの属性は設定側で持ち、ドメイン上は識別子のみを扱う。
type Exchange string

// Pair は通貨ペア。Base を Quote 建てで売買する（例: BTC/USDT は BTC を USDT で売買）。
type Pair struct {
	Base  string
	Quote string
}

// ParsePair は "BTC/USDT" 形式の文字列を Pair に変換する。大文字に正規化する。
func ParsePair(s string) (Pair, error) {
	parts := strings.Split(strings.TrimSpace(s), "/")
	if len(parts) != 2 {
		return Pair{}, fmt.Errorf("通貨ペアは BASE/QUOTE 形式で指定してください: %q", s)
	}
	base, quote := strings.ToUpper(strings.TrimSpace(parts[0])), strings.ToUpper(strings.TrimSpace(parts[1]))
	if base == "" || quote == "" {
		return Pair{}, fmt.Errorf("通貨ペアの base/quote が空です: %q", s)
	}
	return Pair{Base: base, Quote: quote}, nil
}

// String は "BTC/USDT" 形式の表記を返す。ログや JSON のキーとして使う。
func (p Pair) String() string {
	return p.Base + "/" + p.Quote
}

// Level は板の1段（価格とその価格に並んでいる数量）。数量は Base 通貨建て。
type Level struct {
	Price    decimal.Decimal
	Quantity decimal.Decimal
}

// OrderBook は取引所から受信した板のスナップショット。
// 取引所ごとに取得段数は異なる（Binance は20段、OKX は5段）ため、板の末尾に達したかどうかを
// 利用側が判断できるように、受信した全段をそのまま保持する。
type OrderBook struct {
	Exchange Exchange
	Pair     Pair
	// Bids は買い注文（価格降順、先頭が最良bid）。
	Bids []Level
	// Asks は売り注文（価格昇順、先頭が最良ask）。
	Asks []Level
	// ReceivedAt はこのプロセスが受信した時刻。
	// 取引所の付与する時刻は取引所ごとに有無や時計のずれがあるため、比較には受信時刻を使う。
	ReceivedAt time.Time
}

// BestBid は最良bid（最も高い買い注文）を返す。板が空なら ok=false。
func (b OrderBook) BestBid() (Level, bool) {
	if len(b.Bids) == 0 {
		return Level{}, false
	}
	return b.Bids[0], true
}

// BestAsk は最良ask（最も安い売り注文）を返す。板が空なら ok=false。
func (b OrderBook) BestAsk() (Level, bool) {
	if len(b.Asks) == 0 {
		return Level{}, false
	}
	return b.Asks[0], true
}

// Validate は板の整合性を検査する。取引所から届いたデータをそのまま信じて誤検知しないための防御。
func (b OrderBook) Validate() error {
	if b.Exchange == "" {
		return errors.New("取引所が未設定です")
	}
	if b.ReceivedAt.IsZero() {
		return errors.New("受信時刻が未設定です")
	}
	if err := validateLevels(b.Bids, false); err != nil {
		return fmt.Errorf("bid: %w", err)
	}
	if err := validateLevels(b.Asks, true); err != nil {
		return fmt.Errorf("ask: %w", err)
	}
	if bid, ok := b.BestBid(); ok {
		if ask, ok := b.BestAsk(); ok && bid.Price.GreaterThanOrEqual(ask.Price) {
			return fmt.Errorf("板が交差しています: bid=%s ask=%s", bid.Price, ask.Price)
		}
	}
	return nil
}

// validateLevels は各段の価格・数量が正で、価格が単調（ascending なら昇順、そうでなければ降順）であることを確認する。
func validateLevels(levels []Level, ascending bool) error {
	for i, l := range levels {
		if !l.Price.IsPositive() {
			return fmt.Errorf("%d段目の価格が正ではありません: %s", i, l.Price)
		}
		if !l.Quantity.IsPositive() {
			return fmt.Errorf("%d段目の数量が正ではありません: %s", i, l.Quantity)
		}
		if i == 0 {
			continue
		}
		prev := levels[i-1].Price
		if ascending && !l.Price.GreaterThan(prev) {
			return fmt.Errorf("%d段目の価格が昇順ではありません: %s <= %s", i, l.Price, prev)
		}
		if !ascending && !l.Price.LessThan(prev) {
			return fmt.Errorf("%d段目の価格が降順ではありません: %s >= %s", i, l.Price, prev)
		}
	}
	return nil
}
