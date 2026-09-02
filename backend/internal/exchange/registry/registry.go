// Package registry は取引所IDからフィード実装を引く。
// 新しい取引所を追加するときは、実装パッケージを作ってここに登録するだけでよい。
package registry

import (
	"fmt"
	"sort"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange/binance"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange/okx"
)

// Entry は登録された取引所の情報。
type Entry struct {
	Name       string
	DefaultURL string
	New        func(exchange.FeedConfig) exchange.Feed
}

var entries = map[domain.Exchange]Entry{
	binance.ID: {Name: binance.Name, DefaultURL: binance.DefaultURL, New: func(c exchange.FeedConfig) exchange.Feed { return binance.NewFeed(c) }},
	okx.ID:     {Name: okx.Name, DefaultURL: okx.DefaultURL, New: func(c exchange.FeedConfig) exchange.Feed { return okx.NewFeed(c) }},
}

// Lookup は取引所IDに対応する登録情報を返す。
func Lookup(id domain.Exchange) (Entry, bool) {
	e, ok := entries[id]
	return e, ok
}

// NewFeed は取引所IDに対応するフィードを作る。未対応ならエラー。
func NewFeed(id domain.Exchange, cfg exchange.FeedConfig) (exchange.Feed, error) {
	e, ok := entries[id]
	if !ok {
		return nil, fmt.Errorf("未対応の取引所です: %s（対応: %v）", id, SupportedIDs())
	}
	return e.New(cfg), nil
}

// SupportedIDs は対応している取引所IDの一覧（ソート済み）。
func SupportedIDs() []string {
	ids := make([]string, 0, len(entries))
	for id := range entries {
		ids = append(ids, string(id))
	}
	sort.Strings(ids)
	return ids
}
