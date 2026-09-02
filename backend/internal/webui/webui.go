// Package webui はビルド済みフロントエンド（frontend/dist）をバイナリに埋め込んで配信する。
//
// バイナリ1つ・コンテナ1つで完結させ、実行環境に nginx や Node.js を置かずに済ませるため。
// 埋め込むファイルはビルド時に dist/ へコピーされる（Dockerfile と Makefile を参照）。
package webui

import (
	"embed"
	"errors"
	"io/fs"
	"net/http"
	"strings"
)

// dist はビルド済みフロントエンド。all: 接頭辞でドットファイル（.gitkeep）も含めることで、
// フロントエンド未ビルドでもコンパイルが通る（空ディレクトリは embed できないため）。
//
//go:embed all:dist
var dist embed.FS

// Handler は埋め込んだフロントエンドを配信するハンドラを返す。
func Handler() http.Handler {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		panic(err) // 埋め込みディレクトリ名は固定なので起こり得ない
	}
	return NewHandler(sub)
}

// NewHandler は任意の fs.FS から静的ファイルを配信するハンドラを返す（テスト用に公開）。
// index.html が無い（フロントエンド未ビルド）場合は 503 で案内を返す。
func NewHandler(fsys fs.FS) http.Handler {
	if _, err := fs.Stat(fsys, "index.html"); errors.Is(err, fs.ErrNotExist) {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte("フロントエンドがビルドされていません。frontend で `npm run build` を実行するか、Docker イメージを使ってください。\n"))
		})
	}
	files := http.FileServerFS(fsys)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Vite はアセットにハッシュ付きファイル名を付けるため、長期キャッシュしても古い内容が残らない。
		// index.html はハッシュを持たないので毎回検証させる。
		if strings.HasPrefix(r.URL.Path, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		files.ServeHTTP(w, r)
	})
}
