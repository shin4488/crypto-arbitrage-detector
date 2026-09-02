// Package app は各部品（設定・エンジン・取引所フィード・配信ハブ・HTTP サーバー）を組み立てて実行する。
package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/config"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/engine"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/exchange/registry"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/server"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/webui"
)

const (
	// shutdownTimeout は停止時に接続の終了を待つ上限。
	shutdownTimeout = 5 * time.Second
	// readHeaderTimeout は遅いクライアントによる接続の占有（Slowloris）を防ぐ。
	readHeaderTimeout = 5 * time.Second
)

// App は組み立て済みのアプリケーション。
type App struct {
	cfg    config.Config
	log    *slog.Logger
	engine *engine.Engine
	hub    *server.Hub
	feeds  []exchange.Feed
	mux    *http.ServeMux
}

// New は設定から各部品を組み立てる。ネットワーク接続はまだ開始しない。
func New(cfg config.Config, log *slog.Logger) (*App, error) {
	pairs, err := cfg.ParsedPairs()
	if err != nil {
		return nil, err
	}
	engineCfg := engine.Config{Pairs: pairs, HistoryLimit: cfg.History.Limit}
	for _, ex := range cfg.Exchanges {
		entry, ok := registry.Lookup(domain.Exchange(ex.ID))
		if !ok {
			return nil, fmt.Errorf("未対応の取引所です: %s（対応: %v）", ex.ID, registry.SupportedIDs())
		}
		name := ex.Name
		if name == "" {
			name = entry.Name
		}
		engineCfg.Exchanges = append(engineCfg.Exchanges, engine.ExchangeInfo{
			ID: domain.Exchange(ex.ID), Name: name, TakerFeeRate: ex.TakerFeeRate,
		})
	}
	eng, err := engine.New(engineCfg)
	if err != nil {
		return nil, err
	}
	hub := server.NewHub(eng, server.Options{AllowedOrigins: cfg.Server.AllowedOrigins}, log)
	eng.AddListener(hub.HandleEvent)

	feeds := make([]exchange.Feed, 0, len(cfg.Exchanges))
	for _, ex := range cfg.Exchanges {
		feed, err := registry.NewFeed(domain.Exchange(ex.ID), exchange.FeedConfig{
			URL:    ex.WSURL,
			Pairs:  pairs,
			Sink:   eng,
			Logger: log,
		})
		if err != nil {
			return nil, err
		}
		feeds = append(feeds, feed)
	}

	a := &App{cfg: cfg, log: log, engine: eng, hub: hub, feeds: feeds, mux: http.NewServeMux()}
	a.mux.Handle("/ws", hub)
	a.mux.HandleFunc("/healthz", a.handleHealth)
	a.mux.Handle("/", webui.Handler())
	return a, nil
}

// Handler は HTTP ハンドラ（テストで httptest に載せるために公開）。
func (a *App) Handler() http.Handler { return a.mux }

// Run は取引所への接続と HTTP サーバーを開始し、ctx が終わるまで動き続ける。
func (a *App) Run(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var wg sync.WaitGroup
	for _, feed := range a.feeds {
		wg.Add(1)
		go func(feed exchange.Feed) {
			defer wg.Done()
			feed.Run(ctx)
		}(feed)
	}

	ln, err := net.Listen("tcp", a.cfg.Server.Addr)
	if err != nil {
		cancel()
		wg.Wait()
		return fmt.Errorf("待ち受けに失敗: %w", err)
	}
	srv := &http.Server{Handler: a.mux, ReadHeaderTimeout: readHeaderTimeout}
	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(ln) }()
	a.log.Info("サーバーを開始しました", "addr", ln.Addr().String())

	select {
	case <-ctx.Done():
	case err := <-serveErr:
		cancel()
		wg.Wait()
		return fmt.Errorf("HTTP サーバーが停止: %w", err)
	}

	a.log.Info("停止処理を開始します")
	// 親の ctx は既に終了しているため、停止処理には独立した期限付き ctx を使う。
	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancelShutdown()
	var errs []error
	if err := a.hub.Shutdown(shutdownCtx); err != nil { //nolint:contextcheck // 上記コメント参照
		errs = append(errs, fmt.Errorf("ハブの停止: %w", err))
	}
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) { //nolint:contextcheck // 上記コメント参照
		errs = append(errs, fmt.Errorf("HTTP サーバーの停止: %w", err))
	}
	<-serveErr
	wg.Wait()
	a.log.Info("停止しました")
	return errors.Join(errs...)
}

// healthResponse は /healthz の応答。
type healthResponse struct {
	Status    string          `json:"status"`
	Clients   int             `json:"clients"`
	Exchanges map[string]bool `json:"exchanges"`
}

// handleHealth はプロセスの生存と各取引所の接続状態を返す。
// 取引所が切断中でもプロセスは正常なので 200 を返す（接続状態は本文で判断する）。
func (a *App) handleHealth(w http.ResponseWriter, _ *http.Request) {
	state := a.engine.Snapshot()
	resp := healthResponse{Status: "ok", Clients: a.hub.ClientCount(), Exchanges: make(map[string]bool, len(state.Exchanges))}
	for _, ex := range state.Exchanges {
		resp.Exchanges[string(ex.ID)] = ex.Connected
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		a.log.Warn("healthz の応答に失敗", "error", err)
	}
}
