// Package wsclient は取引所の WebSocket API につなぎ、切れたら自動でつなぎ直す共通処理。
// 購読メッセージや keep-alive の方式は取引所ごとに違うので、Options の関数で差し替える。
package wsclient

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"time"

	"github.com/gorilla/websocket"
)

// ErrReconnect は OnMessage から返すと現在の接続を捨てて再接続する。
// 購読の拒否など、接続し直さないと回復しない状況で使う。
var ErrReconnect = errors.New("wsclient: 再接続が必要")

// Options は接続の設定。
type Options struct {
	// Name はログ用の名前。
	Name string
	URL  string
	// Subscribe は接続直後に呼ばれる。購読リクエストの送信などに使う。nil なら何もしない。
	Subscribe func(ctx context.Context, conn *websocket.Conn) error
	// OnMessage は受信したメッセージごとに呼ばれる。ErrReconnect 以外のエラーはログに出して読み続ける。
	OnMessage func(msg []byte) error
	// OnStatus は接続確立時に true、切断時に false で呼ばれる。
	OnStatus func(connected bool)
	// KeepAlive は KeepAliveInterval ごとに呼ばれる。nil なら WebSocket の ping フレームを送る。
	KeepAlive         func(conn *websocket.Conn) error
	KeepAliveInterval time.Duration
	// ReadTimeout の間なにも届かなければ、接続が切れたとみなしてつなぎ直す。
	// 相場が静かでも取引所は ping や pong を送ってくるので、通常はこの時間内に何かしら届く。
	ReadTimeout      time.Duration
	HandshakeTimeout time.Duration
	// MinBackoff / MaxBackoff は再接続の待ち時間（指数的に増やし、ジッタを加える）。
	MinBackoff time.Duration
	MaxBackoff time.Duration
	Logger     *slog.Logger
	// Dialer を差し替えられる（テスト用）。nil なら既定。
	Dialer *websocket.Dialer
}

const (
	defaultKeepAliveInterval = 20 * time.Second
	defaultReadTimeout       = 60 * time.Second
	defaultHandshakeTimeout  = 10 * time.Second
	defaultMinBackoff        = time.Second
	defaultMaxBackoff        = 60 * time.Second
)

func (o *Options) applyDefaults() {
	if o.KeepAliveInterval <= 0 {
		o.KeepAliveInterval = defaultKeepAliveInterval
	}
	if o.ReadTimeout <= 0 {
		o.ReadTimeout = defaultReadTimeout
	}
	if o.HandshakeTimeout <= 0 {
		o.HandshakeTimeout = defaultHandshakeTimeout
	}
	if o.MinBackoff <= 0 {
		o.MinBackoff = defaultMinBackoff
	}
	if o.MaxBackoff < o.MinBackoff {
		o.MaxBackoff = defaultMaxBackoff
		if o.MaxBackoff < o.MinBackoff {
			o.MaxBackoff = o.MinBackoff
		}
	}
	if o.Logger == nil {
		o.Logger = slog.Default()
	}
	if o.Dialer == nil {
		o.Dialer = &websocket.Dialer{Proxy: websocket.DefaultDialer.Proxy}
	}
	if o.OnStatus == nil {
		o.OnStatus = func(bool) {}
	}
	if o.OnMessage == nil {
		o.OnMessage = func([]byte) error { return nil }
	}
}

// Run は ctx が終わるまで接続を維持し続ける。切断されたら待ち時間を挟んで再接続する。
func Run(ctx context.Context, opts Options) {
	opts.applyDefaults()
	log := opts.Logger.With("feed", opts.Name)
	backoff := opts.MinBackoff

	for {
		err := runOnce(ctx, opts, log)
		if ctx.Err() != nil {
			return
		}
		if errors.Is(err, errSessionEstablished) {
			// 接続と購読まで成功した後の切断なら、次回はすぐつなぎ直す。
			backoff = opts.MinBackoff
			log.Warn("接続が切れたため再接続します", "wait", backoff)
		} else {
			log.Warn("接続に失敗したため再試行します", "error", err, "wait", backoff)
		}
		if !sleep(ctx, jitter(backoff)) {
			return
		}
		backoff = min(backoff*2, opts.MaxBackoff)
	}
}

// errSessionEstablished は接続と購読が成功した後で切断されたことを示す（バックオフを戻す判断に使う）。
var errSessionEstablished = errors.New("session established")

// runOnce は1回分の接続を処理し、切断されたら戻る。
func runOnce(ctx context.Context, opts Options, log *slog.Logger) (retErr error) {
	dialCtx, cancel := context.WithTimeout(ctx, opts.HandshakeTimeout)
	defer cancel()
	conn, resp, err := opts.Dialer.DialContext(dialCtx, opts.URL, nil)
	if err != nil {
		if resp != nil {
			return fmt.Errorf("接続に失敗 (HTTP %d): %w", resp.StatusCode, err)
		}
		return fmt.Errorf("接続に失敗: %w", err)
	}
	defer func() { _ = conn.Close() }()

	if opts.Subscribe != nil {
		if err := opts.Subscribe(ctx, conn); err != nil {
			return fmt.Errorf("購読に失敗: %w", err)
		}
	}
	log.Info("接続しました", "url", opts.URL)
	opts.OnStatus(true)
	defer opts.OnStatus(false)

	// ctx の終了や keep-alive の失敗で接続を閉じ、読み込みループを抜けさせる。
	sessionCtx, stopSession := context.WithCancel(ctx)
	defer stopSession()
	go func() {
		<-sessionCtx.Done()
		_ = conn.Close()
	}()
	go keepAlive(sessionCtx, stopSession, conn, opts, log)

	for {
		if err := conn.SetReadDeadline(time.Now().Add(opts.ReadTimeout)); err != nil {
			return errors.Join(errSessionEstablished, err)
		}
		_, msg, err := conn.ReadMessage()
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return errors.Join(errSessionEstablished, fmt.Errorf("受信に失敗: %w", err))
		}
		if err := opts.OnMessage(msg); err != nil {
			if errors.Is(err, ErrReconnect) {
				return errors.Join(errSessionEstablished, err)
			}
			log.Warn("メッセージの処理に失敗", "error", err)
		}
	}
}

// keepAlive は定期的に keep-alive を送る。失敗したらセッションを終了させる。
func keepAlive(ctx context.Context, stop context.CancelFunc, conn *websocket.Conn, opts Options, log *slog.Logger) {
	ticker := time.NewTicker(opts.KeepAliveInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			var err error
			if opts.KeepAlive != nil {
				err = opts.KeepAlive(conn)
			} else {
				err = conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(opts.HandshakeTimeout))
			}
			if err != nil {
				log.Warn("keep-alive の送信に失敗", "error", err)
				stop()
				return
			}
		}
	}
}

// jitter は同時再接続の集中を避けるため、待ち時間に ±20% の揺らぎを加える。
func jitter(d time.Duration) time.Duration {
	factor := 0.8 + rand.Float64()*0.4 //nolint:gosec // 暗号用途ではないため疑似乱数で十分
	return time.Duration(float64(d) * factor)
}

func sleep(ctx context.Context, d time.Duration) bool {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
