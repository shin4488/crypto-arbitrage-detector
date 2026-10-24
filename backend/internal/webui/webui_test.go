package webui_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/shin4488/crypto-arbitrage-detector/backend/internal/webui"
)

func get(t *testing.T, h http.Handler, path string) *http.Response {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec.Result()
}

func TestNewHandler_ServesBuiltFrontend(t *testing.T) {
	t.Parallel()
	fsys := fstest.MapFS{
		"index.html":        {Data: []byte("<html>app</html>")},
		"assets/app-abc.js": {Data: []byte("console.log(1)")},
	}
	h := webui.NewHandler(fsys)

	resp := get(t, h, "/")
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK || string(body) != "<html>app</html>" {
		t.Fatalf("status=%d body=%s", resp.StatusCode, body)
	}
	if got := resp.Header.Get("Cache-Control"); got != "no-cache" {
		t.Fatalf("index.html は再検証させる: %s", got)
	}

	resp = get(t, h, "/assets/app-abc.js")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d", resp.StatusCode)
	}
	if got := resp.Header.Get("Cache-Control"); got != "public, max-age=31536000, immutable" {
		t.Fatalf("ハッシュ付きアセットは長期キャッシュ: %s", got)
	}

	if resp := get(t, h, "/missing.txt"); resp.StatusCode != http.StatusNotFound {
		t.Fatalf("無いファイルは 404: %d", resp.StatusCode)
	}
}

func TestNewHandler_WithoutBuild(t *testing.T) {
	t.Parallel()
	h := webui.NewHandler(fstest.MapFS{".gitkeep": {Data: nil}})
	resp := get(t, h, "/")
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("ビルド結果を埋め込んでいなければ 503: %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	// frontend をビルドしただけでは埋め込まれないため、画面を開ける手順として開発サーバーと Docker イメージを案内する
	for _, want := range []string{"make dev", "http://localhost:3000", "docker compose up --build"} {
		if !strings.Contains(string(body), want) {
			t.Errorf("案内に %q が無い: %s", want, body)
		}
	}
}

func TestHandler_EmbeddedDoesNotPanic(t *testing.T) {
	t.Parallel()
	h := webui.Handler()
	resp := get(t, h, "/")
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status=%d", resp.StatusCode)
	}
}
