// Package config はサーバーの設定を扱う。
//
// 設定は「コード内の既定値 → JSON ファイル → 環境変数」の順に上書きされる。
// JSON を採用しているのは標準ライブラリだけで読めるため（依存パッケージを増やさない）。
// 機密情報（API キー等）は現状不要だが、必要になった場合も環境変数で渡し、ファイルには書かない方針。
package config

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/shopspring/decimal"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/domain"
)

// 環境変数名。すべて ARB_ を接頭辞にして他のツールと衝突しないようにする。
const (
	EnvConfigPath = "ARB_CONFIG"
	EnvAddr       = "ARB_ADDR"
	EnvLogLevel   = "ARB_LOG_LEVEL"
	EnvLogFormat  = "ARB_LOG_FORMAT"
)

// Config はサーバー全体の設定。
type Config struct {
	Server    ServerConfig     `json:"server"`
	Exchanges []ExchangeConfig `json:"exchanges"`
	// Pairs は "BTC/USDT" 形式。
	Pairs   []string      `json:"pairs"`
	History HistoryConfig `json:"history"`
	Log     LogConfig     `json:"log"`
}

// ServerConfig は HTTP/WebSocket サーバーの設定。
type ServerConfig struct {
	// Addr は待ち受けアドレス（例: ":8080"）。
	Addr string `json:"addr"`
	// AllowedOrigins は WebSocket 接続を許可する追加の Origin。同一オリジンは常に許可される。
	AllowedOrigins []string `json:"allowedOrigins"`
}

// ExchangeConfig は取引所ごとの設定。
type ExchangeConfig struct {
	// ID は registry に登録された取引所ID（binance, okx）。
	ID string `json:"id"`
	// Name は表示名。空なら registry の既定名。
	Name string `json:"name"`
	// TakerFeeRate は taker 手数料率（0.001 = 0.1%）。
	TakerFeeRate decimal.Decimal `json:"takerFeeRate"`
	// WSURL は接続先。空なら既定 URL。テストやプロキシ経由で差し替えるためのもの。
	WSURL string `json:"wsUrl"`
}

// HistoryConfig は機会履歴の設定。
type HistoryConfig struct {
	Limit int `json:"limit"`
}

// LogConfig はログ出力の設定。
type LogConfig struct {
	// Level は debug / info / warn / error。
	Level string `json:"level"`
	// Format は text / json。
	Format string `json:"format"`
}

// Default は既定の設定。手数料率は各取引所の一般ユーザー向け spot taker 手数料（2026年時点）。
func Default() Config {
	return Config{
		Server: ServerConfig{Addr: ":8080"},
		Exchanges: []ExchangeConfig{
			{ID: "binance", Name: "Binance", TakerFeeRate: decimal.RequireFromString("0.001")},
			{ID: "okx", Name: "OKX", TakerFeeRate: decimal.RequireFromString("0.001")},
		},
		Pairs:   []string{"BTC/USDT", "ETH/USDT", "XRP/USDT", "SHIB/USDT", "DOGE/USDT"},
		History: HistoryConfig{Limit: 200},
		Log:     LogConfig{Level: "info", Format: "text"},
	}
}

// Load は既定値に JSON ファイル（path が空なら読まない）と環境変数を重ねて設定を作る。
// getenv は環境変数の取得関数（テストで差し替える）。nil なら os.Getenv。
func Load(path string, getenv func(string) string) (Config, error) {
	if getenv == nil {
		getenv = os.Getenv
	}
	cfg := Default()
	if path == "" {
		path = getenv(EnvConfigPath)
	}
	if path != "" {
		data, err := os.ReadFile(path)
		if err != nil {
			return Config{}, fmt.Errorf("設定ファイルを読めません: %w", err)
		}
		if err := parseInto(&cfg, data); err != nil {
			return Config{}, fmt.Errorf("設定ファイル %s: %w", path, err)
		}
	}
	applyEnv(&cfg, getenv)
	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// parseInto は JSON を cfg に上書きする。未知のキーはタイプミス防止のためエラーにする。
func parseInto(cfg *Config, data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(cfg); err != nil {
		return fmt.Errorf("JSON を解釈できません: %w", err)
	}
	return nil
}

func applyEnv(cfg *Config, getenv func(string) string) {
	if v := getenv(EnvAddr); v != "" {
		cfg.Server.Addr = v
	}
	if v := getenv(EnvLogLevel); v != "" {
		cfg.Log.Level = v
	}
	if v := getenv(EnvLogFormat); v != "" {
		cfg.Log.Format = v
	}
}

// Validate は設定の整合性を検査する。
func (c Config) Validate() error {
	if strings.TrimSpace(c.Server.Addr) == "" {
		return errors.New("server.addr が空です")
	}
	if len(c.Exchanges) < 2 {
		return errors.New("exchanges は2つ以上必要です")
	}
	seen := make(map[string]bool, len(c.Exchanges))
	one := decimal.NewFromInt(1)
	for i, ex := range c.Exchanges {
		if strings.TrimSpace(ex.ID) == "" {
			return fmt.Errorf("exchanges[%d].id が空です", i)
		}
		if seen[ex.ID] {
			return fmt.Errorf("exchanges の id が重複しています: %s", ex.ID)
		}
		seen[ex.ID] = true
		if ex.TakerFeeRate.IsNegative() || ex.TakerFeeRate.GreaterThanOrEqual(one) {
			return fmt.Errorf("exchanges[%s].takerFeeRate は 0 以上 1 未満で指定してください: %s", ex.ID, ex.TakerFeeRate)
		}
		if ex.WSURL != "" && !strings.HasPrefix(ex.WSURL, "ws://") && !strings.HasPrefix(ex.WSURL, "wss://") {
			return fmt.Errorf("exchanges[%s].wsUrl は ws:// または wss:// で始めてください: %s", ex.ID, ex.WSURL)
		}
	}
	if _, err := c.ParsedPairs(); err != nil {
		return err
	}
	if c.History.Limit <= 0 {
		return errors.New("history.limit は1以上で指定してください")
	}
	switch c.Log.Level {
	case "debug", "info", "warn", "error":
	default:
		return fmt.Errorf("log.level は debug/info/warn/error のいずれかです: %q", c.Log.Level)
	}
	switch c.Log.Format {
	case "text", "json":
	default:
		return fmt.Errorf("log.format は text/json のいずれかです: %q", c.Log.Format)
	}
	return nil
}

// ParsedPairs は Pairs を domain.Pair に変換する。重複はエラー。
func (c Config) ParsedPairs() ([]domain.Pair, error) {
	if len(c.Pairs) == 0 {
		return nil, errors.New("pairs は1つ以上必要です")
	}
	pairs := make([]domain.Pair, 0, len(c.Pairs))
	seen := make(map[domain.Pair]bool, len(c.Pairs))
	for _, s := range c.Pairs {
		p, err := domain.ParsePair(s)
		if err != nil {
			return nil, fmt.Errorf("pairs: %w", err)
		}
		if seen[p] {
			return nil, fmt.Errorf("pairs が重複しています: %s", p)
		}
		seen[p] = true
		pairs = append(pairs, p)
	}
	return pairs, nil
}
