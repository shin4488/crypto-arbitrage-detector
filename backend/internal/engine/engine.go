// Package engine は各取引所の最新の板を保持し、更新のたびに裁定機会を評価して結果を通知する。
// 取引所への接続や配信の仕組みからは独立しており、板を渡すと評価結果と機会の履歴が得られる。
package engine

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/shopspring/decimal"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/arbitrage"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
)

// ExchangeInfo は取引所の設定。
type ExchangeInfo struct {
	ID   domain.Exchange
	Name string
	// TakerFeeRate は taker 手数料率（0.001 = 0.1%）。
	TakerFeeRate decimal.Decimal
}

// Config はエンジンの設定。
type Config struct {
	// Exchanges は監視する取引所。順序は方向の評価順や画面の表示順として使う。
	Exchanges []ExchangeInfo
	Pairs     []domain.Pair
	// HistoryLimit は保持する機会履歴の最大件数。超えた分は古いものから捨てる。
	HistoryLimit int
	// Now は現在時刻の取得関数。nil なら time.Now。テストで固定時刻を使うために差し替えられる。
	Now func() time.Time
}

// Quote は取引所ごとの最良気配。
type Quote struct {
	Bid domain.Level
	Ask domain.Level
	// BidLevels / AskLevels は受信した板の段数。板の深さの目安として画面に出す。
	BidLevels int
	AskLevels int
	// UpdatedAt は板を受信した時刻。
	UpdatedAt time.Time
}

// PairSnapshot はある通貨ペアの現在の評価結果。
type PairSnapshot struct {
	Pair domain.Pair
	// Quotes は板を受信済みの取引所の最良気配。
	Quotes map[domain.Exchange]Quote
	// Directions は評価できた方向（両方の板がそろっているもの）の結果。取引所の設定順で「買い元→売り先」の全組み合わせ。
	Directions []arbitrage.Result
	UpdatedAt  time.Time
}

// ExchangeStatus は取引所の接続状態。
type ExchangeStatus struct {
	Exchange  domain.Exchange
	Connected bool
	// Since は現在の状態になった時刻。
	Since time.Time
}

// Episode は「ある方向で純利益が正であり続けた期間」を1件の機会として記録したもの。
type Episode struct {
	ID           uint64
	Pair         domain.Pair
	BuyExchange  domain.Exchange
	SellExchange domain.Exchange
	StartedAt    time.Time
	// EndedAt は機会が消えた時刻。ゼロ値なら継続中。
	EndedAt time.Time
	// 以下は純利益が最大だった時点の値。
	MaxNetProfit      decimal.Decimal
	MaxNetProfitAt    time.Time
	QuantityAtMax     decimal.Decimal
	AvgBuyPriceAtMax  decimal.Decimal
	AvgSellPriceAtMax decimal.Decimal
}

// EventKind はイベントの種類。
type EventKind int

const (
	// EventPairUpdated は通貨ペアの評価結果が更新された。
	EventPairUpdated EventKind = iota + 1
	// EventEpisodeChanged は機会が開始・更新（最大純利益の更新）・終了した。
	EventEpisodeChanged
	// EventExchangeStatusChanged は取引所の接続状態が変わった。
	EventExchangeStatusChanged
)

// Event は購読者への通知。Kind に応じたフィールドだけが設定される。
type Event struct {
	// Seq はエンジン全体で単調増加する通し番号。State.Seq と比較することで、
	// スナップショット取得前に発生した古いイベントを受信側が捨てられる。
	Seq     uint64
	Kind    EventKind
	Pair    *PairSnapshot
	Episode *Episode
	Status  *ExchangeStatus
}

// Listener はイベントを受け取る関数。
// エンジンのロック内から呼ばれるため、ブロックしたりエンジンを呼び返したりしてはならない。
// （ロック外で通知すると並行更新時に古い結果が後から届く可能性があるため、順序保証を優先している）
type Listener func(Event)

// ExchangeState は取引所の設定と接続状態をまとめたもの（スナップショット用）。
type ExchangeState struct {
	ExchangeInfo
	Connected bool
	Since     time.Time
}

// State はエンジンの全状態のコピー。接続直後のクライアントへ初期表示用に渡す。
type State struct {
	// Seq はこのスナップショット時点までに発行した最後のイベント番号。
	Seq       uint64
	Exchanges []ExchangeState
	Pairs     []PairSnapshot
	// History は機会の履歴（新しい順）。継続中のものも含む。
	History []Episode
}

// Engine は板を保持し、裁定機会を評価する。どのメソッドも並行に呼び出せる。
type Engine struct {
	cfg  Config
	fees map[domain.Exchange]decimal.Decimal

	mu        sync.Mutex
	books     map[domain.Exchange]map[domain.Pair]domain.OrderBook
	connected map[domain.Exchange]ExchangeStatus
	ongoing   map[episodeKey]*Episode
	history   []*Episode
	nextID    uint64
	seq       uint64
	listeners []Listener
}

type episodeKey struct {
	pair domain.Pair
	buy  domain.Exchange
	sell domain.Exchange
}

// New は設定を検証してエンジンを作る。
func New(cfg Config) (*Engine, error) {
	if err := validateConfig(cfg); err != nil {
		return nil, err
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	e := &Engine{
		cfg:       cfg,
		fees:      make(map[domain.Exchange]decimal.Decimal, len(cfg.Exchanges)),
		books:     make(map[domain.Exchange]map[domain.Pair]domain.OrderBook, len(cfg.Exchanges)),
		connected: make(map[domain.Exchange]ExchangeStatus, len(cfg.Exchanges)),
		ongoing:   make(map[episodeKey]*Episode),
	}
	now := cfg.Now()
	for _, ex := range cfg.Exchanges {
		e.fees[ex.ID] = ex.TakerFeeRate
		e.books[ex.ID] = make(map[domain.Pair]domain.OrderBook, len(cfg.Pairs))
		e.connected[ex.ID] = ExchangeStatus{Exchange: ex.ID, Connected: false, Since: now}
	}
	return e, nil
}

func validateConfig(cfg Config) error {
	if len(cfg.Exchanges) < 2 {
		return errors.New("取引所は2つ以上必要です")
	}
	seenEx := make(map[domain.Exchange]bool, len(cfg.Exchanges))
	one := decimal.NewFromInt(1)
	for _, ex := range cfg.Exchanges {
		if ex.ID == "" {
			return errors.New("取引所IDが空です")
		}
		if seenEx[ex.ID] {
			return fmt.Errorf("取引所IDが重複しています: %s", ex.ID)
		}
		seenEx[ex.ID] = true
		if ex.TakerFeeRate.IsNegative() || ex.TakerFeeRate.GreaterThanOrEqual(one) {
			return fmt.Errorf("取引所 %s の手数料率は 0 以上 1 未満で指定してください: %s", ex.ID, ex.TakerFeeRate)
		}
	}
	if len(cfg.Pairs) == 0 {
		return errors.New("通貨ペアは1つ以上必要です")
	}
	seenPair := make(map[domain.Pair]bool, len(cfg.Pairs))
	for _, p := range cfg.Pairs {
		if seenPair[p] {
			return fmt.Errorf("通貨ペアが重複しています: %s", p)
		}
		seenPair[p] = true
	}
	if cfg.HistoryLimit <= 0 {
		return errors.New("履歴上限は1以上で指定してください")
	}
	return nil
}

// AddListener はイベントの購読者を追加する。
func (e *Engine) AddListener(l Listener) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.listeners = append(e.listeners, l)
}

// UpdateBook は板を受け取り、対象ペアの裁定機会を再評価して通知する。
func (e *Engine) UpdateBook(book domain.OrderBook) error {
	if err := book.Validate(); err != nil {
		return fmt.Errorf("板が不正です: %w", err)
	}
	e.mu.Lock()
	defer e.mu.Unlock()

	books, ok := e.books[book.Exchange]
	if !ok {
		return fmt.Errorf("未知の取引所です: %s", book.Exchange)
	}
	if !e.knownPair(book.Pair) {
		return fmt.Errorf("未知の通貨ペアです: %s", book.Pair)
	}
	books[book.Pair] = book
	e.evaluatePair(book.Pair, e.cfg.Now())
	return nil
}

// SetConnected は取引所の接続状態を更新する。
// 切断時はその取引所の板を全て破棄する。古い板で誤った機会を出さないためで、
// 時間ベースの有効期限は設けない（更新頻度は市場の動き次第であり、閾値では判断できない）。
func (e *Engine) SetConnected(ex domain.Exchange, connected bool) {
	e.mu.Lock()
	defer e.mu.Unlock()

	status, ok := e.connected[ex]
	if !ok || status.Connected == connected {
		return
	}
	now := e.cfg.Now()
	status.Connected = connected
	status.Since = now
	e.connected[ex] = status
	e.emit(Event{Kind: EventExchangeStatusChanged, Status: &status})

	if connected {
		return
	}
	for pair := range e.books[ex] {
		delete(e.books[ex], pair)
		e.evaluatePair(pair, now)
	}
}

// Snapshot は現在の全状態のコピーを返す。
func (e *Engine) Snapshot() State {
	e.mu.Lock()
	defer e.mu.Unlock()

	s := State{
		Seq:       e.seq,
		Exchanges: make([]ExchangeState, 0, len(e.cfg.Exchanges)),
		Pairs:     make([]PairSnapshot, 0, len(e.cfg.Pairs)),
		History:   make([]Episode, 0, len(e.history)),
	}
	for _, ex := range e.cfg.Exchanges {
		st := e.connected[ex.ID]
		s.Exchanges = append(s.Exchanges, ExchangeState{ExchangeInfo: ex, Connected: st.Connected, Since: st.Since})
	}
	for _, pair := range e.cfg.Pairs {
		s.Pairs = append(s.Pairs, e.buildSnapshot(pair, e.latestUpdate(pair)))
	}
	for i := len(e.history) - 1; i >= 0; i-- {
		s.History = append(s.History, *e.history[i])
	}
	return s
}

func (e *Engine) knownPair(pair domain.Pair) bool {
	for _, p := range e.cfg.Pairs {
		if p == pair {
			return true
		}
	}
	return false
}

// latestUpdate はそのペアの板のうち最も新しい受信時刻を返す（スナップショット用）。
func (e *Engine) latestUpdate(pair domain.Pair) time.Time {
	var latest time.Time
	for _, ex := range e.cfg.Exchanges {
		if b, ok := e.books[ex.ID][pair]; ok && b.ReceivedAt.After(latest) {
			latest = b.ReceivedAt
		}
	}
	return latest
}

// evaluatePair はペアの全方向を評価し、スナップショットと機会の変化を通知する。ロックを保持して呼ぶ。
func (e *Engine) evaluatePair(pair domain.Pair, now time.Time) {
	snap := e.buildSnapshot(pair, now)
	e.emit(Event{Kind: EventPairUpdated, Pair: &snap})

	evaluated := make(map[episodeKey]arbitrage.Result, len(snap.Directions))
	for _, r := range snap.Directions {
		evaluated[episodeKey{pair: pair, buy: r.BuyExchange, sell: r.SellExchange}] = r
	}
	// 評価できなかった方向（板が欠けている）も含めて全方向の機会の状態を更新する。
	for _, buy := range e.cfg.Exchanges {
		for _, sell := range e.cfg.Exchanges {
			if buy.ID == sell.ID {
				continue
			}
			key := episodeKey{pair: pair, buy: buy.ID, sell: sell.ID}
			r, ok := evaluated[key]
			e.trackEpisode(key, r, ok && r.Profitable, now)
		}
	}
}

// buildSnapshot は保持している板からペアの評価結果を組み立てる。ロックを保持して呼ぶ。
func (e *Engine) buildSnapshot(pair domain.Pair, updatedAt time.Time) PairSnapshot {
	snap := PairSnapshot{
		Pair:      pair,
		Quotes:    make(map[domain.Exchange]Quote, len(e.cfg.Exchanges)),
		UpdatedAt: updatedAt,
	}
	available := make([]domain.OrderBook, 0, len(e.cfg.Exchanges))
	for _, ex := range e.cfg.Exchanges {
		b, ok := e.books[ex.ID][pair]
		if !ok {
			continue
		}
		bid, okBid := b.BestBid()
		ask, okAsk := b.BestAsk()
		if !okBid || !okAsk {
			continue
		}
		snap.Quotes[ex.ID] = Quote{Bid: bid, Ask: ask, BidLevels: len(b.Bids), AskLevels: len(b.Asks), UpdatedAt: b.ReceivedAt}
		available = append(available, b)
	}
	for _, buy := range available {
		for _, sell := range available {
			if buy.Exchange == sell.Exchange {
				continue
			}
			fees := arbitrage.Fees{Buy: e.fees[buy.Exchange], Sell: e.fees[sell.Exchange]}
			if r, ok := arbitrage.Evaluate(buy, sell, fees); ok {
				snap.Directions = append(snap.Directions, r)
			}
		}
	}
	return snap
}

// trackEpisode は方向ごとの機会の開始・更新・終了を管理する。ロックを保持して呼ぶ。
func (e *Engine) trackEpisode(key episodeKey, r arbitrage.Result, profitable bool, now time.Time) {
	ep := e.ongoing[key]
	switch {
	case profitable && ep == nil:
		e.nextID++
		ep = &Episode{
			ID:                e.nextID,
			Pair:              key.pair,
			BuyExchange:       key.buy,
			SellExchange:      key.sell,
			StartedAt:         now,
			MaxNetProfit:      r.NetProfit,
			MaxNetProfitAt:    now,
			QuantityAtMax:     r.Quantity,
			AvgBuyPriceAtMax:  r.AvgBuyPrice,
			AvgSellPriceAtMax: r.AvgSellPrice,
		}
		e.ongoing[key] = ep
		e.appendHistory(ep)
		e.emitEpisode(ep)
	case profitable && ep != nil:
		// 最大純利益の更新時だけ通知する。毎回通知すると板の更新頻度と同じ量のイベントになるため。
		if r.NetProfit.GreaterThan(ep.MaxNetProfit) {
			ep.MaxNetProfit = r.NetProfit
			ep.MaxNetProfitAt = now
			ep.QuantityAtMax = r.Quantity
			ep.AvgBuyPriceAtMax = r.AvgBuyPrice
			ep.AvgSellPriceAtMax = r.AvgSellPrice
			e.emitEpisode(ep)
		}
	case !profitable && ep != nil:
		ep.EndedAt = now
		delete(e.ongoing, key)
		e.emitEpisode(ep)
	}
}

func (e *Engine) appendHistory(ep *Episode) {
	e.history = append(e.history, ep)
	if len(e.history) > e.cfg.HistoryLimit {
		// 先頭（最古）を捨てる。スライスの再確保を避けるため、要素をずらして末尾を切る。
		copy(e.history, e.history[1:])
		e.history[len(e.history)-1] = nil
		e.history = e.history[:len(e.history)-1]
	}
}

func (e *Engine) emitEpisode(ep *Episode) {
	copied := *ep
	e.emit(Event{Kind: EventEpisodeChanged, Episode: &copied})
}

func (e *Engine) emit(ev Event) {
	e.seq++
	ev.Seq = e.seq
	for _, l := range e.listeners {
		l(ev)
	}
}
