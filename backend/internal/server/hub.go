// Package server はフロントエンド向けの WebSocket 配信を担う。
package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/engine"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/wire"
)

// StateProvider は、接続直後に送る全状態の取得元（通常はエンジン）。
type StateProvider interface {
	Snapshot() engine.State
}

// Options はハブの動作設定。ゼロ値には既定値が使われる。
type Options struct {
	// WriteTimeout は1メッセージの書き込み上限時間。
	WriteTimeout time.Duration
	// PingInterval は接続維持のための ping 送信間隔。
	PingInterval time.Duration
	// PongTimeout はこの時間クライアントから何も届かなければ切断する。PingInterval より長くする。
	PongTimeout time.Duration
	// AllowedOrigins は接続を許可する Origin。空なら同一オリジン（Host と一致）のみ許可する。
	AllowedOrigins []string
}

const (
	defaultWriteTimeout = 5 * time.Second
	defaultPingInterval = 30 * time.Second
	defaultPongTimeout  = 60 * time.Second
	// maxClientMessageSize はクライアントから受け付けるメッセージの上限。
	// 現状クライアントからの送信は想定していないため、最小限に絞ってメモリ消費を抑える。
	maxClientMessageSize = 1024
)

// Hub は接続中のクライアントを管理し、エンジンのイベントを各クライアントへ配る。
type Hub struct {
	state    StateProvider
	opts     Options
	log      *slog.Logger
	upgrader websocket.Upgrader

	mu      sync.Mutex
	clients map[*client]struct{}
	closed  bool
	wg      sync.WaitGroup
}

// NewHub はハブを作る。
func NewHub(state StateProvider, opts Options, log *slog.Logger) *Hub {
	if opts.WriteTimeout <= 0 {
		opts.WriteTimeout = defaultWriteTimeout
	}
	if opts.PingInterval <= 0 {
		opts.PingInterval = defaultPingInterval
	}
	if opts.PongTimeout <= 0 {
		opts.PongTimeout = defaultPongTimeout
	}
	if log == nil {
		log = slog.Default()
	}
	h := &Hub{
		state:   state,
		opts:    opts,
		log:     log,
		clients: make(map[*client]struct{}),
	}
	h.upgrader = websocket.Upgrader{CheckOrigin: h.checkOrigin}
	return h
}

// checkOrigin は同一オリジンか、設定で許可された Origin だけを受け入れる。
// ブラウザ以外のクライアント（Origin ヘッダなし）はそのまま許可する（gorilla の既定と同じ）。
func (h *Hub) checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	for _, allowed := range h.opts.AllowedOrigins {
		if allowed == origin {
			return true
		}
	}
	return sameOrigin(origin, r.Host)
}

func sameOrigin(origin, host string) bool {
	for _, scheme := range []string{"http://", "https://"} {
		if origin == scheme+host {
			return true
		}
	}
	return false
}

// HandleEvent はエンジンのイベントを全クライアントの送信箱に置く。engine.Listener として登録する。
// エンジンのロック内から呼ばれるため、ここでは I/O をせず O(クライアント数) で返す。
func (h *Hub) HandleEvent(ev engine.Event) {
	msg := wire.NewMessage(ev)
	if msg == nil {
		return
	}
	key := mailKey(ev)
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		c.mailbox.Put(key, ev.Seq, msg)
	}
}

// mailKey は同じ対象のイベントを送信箱でまとめるためのキーを返す。
func mailKey(ev engine.Event) string {
	switch ev.Kind {
	case engine.EventPairUpdated:
		return "pair:" + ev.Pair.Pair.String()
	case engine.EventEpisodeChanged:
		return "episode:" + strconv.FormatUint(ev.Episode.ID, 10)
	case engine.EventExchangeStatusChanged:
		return "exchange:" + string(ev.Status.Exchange)
	default:
		return "event:" + strconv.FormatUint(ev.Seq, 10)
	}
}

// ClientCount は接続中のクライアント数。
func (h *Hub) ClientCount() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.clients)
}

// ServeHTTP は WebSocket へアップグレードし、初期状態を送ってから更新の配信を始める。
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		// Upgrade が失敗した場合は gorilla が既に HTTP エラーを書き込んでいる。
		h.log.Warn("WebSocket のアップグレードに失敗", "error", err, "remote", r.RemoteAddr)
		return
	}
	c := newClient(h, conn)
	if !h.register(c) {
		_ = conn.Close()
		return
	}
	// 登録してからスナップショットを取ることで、その間のイベントも送信箱に入る。
	// スナップショットより古いイベントは Seq で捨てるので、二重や巻き戻りは起きない。
	state := h.state.Snapshot()
	c.initSeq = state.Seq
	if err := c.write(wire.NewInitMessage(state)); err != nil {
		// 閉じても下のゴルーチンは起動する。register で数えた分を必ず Done するため（すぐに抜ける）。
		c.close(fmt.Errorf("初期状態の送信に失敗: %w", err))
	} else {
		h.log.Info("クライアント接続", "remote", r.RemoteAddr, "clients", h.ClientCount())
	}

	go func() {
		defer h.wg.Done()
		c.writeLoop()
	}()
	go func() {
		defer h.wg.Done()
		c.readLoop()
	}()
}

// register はクライアントを登録し、送受信ゴルーチン2本分を wg に加える。
// wg.Add を closed の判定と同じロックの下で行うのは、Shutdown の wg.Wait と同時に Add が走る
// （WaitGroup の規則に反し、データ競合になる）のを防ぐため。Shutdown は closed を立ててから Wait する。
func (h *Hub) register(c *client) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return false
	}
	h.clients[c] = struct{}{}
	h.wg.Add(2)
	return true
}

func (h *Hub) unregister(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, c)
}

// Shutdown は全クライアントを閉じ、送受信ゴルーチンの終了を待つ。
func (h *Hub) Shutdown(ctx context.Context) error {
	h.mu.Lock()
	h.closed = true
	clients := make([]*client, 0, len(h.clients))
	for c := range h.clients {
		clients = append(clients, c)
	}
	h.mu.Unlock()

	for _, c := range clients {
		c.close(errors.New("サーバー停止"))
	}
	done := make(chan struct{})
	go func() {
		h.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// client は1つの WebSocket 接続。
type client struct {
	hub     *Hub
	conn    *websocket.Conn
	mailbox *mailbox
	// initSeq は初期状態のシーケンス番号。これ以下のイベントは初期状態に含まれているので送らない。
	initSeq   uint64
	done      chan struct{}
	closeOnce sync.Once
}

func newClient(h *Hub, conn *websocket.Conn) *client {
	return &client{hub: h, conn: conn, mailbox: newMailbox(), done: make(chan struct{})}
}

// write は1メッセージを JSON で送る。writeLoop と初期化時以外から呼んではならない（gorilla は同時書き込み不可）。
func (c *client) write(msg any) error {
	if err := c.conn.SetWriteDeadline(time.Now().Add(c.hub.opts.WriteTimeout)); err != nil {
		return err
	}
	return c.conn.WriteJSON(msg)
}

func (c *client) writeLoop() {
	ticker := time.NewTicker(c.hub.opts.PingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-c.done:
			return
		case <-c.mailbox.Signal():
			for _, m := range c.mailbox.Drain() {
				if m.seq <= c.initSeq {
					continue
				}
				if err := c.write(m.msg); err != nil {
					c.close(fmt.Errorf("送信に失敗: %w", err))
					return
				}
			}
		case <-ticker.C:
			deadline := time.Now().Add(c.hub.opts.WriteTimeout)
			if err := c.conn.WriteControl(websocket.PingMessage, nil, deadline); err != nil {
				c.close(fmt.Errorf("ping の送信に失敗: %w", err))
				return
			}
		}
	}
}

// readLoop はクライアントからの受信を処理する。内容は使わないが、切断検知と pong の受信のために読み続ける。
func (c *client) readLoop() {
	c.conn.SetReadLimit(maxClientMessageSize)
	extend := func() error { return c.conn.SetReadDeadline(time.Now().Add(c.hub.opts.PongTimeout)) }
	if err := extend(); err != nil {
		c.close(err)
		return
	}
	c.conn.SetPongHandler(func(string) error { return extend() })
	for {
		if _, _, err := c.conn.NextReader(); err != nil {
			c.close(err)
			return
		}
		if err := extend(); err != nil {
			c.close(err)
			return
		}
	}
}

// close は接続を閉じてハブから外す。複数回呼んでも1度しか実行されない。
func (c *client) close(reason error) {
	c.closeOnce.Do(func() {
		close(c.done)
		c.hub.unregister(c)
		deadline := time.Now().Add(time.Second)
		// クローズフレームは礼儀として送るが、失敗しても構わない（相手が既に切れている場合など）。
		_ = c.conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), deadline)
		_ = c.conn.Close()
		if reason != nil && !websocket.IsCloseError(reason, websocket.CloseNormalClosure, websocket.CloseGoingAway, websocket.CloseNoStatusReceived) {
			c.hub.log.Info("クライアント切断", "reason", reason, "clients", c.hub.ClientCount())
		} else {
			c.hub.log.Info("クライアント切断", "clients", c.hub.ClientCount())
		}
	})
}
