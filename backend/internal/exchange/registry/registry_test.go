package registry_test

import (
	"testing"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange/registry"
)

type nopSink struct{}

func (nopSink) UpdateBook(domain.OrderBook) error  { return nil }
func (nopSink) SetConnected(domain.Exchange, bool) {}

func TestNewFeed(t *testing.T) {
	t.Parallel()
	cfg := exchange.FeedConfig{Pairs: []domain.Pair{{Base: "BTC", Quote: "USDT"}}, Sink: nopSink{}}

	for _, id := range []domain.Exchange{"binance", "okx"} {
		feed, err := registry.NewFeed(id, cfg)
		if err != nil {
			t.Fatalf("%s: %v", id, err)
		}
		if feed.Exchange() != id {
			t.Fatalf("Exchange=%s want=%s", feed.Exchange(), id)
		}
	}
	if _, err := registry.NewFeed("bybit", cfg); err == nil {
		t.Fatal("未対応の取引所はエラー")
	}
}

func TestSupportedIDs(t *testing.T) {
	t.Parallel()
	ids := registry.SupportedIDs()
	if len(ids) != 2 || ids[0] != "binance" || ids[1] != "okx" {
		t.Fatalf("ids=%v", ids)
	}
	if e, ok := registry.Lookup("okx"); !ok || e.Name != "OKX" || e.DefaultURL == "" {
		t.Fatalf("Lookup=%+v ok=%v", e, ok)
	}
}
