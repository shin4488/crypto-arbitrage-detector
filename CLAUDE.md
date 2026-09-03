# CLAUDE.md

Claude Code がこのリポジトリで作業するときの手引き。

## 何をするものか

Binance と OKX の板を突き合わせ、手数料を引いても利益が残る裁定の機会を見つけて表示する。注文は出さない。
対象は BTC / ETH / XRP / SHIB / DOGE の各 USDT ペア（設定で増減できる）。
仕様・構成・動かし方は README.md にまとめてある。

- `backend/`: Go。取引所との WebSocket 接続、検知、配信、フロントエンドの埋め込み配信
- `frontend/`: React + TypeScript（Vite）。ビルドした画面は Go バイナリに埋め込む
- 本番相当は `docker compose up --build`（コンテナ1つ、http://localhost:8080）、開発は `make dev`

## 守ること

- **テストから書く。** 仕様を説明する名前のテスト（日本語でよい）を先に書き、仕様を変えるときはまずテストを変える
- **コメントとドキュメントは日本語、識別子は英語。** コメントには「なぜそうしているか」「前提にしているドメインの知識」など、コードを読んでも分からないことを書く
- **固定の閾値を入れない。** 数量の上限・下限、最小スプレッド、データの有効期限（秒）は仕様として排除している。板の突き合わせと接続状態で判断する
- **依存を増やさない。** Go はサードパーティ2つ、フロントの実行時依存は react だけ。増やすなら理由をはっきりさせ、推移的依存の少ないものを選ぶ
- **機密情報は絶対に commit しない。** 今は API キーなどを使っていない。必要になっても環境変数で渡す
- **コミットは意味ごとに分ける。** 後で revert しやすい単位にする
- **UI は見た目のかっこよさより、見やすさと使いやすさ。** CSS は必要最低限にする

## コマンド

Go はローカルに入れない前提で、`backend/Makefile` が Docker コンテナの中で go コマンドを動かす（`make test GO=go` でローカルの Go に切り替えられる）。

```bash
# バックエンド
cd backend
make test          # テスト
make vet lint      # 静的検査（golangci-lint は Docker イメージで動く）
make fmt           # gofmt
make run           # 開発用に起動（docker compose の backend-dev、8080）

# フロントエンド（Yarn Berry を corepack 経由で使う）
cd frontend
corepack enable
yarn install       # lockfile と一致しないときに失敗させるなら --immutable
yarn dev           # 開発サーバー（3000。/ws は 8080 へ中継）
yarn check         # 型検査 + lint + テスト
yarn build         # dist/ を生成

# 全体
make test / make lint / make up / make dev
```

## 構成のポイント

- `internal/arbitrage`: 板を突き合わせる純粋関数。検知の中核で、テストが仕様書を兼ねる
- `internal/engine`: 板の保持と両方向の評価、機会（Episode）の開始・更新・終了、接続状態。イベントに通し番号 `Seq` を振る
- `internal/server`: クライアントごとの送信箱（同じ対象は最新だけ残す）で、遅いクライアントをほかから切り離す
- `internal/exchange/wsclient`: 再接続・keep-alive・受信タイムアウトの共通処理。取引所ごとの違いは `binance/`、`okx/` に閉じ込める
- `internal/wire`: 配信 JSON の形式。フロントの `src/protocol/types.ts` と対応させる
- 取引所を増やす: `internal/exchange/<name>/` に `exchange.Feed` を実装して `registry` に登録する
- 通貨ペアを増やす: 設定の `pairs` に足すだけ

## 変更したら確かめること

- バックエンド: `make fmt vet test lint`（CI では race テストと govulncheck も走る）
- フロントエンド: `yarn check && yarn build`
- 配信形式を変えたら、`wire` のテストとフロントの `protocol/types.ts`・`test/fixtures.ts` をそろえる
