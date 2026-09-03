// Command server は暗号資産アービトラージ検知サーバー。
//
// 使い方:
//
//	server [-config path/to/config.json]
//	server -healthcheck   # 起動中のサーバーの /healthz を確認して終了コードで結果を返す（Docker HEALTHCHECK 用）
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/app"
	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/config"
)

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("server", flag.ContinueOnError)
	fs.SetOutput(stderr)
	configPath := fs.String("config", "", "設定ファイル（JSON）のパス。省略時は環境変数 "+config.EnvConfigPath+"、それも無ければ既定値")
	healthcheck := fs.Bool("healthcheck", false, "起動中のサーバーの /healthz を確認して終了する")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return 0
		}
		return 2
	}

	cfg, err := config.Load(*configPath, os.Getenv)
	if err != nil {
		fmt.Fprintln(stderr, "設定エラー:", err)
		return 2
	}
	if *healthcheck {
		return runHealthcheck(cfg, stderr)
	}

	log := newLogger(cfg.Log, stdout)
	a, err := app.New(cfg, log)
	if err != nil {
		log.Error("起動に失敗", "error", err)
		return 1
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := a.Run(ctx); err != nil {
		log.Error("異常終了", "error", err)
		return 1
	}
	return 0
}

func newLogger(cfg config.LogConfig, w io.Writer) *slog.Logger {
	var level slog.Level
	switch cfg.Level {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}
	opts := &slog.HandlerOptions{Level: level}
	if cfg.Format == "json" {
		return slog.New(slog.NewJSONHandler(w, opts))
	}
	return slog.New(slog.NewTextHandler(w, opts))
}

// runHealthcheck はローカルのサーバーへ HTTP で問い合わせる。
// 実行イメージ（distroless）には curl や wget が無いため、バイナリ自身に組み込んでいる。
func runHealthcheck(cfg config.Config, stderr io.Writer) int {
	host, port, err := net.SplitHostPort(cfg.Server.Addr)
	if err != nil {
		fmt.Fprintln(stderr, "アドレスを解釈できません:", err)
		return 2
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	url := "http://" + net.JoinHostPort(host, port) + "/healthz"
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(url) //nolint:noctx // 短時間のヘルスチェックなので Timeout で十分
	if err != nil {
		fmt.Fprintln(stderr, "healthz に接続できません:", err)
		return 1
	}
	defer func() { _ = resp.Body.Close() }()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode != http.StatusOK || !strings.Contains(string(body), `"status":"ok"`) {
		fmt.Fprintf(stderr, "healthz が異常: status=%d body=%s\n", resp.StatusCode, body)
		return 1
	}
	return 0
}
