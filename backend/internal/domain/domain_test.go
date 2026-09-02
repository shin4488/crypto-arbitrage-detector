package domain_test

import (
	"testing"
	"time"

	"github.com/shopspring/decimal"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
)

func TestParsePair(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   string
		want    domain.Pair
		wantErr bool
	}{
		{name: "BASE/QUOTE 形式を解釈できる", input: "BTC/USDT", want: domain.Pair{Base: "BTC", Quote: "USDT"}},
		{name: "小文字は大文字に正規化する", input: "eth/usdt", want: domain.Pair{Base: "ETH", Quote: "USDT"}},
		{name: "前後の空白は無視する", input: " BTC/USDT ", want: domain.Pair{Base: "BTC", Quote: "USDT"}},
		{name: "区切りがなければエラー", input: "BTCUSDT", wantErr: true},
		{name: "区切りが複数あればエラー", input: "BTC/USDT/X", wantErr: true},
		{name: "baseが空ならエラー", input: "/USDT", wantErr: true},
		{name: "quoteが空ならエラー", input: "BTC/", wantErr: true},
		{name: "空文字はエラー", input: "", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := domain.ParsePair(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("エラーを期待したが nil だった: got=%v", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("予期しないエラー: %v", err)
			}
			if got != tt.want {
				t.Fatalf("got=%v want=%v", got, tt.want)
			}
		})
	}
}

func TestPairString(t *testing.T) {
	t.Parallel()
	p := domain.Pair{Base: "BTC", Quote: "USDT"}
	if got := p.String(); got != "BTC/USDT" {
		t.Fatalf("got=%q want=%q", got, "BTC/USDT")
	}
}

func lv(price, qty string) domain.Level {
	return domain.Level{Price: decimal.RequireFromString(price), Quantity: decimal.RequireFromString(qty)}
}

func TestOrderBookBest(t *testing.T) {
	t.Parallel()

	t.Run("最良気配は先頭の段", func(t *testing.T) {
		t.Parallel()
		book := domain.OrderBook{
			Bids: []domain.Level{lv("100", "1"), lv("99", "2")},
			Asks: []domain.Level{lv("101", "3"), lv("102", "4")},
		}
		bid, ok := book.BestBid()
		if !ok || !bid.Price.Equal(decimal.NewFromInt(100)) {
			t.Fatalf("BestBid got=%v ok=%v", bid, ok)
		}
		ask, ok := book.BestAsk()
		if !ok || !ask.Price.Equal(decimal.NewFromInt(101)) {
			t.Fatalf("BestAsk got=%v ok=%v", ask, ok)
		}
	})

	t.Run("板が空なら ok=false", func(t *testing.T) {
		t.Parallel()
		var book domain.OrderBook
		if _, ok := book.BestBid(); ok {
			t.Fatal("空のbidで ok=true になった")
		}
		if _, ok := book.BestAsk(); ok {
			t.Fatal("空のaskで ok=true になった")
		}
	})
}

func TestOrderBookValidate(t *testing.T) {
	t.Parallel()

	now := time.Now()
	valid := func() domain.OrderBook {
		return domain.OrderBook{
			Exchange:   "binance",
			Pair:       domain.Pair{Base: "BTC", Quote: "USDT"},
			Bids:       []domain.Level{lv("100", "1"), lv("99", "2")},
			Asks:       []domain.Level{lv("101", "3"), lv("102", "4")},
			ReceivedAt: now,
		}
	}

	tests := []struct {
		name    string
		mutate  func(*domain.OrderBook)
		wantErr bool
	}{
		{name: "正しい板は妥当", mutate: func(*domain.OrderBook) {}},
		{name: "片側が空でも妥当（一時的にあり得る）", mutate: func(b *domain.OrderBook) { b.Bids = nil }},
		{name: "取引所が空ならエラー", mutate: func(b *domain.OrderBook) { b.Exchange = "" }, wantErr: true},
		{name: "bidが降順でなければエラー", mutate: func(b *domain.OrderBook) { b.Bids = []domain.Level{lv("99", "1"), lv("100", "1")} }, wantErr: true},
		{name: "askが昇順でなければエラー", mutate: func(b *domain.OrderBook) { b.Asks = []domain.Level{lv("102", "1"), lv("101", "1")} }, wantErr: true},
		{name: "同じ価格が並んでもエラー", mutate: func(b *domain.OrderBook) { b.Asks = []domain.Level{lv("101", "1"), lv("101", "1")} }, wantErr: true},
		{name: "価格が0以下ならエラー", mutate: func(b *domain.OrderBook) { b.Asks = []domain.Level{lv("0", "1")} }, wantErr: true},
		{name: "数量が0以下ならエラー", mutate: func(b *domain.OrderBook) { b.Bids = []domain.Level{lv("100", "0")} }, wantErr: true},
		{name: "最良bidが最良ask以上なら交差しておりエラー", mutate: func(b *domain.OrderBook) { b.Bids = []domain.Level{lv("101", "1")} }, wantErr: true},
		{name: "受信時刻が未設定ならエラー", mutate: func(b *domain.OrderBook) { b.ReceivedAt = time.Time{} }, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			book := valid()
			tt.mutate(&book)
			err := book.Validate()
			if tt.wantErr && err == nil {
				t.Fatal("エラーを期待したが nil だった")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("予期しないエラー: %v", err)
			}
		})
	}
}
