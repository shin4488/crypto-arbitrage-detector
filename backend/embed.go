// Package backend は、モジュール直下に置いた設定ファイル backend/config.json をバイナリに埋め込む。
//
// 埋め込み（go:embed）は同じディレクトリ以下のファイルにしか使えないので、設定ファイルを見つけやすい場所
// （モジュール直下）に置いたまま埋め込むには、モジュール直下にこのパッケージが要る。
// 埋め込むのは、通貨ペアの追加のような日常的な設定変更を「ファイルを編集して起動し直す」だけで、
// 本番相当（docker compose up --build）でも開発（make dev の go run）でも同じように反映させるため。
// ファイルの配置や環境変数の設定を忘れて既定値のまま動く、という事故も防げる。
// 実行時に一部を差し替えたいときは ARB_CONFIG で別のファイルを渡す（internal/config を参照）。
package backend

// 埋め込みのディレクティブを使うファイルは、embed パッケージを import しておく必要がある
import _ "embed"

// ConfigJSON は backend/config.json の内容。設定の読み込み（internal/config）の土台になる。
//
//go:embed config.json
var ConfigJSON []byte
