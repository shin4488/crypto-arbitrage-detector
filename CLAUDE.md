# CLAUDE.md

このファイルは Claude Code がこのリポジトリで作業するときの手引きです。

## 概要

Binance と OKX の板を突き合わせ、手数料込みで利益が出る裁定機会を検知して表示するツール。売買の自動執行はしない。
仕様・構成・起動方法の詳細は README.md を参照。

- `backend/`: Go。取引所への WebSocket 接続、検知エンジン、画面への配信、フロントエンドの埋め込み配信
- `frontend/`: React + TypeScript（Vite）。ビルド成果物は Go バイナリに埋め込まれる
- 本番相当の実行は `docker compose up --build`（単一コンテナ、http://localhost:8080）

## 開発の約束事

- **テストから書く**。仕様を説明する名前のテスト（日本語可）を先に書き、仕様変更はまずテストを変える
- **コメント・ドキュメントは日本語**、識別子は英語。コメントは「なぜそうしているか」「ドメインの前提」などコードから読み取れないことを書く
- **固定の閾値を入れない**。数量の上限下限、最小スプレッド、データの有効期限（秒）などは仕様として排除している。板の突き合わせと接続状態で判断する
- **依存を増やさない**（サプライチェーン対策）。Go はサードパーティ2つのみ、フロントの実行時依存は react のみ。追加が必要なら理由を明確にし、推移的依存の少ないものを選ぶ
- **機密情報は絶対に commit しない**。現状 API キー等は不要。必要になっても環境変数で渡す
- **コミットは意味ごとに分ける**（revert しやすい単位）
- UI はかっこよさより見やすさ・使いやすさ。装飾より情報の読みやすさを優先

## コマンド

Go はこの環境にインストールしない前提で、`backend/Makefile` が Docker コンテナ内で Go を実行する（`make test GO=go` でローカル Go に切り替え可能）。

```bash
# バックエンド
cd backend
make test          # テスト
make vet lint      # 静的検査（golangci-lint は Docker イメージで実行）
make fmt           # gofmt
make run           # Docker 内で go run（8080）

# フロントエンド（Yarn Berry を corepack 経由で使う）
cd frontend
corepack enable
yarn install       # lockfile と一致しない場合は失敗させたいなら --immutable
yarn dev           # 開発サーバー（3000、/ws を 8080 へ中継）
yarn check         # 型検査 + lint + テスト
yarn build         # dist/ を生成

# 全体
make test / make lint / make up
```

## 構成の要点

- `internal/arbitrage`: 板走査の純粋関数。ここが検知の中核で、テストが仕様書を兼ねる
- `internal/engine`: 板の保持と両方向の評価、機会（Episode）の開始・更新・終了、接続状態。イベントに通し番号 `Seq` を振る
- `internal/server`: クライアントごとの送信箱（同じ対象は最新だけ残す）で遅いクライアントを隔離する
- `internal/exchange/wsclient`: 再接続・keep-alive・受信タイムアウトの共通処理。取引所ごとの差分は `binance/`, `okx/`
- `internal/wire`: 配信 JSON の形式。フロントの `src/protocol/types.ts` と対応させる
- 取引所の追加: `internal/exchange/<name>/` に `exchange.Feed` を実装し `registry` に登録
- 通貨ペアの追加: 設定の `pairs` に追加するだけ

## 変更時の確認

- バックエンド: `make fmt vet test lint`（CI では race テストと govulncheck も走る）
- フロントエンド: `yarn check && yarn build`
- 配信形式を変えたら `wire` のテストとフロントの `protocol/types.ts`・`test/fixtures.ts` を揃える
