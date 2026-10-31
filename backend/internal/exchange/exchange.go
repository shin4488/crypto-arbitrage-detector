// Package exchange は取引所フィードの共通インターフェースを定義する。
// 個々の取引所の実装（binance, okx）はこのパッケージに依存し、エンジン側はこのインターフェースだけを見る。
package exchange

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/shopspring/decimal"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
)

// Sink はフィードが受信した板と接続状態の受け渡し先（通常はエンジン）。
type Sink interface {
	UpdateBook(book domain.OrderBook) error
	SetConnected(ex domain.Exchange, connected bool)
}

// Feed は1つの取引所への接続を表す。
type Feed interface {
	Exchange() domain.Exchange
	// Run は ctx が終わるまで接続を維持し、受信した板を Sink へ渡し続ける。
	Run(ctx context.Context)
}

// FeedConfig はフィード共通の設定。
type FeedConfig struct {
	// URL は接続先。空なら各取引所の既定 URL を使う。
	URL   string
	Pairs []domain.Pair
	Sink  Sink
	// Logger は nil なら slog.Default()。
	Logger *slog.Logger
	// Now は受信時刻の取得関数。nil なら time.Now。
	Now func() time.Time
}

// Normalize は未設定の項目に既定値を入れる。
func (c FeedConfig) Normalize() FeedConfig {
	if c.Logger == nil {
		c.Logger = slog.Default()
	}
	if c.Now == nil {
		c.Now = time.Now
	}
	return c
}

// ParseLevels は [["price","qty", ...], ...] 形式の板を Level に変換する共通処理。
// 数量が 0 の段は除外する（取引所によっては「この段が消えた」という意味で送ってくる）。
// 1段の要素数は取引所によって違う（OKX は4要素）ので、先頭の2要素（価格・数量）だけを使う。
func ParseLevels(raw [][]string) ([]domain.Level, error) {
	levels := make([]domain.Level, 0, len(raw))
	for _, entry := range raw {
		if len(entry) < 2 {
			continue
		}
		price, err := decimal.NewFromString(entry[0])
		if err != nil {
			return nil, fmt.Errorf("価格を解釈できません: %q: %w", entry[0], err)
		}
		qty, err := decimal.NewFromString(entry[1])
		if err != nil {
			return nil, fmt.Errorf("数量を解釈できません: %q: %w", entry[1], err)
		}
		if qty.IsZero() {
			continue
		}
		levels = append(levels, domain.Level{Price: price, Quantity: qty})
	}
	return levels, nil
}
