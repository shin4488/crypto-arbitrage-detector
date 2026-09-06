# CLAUDE.md

- Claude Code / Codex がこのリポジトリで作業するときの手引き。

## 何をするものか

Binance と OKX の板を突き合わせ、手数料を引いても利益が残る裁定の機会を見つけて表示する。注文は出さない。
対象の通貨ペアは `backend/config.json` の `pairs` で決まる（`BASE/QUOTE` 形式）。コードやドキュメントにペアの一覧は書かない。
仕様・構成・動かし方は README.md にまとめてある。

- `backend/`: Go。取引所との WebSocket 接続、検知、配信、フロントエンドの埋め込み配信
- `frontend/`: React + TypeScript（Vite）。ビルドした画面は Go バイナリに埋め込む
- 本番相当は `docker compose up --build`（コンテナ1つ、http://localhost:8080）、開発は `make dev`

## 守ること

- **テストから書く。** 仕様を説明する名前のテスト（日本語でよい）を先に書き、仕様を変えるときはまずテストを変える
- **コメントとドキュメントは日本語、識別子は英語。** コメントには「なぜそうしているか」「前提にしているドメインの知識」など、コードを読んでも分からないことを書く
- **固定の閾値を入れない。** 数量の上限・下限、最小スプレッド、データの有効期限（秒）は仕様として排除している。板の突き合わせと接続状態で判断する
- **依存を増やさない。** 現在の依存は `backend/go.mod`・`frontend/package.json` を確認する。増やすなら理由をはっきりさせ、推移的依存の少ないものを選ぶ
- **機密情報は絶対に commit しない。** 今は API キーなどを使っていない。必要になっても環境変数で渡す
- **コミットは意味ごとに分ける。** 後で revert しやすい単位にする
- **UI は見た目のかっこよさより、見やすさと使いやすさ。** CSS は必要最低限にする

## コマンド

Go も Node.js もローカルに入れない前提で、`backend/Makefile` とルートの `Makefile` が Docker コンテナの中でコマンドを動かす（`make test GO=go` でローカルの Go に、`make frontend-lint FRONTEND_SH="cd frontend && sh -c"` でローカルの Node.js に切り替えられる）。

開発はルートで `make dev`、全体の整形・テスト・静的検査は `make fmt test lint`。バックエンドの必須確認は `backend/` で `make fmt vet test lint`、フロントはコンテナ内の `frontend/` で `yarn check && yarn build`。全タスクとオプションは `make help`・各Makefile・`frontend/package.json` を参照する。

## 構成のポイント

- `backend/internal/arbitrage`: 板を突き合わせる純粋関数。検知の中核で、テストが仕様書を兼ねる
- `backend/internal/engine`: 板の保持と両方向の評価、機会（Episode）の開始・更新・終了、接続状態。イベントに通し番号 `Seq` を振る
- `backend/internal/server`: クライアントごとの送信箱（同じ対象は最新だけ残す）で、遅いクライアントをほかから切り離す
- `backend/internal/exchange/wsclient`: 再接続・keep-alive・受信タイムアウトの共通処理。取引所ごとの違いは `binance/`、`okx/` に閉じ込める
- `backend/internal/wire`: 配信 JSON の形式。フロントの `frontend/src/protocol/types.ts` と対応させる
- `backend/config.json`: 設定の唯一の置き場。モジュール直下の `embed.go` でバイナリに埋め込み、`internal/config` が読む。本番相当（docker compose）でも開発（make dev）でも、編集して起動し直すだけで反映される
- 取引所を増やす: `backend/internal/exchange/<name>/` に `exchange.Feed` を実装して `registry` に登録する
- 通貨ペアを増やすときは `.claude/skills/add-pair/SKILL.md` に従う。設定の一覧や手順をここに複製しない。

## 変更したら確かめること

- 整形と lint は Claude Code / Codex の hook が、Edit / Write（Codex では apply_patch）の直後と応答を終えるときに Docker で自動実行する。Bash で編集したファイルは応答終了時に git の変更一覧から拾う。lint の指摘が返ってきたら直してから終える
- 上記の検証を通す。CIではバックエンドのraceテストとgovulncheckも走る。
- 配信形式を変えたら、`wire` のテストとフロントの `protocol/types.ts`・`test/fixtures.ts` をそろえる

## 共通エージェント設定

- `make setup` と [READMEの導入手順](README.md#エージェントの導入とhook)を使う。ローカルの実体はClaude側で編集し、`.agents/skills`・`.codex/hooks` の相対リンクを維持する。
- 共通pluginが `.claude/hooks/post-edit.sh` を呼ぶ。ローカル登録は両ツールの `Stop` のみとし、編集後hookを重複登録しない。整形・lintはDocker/Makefile経由。Claudeの権限設定はCodexに引き継がれない。

## 調査と指示の保守

- `AGENTS.md` は `CLAUDE.md` への相対リンク。本文は一度読み、実体を編集する。
- `rg` は対象ディレクトリから名前・見出し・シンボルを探す。通常は `-g` で依存・成果物・ログ・ロックファイル・生成コードを除外し、依存・生成・型・障害の調査では直接読む。見つからなければ範囲・除外を見直す。
- 必須検証を行い、要点・失敗箇所を報告する。同じ差分・依存・設定・実行条件の結果は再利用する。
- ここは恒久規約・必須条件・主要コマンド・参照先に限る。進捗はチャット・既存Issue/PR、機能・構成・依存・設定等の現在値は元の定義へ。規約・条件・参照先の変更や継続して必要な判断基準の追加時に更新する。
- スキルは説明から選び、該当 `SKILL.md` に従う。一覧・手順は転記せず、このガイドの必須適用条件は守る。
