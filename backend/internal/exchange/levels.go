package exchange

import (
	"fmt"
	"strings"

	"github.com/shopspring/decimal"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
)

// ParseLevel は "price qty" 形式の文字列を Level にする。数量 0 の段は keep=false で返す。
// ParseLevels に渡す既定の変換関数。
func ParseLevel(s string) (domain.Level, bool, error) {
	priceStr, qtyStr, ok := strings.Cut(s, " ")
	if !ok {
		return domain.Level{}, false, fmt.Errorf("板の段の形式が不正です: %q", s)
	}
	price, err := decimal.NewFromString(priceStr)
	if err != nil {
		return domain.Level{}, false, fmt.Errorf("価格を解釈できません: %q: %w", priceStr, err)
	}
	qty, err := decimal.NewFromString(qtyStr)
	if err != nil {
		return domain.Level{}, false, fmt.Errorf("数量を解釈できません: %q: %w", qtyStr, err)
	}
	if qty.IsZero() {
		return domain.Level{}, false, nil
	}
	return domain.Level{Price: price, Quantity: qty}, true, nil
}
