package engine_test

import (
	"sync"
	"testing"
	"time"

	"github.com/shopspring/decimal"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/engine"
)

var (
	btc = domain.Pair{Base: "BTC", Quote: "USDT"}
	eth = domain.Pair{Base: "ETH", Quote: "USDT"}
)

func d(s string) decimal.Decimal { return decimal.RequireFromString(s) }

func lv(price, qty string) domain.Level {
	return domain.Level{Price: d(price), Quantity: d(qty)}
}

// fakeClock はテストから時刻を進められる時計。
type fakeClock struct {
	mu  sync.Mutex
	now time.Time
}

func newFakeClock() *fakeClock {
	return &fakeClock{now: time.Date(2026, 9, 2, 12, 0, 0, 0, time.UTC)}
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) Advance(dur time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(dur)
}

// recorder はエンジンから通知されたイベントを記録する。
type recorder struct {
	mu     sync.Mutex
	events []engine.Event
}

func (r *recorder) Listen(ev engine.Event) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, ev)
}

func (r *recorder) Events() []engine.Event {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]engine.Event(nil), r.events...)
}

func (r *recorder) Reset() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = nil
}

func (r *recorder) ofKind(kind engine.EventKind) []engine.Event {
	var out []engine.Event
	for _, ev := range r.Events() {
		if ev.Kind == kind {
			out = append(out, ev)
		}
	}
	return out
}

func defaultConfig(clock *fakeClock) engine.Config {
	return engine.Config{
		Exchanges: []engine.ExchangeInfo{
			{ID: "binance", Name: "Binance", TakerFeeRate: d("0.001")},
			{ID: "okx", Name: "OKX", TakerFeeRate: d("0.001")},
		},
		Pairs:        []domain.Pair{btc, eth},
		HistoryLimit: 100,
		Now:          clock.Now,
	}
}

func newEngine(t *testing.T) (*engine.Engine, *fakeClock, *recorder) {
	t.Helper()
	clock := newFakeClock()
	e, err := engine.New(defaultConfig(clock))
	if err != nil {
		t.Fatalf("engine.New: %v", err)
	}
	rec := &recorder{}
	e.AddListener(rec.Listen)
	return e, clock, rec
}

func book(ex domain.Exchange, pair domain.Pair, at time.Time, bid, ask domain.Level) domain.OrderBook {
	return domain.OrderBook{Exchange: ex, Pair: pair, Bids: []domain.Level{bid}, Asks: []domain.Level{ask}, ReceivedAt: at}
}

func mustUpdate(t *testing.T, e *engine.Engine, b domain.OrderBook) {
	t.Helper()
	if err := e.UpdateBook(b); err != nil {
		t.Fatalf("UpdateBook: %v", err)
	}
}

func TestNew_ValidatesConfig(t *testing.T) {
	t.Parallel()
	clock := newFakeClock()

	tests := []struct {
		name   string
		mutate func(*engine.Config)
	}{
		{"取引所が1つ以下", func(c *engine.Config) { c.Exchanges = c.Exchanges[:1] }},
		{"取引所IDが重複", func(c *engine.Config) { c.Exchanges[1].ID = c.Exchanges[0].ID }},
		{"取引所IDが空", func(c *engine.Config) { c.Exchanges[0].ID = "" }},
		{"手数料率が負", func(c *engine.Config) { c.Exchanges[0].TakerFeeRate = d("-0.001") }},
		{"手数料率が1以上", func(c *engine.Config) { c.Exchanges[0].TakerFeeRate = d("1") }},
		{"通貨ペアが空", func(c *engine.Config) { c.Pairs = nil }},
		{"通貨ペアが重複", func(c *engine.Config) { c.Pairs = []domain.Pair{btc, btc} }},
		{"履歴上限が0以下", func(c *engine.Config) { c.HistoryLimit = 0 }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			cfg := defaultConfig(clock)
			tt.mutate(&cfg)
			if _, err := engine.New(cfg); err == nil {
				t.Fatal("エラーを期待した")
			}
		})
	}

	t.Run("Now が未指定なら実時刻を使う", func(t *testing.T) {
		t.Parallel()
		cfg := defaultConfig(clock)
		cfg.Now = nil
		if _, err := engine.New(cfg); err != nil {
			t.Fatalf("予期しないエラー: %v", err)
		}
	})
}

func TestUpdateBook_Rejects(t *testing.T) {
	t.Parallel()
	e, clock, _ := newEngine(t)
	now := clock.Now()

	t.Run("未知の取引所", func(t *testing.T) {
		if err := e.UpdateBook(book("bybit", btc, now, lv("99", "1"), lv("100", "1"))); err == nil {
			t.Fatal("エラーを期待した")
		}
	})
	t.Run("未知の通貨ペア", func(t *testing.T) {
		if err := e.UpdateBook(book("binance", domain.Pair{Base: "SOL", Quote: "USDT"}, now, lv("99", "1"), lv("100", "1"))); err == nil {
			t.Fatal("エラーを期待した")
		}
	})
	t.Run("不正な板", func(t *testing.T) {
		if err := e.UpdateBook(book("binance", btc, now, lv("101", "1"), lv("100", "1"))); err == nil {
			t.Fatal("交差した板はエラーを期待した")
		}
	})
}

func TestUpdateBook_PublishesPairSnapshot(t *testing.T) {
	t.Parallel()
	e, clock, rec := newEngine(t)
	now := clock.Now()

	t.Run("片方の取引所だけでは気配のみで方向は評価しない", func(t *testing.T) {
		mustUpdate(t, e, book("binance", btc, now, lv("100", "1"), lv("100.5", "1")))

		evs := rec.ofKind(engine.EventPairUpdated)
		if len(evs) != 1 {
			t.Fatalf("PairUpdated が1件のはず: %d", len(evs))
		}
		snap := evs[0].Pair
		if snap.Pair != btc {
			t.Fatalf("pair=%v", snap.Pair)
		}
		if len(snap.Quotes) != 1 || !snap.Quotes["binance"].Bid.Price.Equal(d("100")) {
			t.Fatalf("quotes=%+v", snap.Quotes)
		}
		if len(snap.Directions) != 0 {
			t.Fatalf("方向は評価できないはず: %+v", snap.Directions)
		}
		if !snap.UpdatedAt.Equal(now) {
			t.Fatalf("UpdatedAt=%v", snap.UpdatedAt)
		}
	})

	t.Run("両方の取引所が揃うと両方向を評価する", func(t *testing.T) {
		rec.Reset()
		mustUpdate(t, e, book("okx", btc, now, lv("100.4", "2"), lv("100.6", "1")))

		evs := rec.ofKind(engine.EventPairUpdated)
		if len(evs) != 1 {
			t.Fatalf("PairUpdated が1件のはず: %d", len(evs))
		}
		snap := evs[0].Pair
		if len(snap.Quotes) != 2 {
			t.Fatalf("quotes=%+v", snap.Quotes)
		}
		if len(snap.Directions) != 2 {
			t.Fatalf("方向は2つのはず: %+v", snap.Directions)
		}
		// 設定順に「binance→okx」「okx→binance」
		if snap.Directions[0].BuyExchange != "binance" || snap.Directions[0].SellExchange != "okx" {
			t.Fatalf("directions[0]=%s→%s", snap.Directions[0].BuyExchange, snap.Directions[0].SellExchange)
		}
		if snap.Directions[1].BuyExchange != "okx" || snap.Directions[1].SellExchange != "binance" {
			t.Fatalf("directions[1]=%s→%s", snap.Directions[1].BuyExchange, snap.Directions[1].SellExchange)
		}
		// binance ask 100.5 → okx bid 100.4: 逆ざや。okx ask 100.6 → binance bid 100: 逆ざや。
		for _, dir := range snap.Directions {
			if dir.Profitable {
				t.Fatalf("機会なしのはず: %+v", dir)
			}
		}
	})

	t.Run("別ペアの更新は別のスナップショットになる", func(t *testing.T) {
		rec.Reset()
		mustUpdate(t, e, book("binance", eth, now, lv("10", "1"), lv("10.1", "1")))
		evs := rec.ofKind(engine.EventPairUpdated)
		if len(evs) != 1 || evs[0].Pair.Pair != eth {
			t.Fatalf("evs=%+v", evs)
		}
	})
}

func TestEpisodeLifecycle(t *testing.T) {
	t.Parallel()
	e, clock, rec := newEngine(t)

	// binance ask 100 で買って okx bid 101 で売れる状態を作る（手数料 0.1% ずつでも黒字）。
	mustUpdate(t, e, book("binance", btc, clock.Now(), lv("99", "1"), lv("100", "1")))
	rec.Reset()
	mustUpdate(t, e, book("okx", btc, clock.Now(), lv("101", "1"), lv("102", "1")))

	var episodeID uint64
	t.Run("黒字になった瞬間に機会が始まる", func(t *testing.T) {
		evs := rec.ofKind(engine.EventEpisodeChanged)
		if len(evs) != 1 {
			t.Fatalf("EpisodeChanged が1件のはず: %d", len(evs))
		}
		ep := evs[0].Episode
		episodeID = ep.ID
		if ep.Pair != btc || ep.BuyExchange != "binance" || ep.SellExchange != "okx" {
			t.Fatalf("episode=%+v", ep)
		}
		if !ep.StartedAt.Equal(clock.Now()) || !ep.EndedAt.IsZero() {
			t.Fatalf("開始時刻/終了時刻が不正: %+v", ep)
		}
		// 純利益: 101×0.999 − 100×1.001 = 100.899 − 100.1 = 0.799
		if !ep.MaxNetProfit.Equal(d("0.799")) || !ep.QuantityAtMax.Equal(d("1")) {
			t.Fatalf("最大純利益が不正: %+v", ep)
		}
		if ep.ID == 0 {
			t.Fatal("ID は 1 以上")
		}
	})

	t.Run("純利益が増えたら最大値を更新して通知する", func(t *testing.T) {
		rec.Reset()
		clock.Advance(500 * time.Millisecond)
		mustUpdate(t, e, book("okx", btc, clock.Now(), lv("101.5", "1"), lv("102", "1")))

		evs := rec.ofKind(engine.EventEpisodeChanged)
		if len(evs) != 1 {
			t.Fatalf("EpisodeChanged が1件のはず: %d", len(evs))
		}
		ep := evs[0].Episode
		if ep.ID != episodeID {
			t.Fatalf("同じ機会が続いているはず: id=%d want=%d", ep.ID, episodeID)
		}
		// 101.5×0.999 − 100.1 = 101.3985 − 100.1 = 1.2985
		if !ep.MaxNetProfit.Equal(d("1.2985")) {
			t.Fatalf("MaxNetProfit=%s", ep.MaxNetProfit)
		}
		if !ep.MaxNetProfitAt.Equal(clock.Now()) {
			t.Fatalf("MaxNetProfitAt=%v", ep.MaxNetProfitAt)
		}
	})

	t.Run("純利益が減っても機会は続き、通知はしない", func(t *testing.T) {
		rec.Reset()
		clock.Advance(500 * time.Millisecond)
		mustUpdate(t, e, book("okx", btc, clock.Now(), lv("101.2", "1"), lv("102", "1")))

		if evs := rec.ofKind(engine.EventEpisodeChanged); len(evs) != 0 {
			t.Fatalf("EpisodeChanged は無いはず: %+v", evs)
		}
		if evs := rec.ofKind(engine.EventPairUpdated); len(evs) != 1 {
			t.Fatalf("PairUpdated は届く: %d", len(evs))
		}
	})

	t.Run("赤字に戻ったら機会が終わる", func(t *testing.T) {
		rec.Reset()
		clock.Advance(time.Second)
		mustUpdate(t, e, book("okx", btc, clock.Now(), lv("100", "1"), lv("100.5", "1")))

		evs := rec.ofKind(engine.EventEpisodeChanged)
		if len(evs) != 1 {
			t.Fatalf("EpisodeChanged が1件のはず: %d", len(evs))
		}
		ep := evs[0].Episode
		if ep.ID != episodeID || !ep.EndedAt.Equal(clock.Now()) {
			t.Fatalf("終了が記録されていない: %+v", ep)
		}
		if !ep.MaxNetProfit.Equal(d("1.2985")) {
			t.Fatalf("最大値は保持される: %s", ep.MaxNetProfit)
		}
	})

	t.Run("再び黒字になれば新しい機会として記録する", func(t *testing.T) {
		rec.Reset()
		clock.Advance(time.Second)
		mustUpdate(t, e, book("okx", btc, clock.Now(), lv("101", "1"), lv("102", "1")))

		evs := rec.ofKind(engine.EventEpisodeChanged)
		if len(evs) != 1 || evs[0].Episode.ID == episodeID {
			t.Fatalf("新しい ID の機会のはず: %+v", evs)
		}
		hist := e.Snapshot().History
		if len(hist) != 2 {
			t.Fatalf("履歴は2件: %d", len(hist))
		}
		if hist[0].ID <= hist[1].ID {
			t.Fatalf("履歴は新しい順: %d, %d", hist[0].ID, hist[1].ID)
		}
	})
}

func TestExchangeConnectionStatus(t *testing.T) {
	t.Parallel()
	e, clock, rec := newEngine(t)

	e.SetConnected("binance", true)
	e.SetConnected("okx", true)
	mustUpdate(t, e, book("binance", btc, clock.Now(), lv("99", "1"), lv("100", "1")))
	mustUpdate(t, e, book("okx", btc, clock.Now(), lv("101", "1"), lv("102", "1")))
	mustUpdate(t, e, book("binance", eth, clock.Now(), lv("10", "1"), lv("10.1", "1")))
	rec.Reset()

	t.Run("切断すると板が消え、機会も終わり、状態変化を通知する", func(t *testing.T) {
		clock.Advance(time.Second)
		e.SetConnected("okx", false)

		statuses := rec.ofKind(engine.EventExchangeStatusChanged)
		if len(statuses) != 1 || statuses[0].Status.Exchange != "okx" || statuses[0].Status.Connected {
			t.Fatalf("status events=%+v", statuses)
		}
		if !statuses[0].Status.Since.Equal(clock.Now()) {
			t.Fatalf("Since=%v", statuses[0].Status.Since)
		}

		// okx の板があった BTC だけ更新される（ETH は okx の板が無かったので変化なし）
		pairs := rec.ofKind(engine.EventPairUpdated)
		if len(pairs) != 1 || pairs[0].Pair.Pair != btc {
			t.Fatalf("pair events=%+v", pairs)
		}
		if _, ok := pairs[0].Pair.Quotes["okx"]; ok {
			t.Fatal("okx の気配は消えるはず")
		}
		if len(pairs[0].Pair.Directions) != 0 {
			t.Fatal("方向は評価できないはず")
		}

		eps := rec.ofKind(engine.EventEpisodeChanged)
		if len(eps) != 1 || eps[0].Episode.EndedAt.IsZero() {
			t.Fatalf("進行中の機会は終了するはず: %+v", eps)
		}
	})

	t.Run("同じ状態への変更は通知しない", func(t *testing.T) {
		rec.Reset()
		e.SetConnected("okx", false)
		if evs := rec.Events(); len(evs) != 0 {
			t.Fatalf("イベントは無いはず: %+v", evs)
		}
	})

	t.Run("再接続で状態が戻る", func(t *testing.T) {
		rec.Reset()
		e.SetConnected("okx", true)
		statuses := rec.ofKind(engine.EventExchangeStatusChanged)
		if len(statuses) != 1 || !statuses[0].Status.Connected {
			t.Fatalf("status events=%+v", statuses)
		}
	})

	t.Run("未知の取引所は無視する", func(t *testing.T) {
		rec.Reset()
		e.SetConnected("bybit", true)
		if evs := rec.Events(); len(evs) != 0 {
			t.Fatalf("イベントは無いはず: %+v", evs)
		}
	})
}

func TestSnapshot(t *testing.T) {
	t.Parallel()
	e, clock, _ := newEngine(t)

	t.Run("初期状態でも全ペア・全取引所が含まれる", func(t *testing.T) {
		s := e.Snapshot()
		if len(s.Exchanges) != 2 || s.Exchanges[0].ID != "binance" || s.Exchanges[1].ID != "okx" {
			t.Fatalf("exchanges=%+v", s.Exchanges)
		}
		if s.Exchanges[0].Name != "Binance" || !s.Exchanges[0].TakerFeeRate.Equal(d("0.001")) {
			t.Fatalf("exchange info=%+v", s.Exchanges[0])
		}
		if s.Exchanges[0].Connected {
			t.Fatal("初期状態は未接続")
		}
		if len(s.Pairs) != 2 || s.Pairs[0].Pair != btc || s.Pairs[1].Pair != eth {
			t.Fatalf("pairs=%+v", s.Pairs)
		}
		if len(s.History) != 0 {
			t.Fatalf("history=%+v", s.History)
		}
	})

	t.Run("更新後は最新の板を反映する", func(t *testing.T) {
		e.SetConnected("binance", true)
		mustUpdate(t, e, book("binance", btc, clock.Now(), lv("99", "1"), lv("100", "1")))
		s := e.Snapshot()
		if !s.Exchanges[0].Connected {
			t.Fatal("binance は接続中")
		}
		if q, ok := s.Pairs[0].Quotes["binance"]; !ok || !q.Ask.Price.Equal(d("100")) {
			t.Fatalf("quotes=%+v", s.Pairs[0].Quotes)
		}
	})

	t.Run("スナップショットは呼び出し側で変更しても内部に影響しない", func(t *testing.T) {
		s := e.Snapshot()
		delete(s.Pairs[0].Quotes, "binance")
		if _, ok := e.Snapshot().Pairs[0].Quotes["binance"]; !ok {
			t.Fatal("内部状態が書き換わった")
		}
	})
}

func TestHistoryLimit(t *testing.T) {
	t.Parallel()
	clock := newFakeClock()
	cfg := defaultConfig(clock)
	cfg.HistoryLimit = 3
	e, err := engine.New(cfg)
	if err != nil {
		t.Fatal(err)
	}

	mustUpdate(t, e, book("binance", btc, clock.Now(), lv("99", "1"), lv("100", "1")))
	// 黒字と赤字を交互に作って機会を5回発生させる
	for i := 0; i < 5; i++ {
		clock.Advance(time.Second)
		mustUpdate(t, e, book("okx", btc, clock.Now(), lv("101", "1"), lv("102", "1")))
		clock.Advance(time.Second)
		mustUpdate(t, e, book("okx", btc, clock.Now(), lv("99.5", "1"), lv("100.5", "1")))
	}

	hist := e.Snapshot().History
	if len(hist) != 3 {
		t.Fatalf("履歴は上限の3件に収まる: %d", len(hist))
	}
	if hist[0].ID != 5 || hist[2].ID != 3 {
		t.Fatalf("新しい3件が残るはず: %d, %d, %d", hist[0].ID, hist[1].ID, hist[2].ID)
	}
}

func TestConcurrentUpdates(t *testing.T) {
	t.Parallel()
	e, clock, _ := newEngine(t)

	var wg sync.WaitGroup
	for _, ex := range []domain.Exchange{"binance", "okx"} {
		for _, pair := range []domain.Pair{btc, eth} {
			wg.Add(1)
			go func(ex domain.Exchange, pair domain.Pair) {
				defer wg.Done()
				for i := 0; i < 200; i++ {
					price := decimal.NewFromInt(100).Add(decimal.NewFromInt(int64(i % 7)))
					b := domain.OrderBook{
						Exchange:   ex,
						Pair:       pair,
						Bids:       []domain.Level{{Price: price, Quantity: d("1")}},
						Asks:       []domain.Level{{Price: price.Add(d("0.5")), Quantity: d("1")}},
						ReceivedAt: clock.Now(),
					}
					if err := e.UpdateBook(b); err != nil {
						t.Errorf("UpdateBook: %v", err)
						return
					}
				}
			}(ex, pair)
		}
	}
	wg.Wait()

	s := e.Snapshot()
	if len(s.Pairs) != 2 {
		t.Fatalf("pairs=%d", len(s.Pairs))
	}
}

func TestSequenceNumbers(t *testing.T) {
	t.Parallel()
	e, clock, rec := newEngine(t)

	if seq := e.Snapshot().Seq; seq != 0 {
		t.Fatalf("初期の Seq は 0: %d", seq)
	}
	mustUpdate(t, e, book("binance", btc, clock.Now(), lv("99", "1"), lv("100", "1")))
	mustUpdate(t, e, book("okx", btc, clock.Now(), lv("101", "1"), lv("102", "1")))

	evs := rec.Events()
	if len(evs) < 2 {
		t.Fatalf("イベントが少なすぎる: %d", len(evs))
	}
	for i := 1; i < len(evs); i++ {
		if evs[i].Seq != evs[i-1].Seq+1 {
			t.Fatalf("Seq は1ずつ増える: %d -> %d", evs[i-1].Seq, evs[i].Seq)
		}
	}
	if got := e.Snapshot().Seq; got != evs[len(evs)-1].Seq {
		t.Fatalf("スナップショットの Seq は最後のイベント番号: got=%d want=%d", got, evs[len(evs)-1].Seq)
	}
}
