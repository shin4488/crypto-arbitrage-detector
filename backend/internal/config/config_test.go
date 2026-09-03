package config_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/config"
)

func noEnv(string) string { return "" }

func writeFile(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

// builtin は組み込みの設定（backend/config.json）を読む。
func builtin(t *testing.T) config.Config {
	t.Helper()
	cfg, err := config.Default()
	if err != nil {
		t.Fatalf("組み込みの設定（backend/config.json）を読めるはず: %v", err)
	}
	return cfg
}

// 組み込みの設定（backend/config.json）だけで起動できることを確かめる。
// 通貨ペアを足すたびにこのテストを直さなくて済むよう、ペアの中身は見ず「妥当で、1つ以上ある」ことだけを見る。
func TestLoad_BuiltinConfigOnly(t *testing.T) {
	t.Parallel()
	cfg, err := config.Load("", noEnv)
	if err != nil {
		t.Fatalf("組み込みの設定だけで妥当なはず: %v", err)
	}
	// Dockerfile の EXPOSE と docker-compose.yml のポート対応は 8080 を前提にしている
	if cfg.Server.Addr != ":8080" {
		t.Fatalf("addr=%s", cfg.Server.Addr)
	}
	ids := make(map[string]bool, len(cfg.Exchanges))
	for _, ex := range cfg.Exchanges {
		ids[ex.ID] = true
	}
	if !ids["binance"] || !ids["okx"] {
		t.Fatalf("Binance と OKX を突き合わせるのが前提: %+v", cfg.Exchanges)
	}
	pairs, err := cfg.ParsedPairs()
	if err != nil {
		t.Fatalf("ParsedPairs: %v", err)
	}
	if len(pairs) == 0 {
		t.Fatal("通貨ペアは1つ以上のはず")
	}
}

func TestLoad_FileOverridesDefaults(t *testing.T) {
	t.Parallel()
	path := writeFile(t, `{
		"server": {"addr": ":9090", "allowedOrigins": ["http://localhost:3000"]},
		"exchanges": [
			{"id": "binance", "takerFeeRate": "0.00075"},
			{"id": "okx", "takerFeeRate": 0.0008, "wsUrl": "wss://example.test/ws"}
		],
		"pairs": ["btc/usdt", "SOL/USDT"],
		"history": {"limit": 50},
		"log": {"level": "debug", "format": "json"}
	}`)
	cfg, err := config.Load(path, noEnv)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Server.Addr != ":9090" || len(cfg.Server.AllowedOrigins) != 1 {
		t.Fatalf("server=%+v", cfg.Server)
	}
	if cfg.Exchanges[0].TakerFeeRate.String() != "0.00075" || cfg.Exchanges[1].TakerFeeRate.String() != "0.0008" {
		t.Fatalf("手数料率は文字列でも数値でも読める: %+v", cfg.Exchanges)
	}
	if cfg.Exchanges[1].WSURL != "wss://example.test/ws" {
		t.Fatalf("wsUrl=%s", cfg.Exchanges[1].WSURL)
	}
	pairs, _ := cfg.ParsedPairs()
	if pairs[0].String() != "BTC/USDT" || pairs[1].String() != "SOL/USDT" {
		t.Fatalf("pairs=%v", pairs)
	}
	if cfg.History.Limit != 50 || cfg.Log.Level != "debug" || cfg.Log.Format != "json" {
		t.Fatalf("cfg=%+v", cfg)
	}
}

func TestLoad_PartialFileKeepsOtherDefaults(t *testing.T) {
	t.Parallel()
	path := writeFile(t, `{"pairs": ["ETH/USDT"]}`)
	cfg, err := config.Load(path, noEnv)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	def := builtin(t)
	if cfg.Server.Addr != def.Server.Addr || len(cfg.Exchanges) != len(def.Exchanges) || len(cfg.Pairs) != 1 {
		t.Fatalf("書いたキー以外は組み込みの設定のまま: cfg=%+v", cfg)
	}
}

func TestLoad_EnvOverrides(t *testing.T) {
	t.Parallel()
	path := writeFile(t, `{"server": {"addr": ":9090"}}`)
	env := map[string]string{
		config.EnvConfigPath: path,
		config.EnvAddr:       ":7070",
		config.EnvLogLevel:   "warn",
		config.EnvLogFormat:  "json",
	}
	cfg, err := config.Load("", func(k string) string { return env[k] })
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Server.Addr != ":7070" {
		t.Fatalf("環境変数はファイルより優先: %s", cfg.Server.Addr)
	}
	if cfg.Log.Level != "warn" || cfg.Log.Format != "json" {
		t.Fatalf("log=%+v", cfg.Log)
	}
}

func TestLoad_Errors(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		content string
	}{
		{"存在しないファイル", ""},
		{"壊れた JSON", `{"server":`},
		{"未知のキー（タイプミス防止）", `{"sever": {"addr": ":1"}}`},
		{"通貨ペアの形式が不正", `{"pairs": ["BTCUSDT"]}`},
		{"通貨ペアの重複", `{"pairs": ["BTC/USDT", "btc/usdt"]}`},
		{"通貨ペアが空", `{"pairs": []}`},
		{"取引所が1つ", `{"exchanges": [{"id": "binance"}]}`},
		{"取引所IDの重複", `{"exchanges": [{"id": "binance"}, {"id": "binance"}]}`},
		{"手数料率が負", `{"exchanges": [{"id": "binance", "takerFeeRate": "-0.1"}, {"id": "okx"}]}`},
		{"手数料率が1以上", `{"exchanges": [{"id": "binance", "takerFeeRate": "1"}, {"id": "okx"}]}`},
		{"wsUrl のスキームが不正", `{"exchanges": [{"id": "binance", "wsUrl": "http://x"}, {"id": "okx"}]}`},
		{"履歴上限が0", `{"history": {"limit": 0}}`},
		{"ログレベルが不正", `{"log": {"level": "verbose"}}`},
		{"ログ形式が不正", `{"log": {"format": "xml"}}`},
		{"アドレスが空", `{"server": {"addr": " "}}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			path := filepath.Join(t.TempDir(), "missing.json")
			if tt.content != "" {
				path = writeFile(t, tt.content)
			}
			if _, err := config.Load(path, noEnv); err == nil {
				t.Fatal("エラーを期待した")
			}
		})
	}
}
