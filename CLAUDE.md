# 開発ガイド

BinanceとOKXの板を比較し、手数料を差し引いた裁定機会を表示する。注文は出さない。対象ペアは `backend/config.json` の `pairs`（`BASE/QUOTE`）だけで管理し、一覧をコードや文書へ複製しない。

## 実装の条件

- 振る舞いを変えるときは、仕様を説明するテストを先に書く。コメント・文書は日本語、識別子は英語。コメントには判断理由やドメインの前提を書く。
- 数量の上下限、最小スプレッド、データの有効期限といった固定閾値は導入しない。板と接続状態で判断する。
- 依存追加には理由を示し、推移的依存の少ないものを選ぶ。依存の正は `backend/go.mod` と `frontend/package.json`。
- 認証情報は環境変数で渡し、コミットしない。コミットは意味ごとに分ける。UIは見やすさと使いやすさを優先し、CSSを最小限にする。

## 起動と検証

Go・Node.jsをホストに要求せず、Makefile経由でDocker内で実行する。初期設定やオプションは [README](README.md)・`make help`・各Makefileを参照する。

| 対象 | 場所・コマンド |
| --- | --- |
| 開発サーバー | ルートで `make dev`。起動・確認は [dev-server](.claude/skills/dev-server/SKILL.md) |
| 本番相当の起動 | ルートで `docker compose up --build`（画面はlocalhost:8080） |
| 全体の整形・検証 | ルートで `make fmt test lint` |
| バックエンド変更 | `backend/` で `make fmt vet test lint` |
| フロントエンド変更 | `frontend-dev` の `/app` で `corepack yarn check && corepack yarn build` |

フロントの必須検証をホストから起動する場合:

```bash
docker compose run --rm --no-deps -T frontend-dev sh -c 'corepack yarn install --immutable && corepack yarn check && corepack yarn build'
```

ローカル環境がある場合は `make test GO=go`、`make frontend-lint FRONTEND_SH="cd frontend && sh -c"` で切り替えられる。文書・指示だけの変更ではリンク・内容を確認する。通貨ペアだけの変更は [add-pair](.claude/skills/add-pair/SKILL.md) の購読・配信確認に従う。CIではraceテストとgovulncheckも実行する。

## 変更箇所の入口

- 検知ロジックは `backend/internal/arbitrage` の純粋関数。`engine` が板・両方向評価・Episode・接続状態を管理し、イベントに `Seq` を付ける。
- `server` はクライアントごとの送信箱に対象の最新状態を保持し、遅いクライアントを分離する。
- 取引所共通の接続処理は `exchange/wsclient`、固有処理は `binance/`・`okx/`。追加時は `exchange.Feed` を実装して `registry` に登録する。
- 配信JSONを変える場合は `wire` のテストと `frontend/src/protocol/types.ts`・`test/fixtures.ts` をそろえる。
- `backend/config.json` は `embed.go` で埋め込み、`internal/config` が読む。React/ViteのビルドもGoバイナリに埋め込む。設定変更は開発時には自動再起動、本番相当では再ビルドで反映する。

## 共有設定とhook

- 導入は [Makefile](Makefile) の `make setup`。`.agents/skills`・`.codex/hooks` の相対リンクを維持し、実体はClaude側で編集する。Claudeの権限設定はCodexに引き継がれない。
- 共通pluginが `.claude/hooks/post-edit.sh` を呼ぶ。ローカル登録は両ツールの `Stop` のみで、編集後hookを重複登録しない。
- 整形・lintは編集後と応答終了時にDocker/Makefile経由で実行する。Bash編集も終了時のgit差分から確認する。Markdownだけの変更では起動しない。残ったlintの指摘は修正する。

## 作業の進め方

- `AGENTS.md` はこのファイルへの相対リンク。共通の本文は一度だけ読み、`CLAUDE.md` を編集する。
- 対象のファイル・見出し・シンボルから調べ、必要な場合だけ範囲を広げる。資料やskillsは作業に該当するものを読む。
- 不明点は質問して解消してから、その判断に依存する作業に進む。すでに決まっている事項は再確認しない。
- 文書の言語を保ち、日本語は日本人に、英語は英語圏の読者に自然に伝わる表現にする。
- 必須検証は適用条件に従って実行し、同じ差分・依存・設定・実行条件で得た結果は再利用する。問題を修正し、結果と未確認の範囲を簡潔に報告する。
- このガイドには継続して必要な規約と参照先を残す。進捗や設定値、他の資料・skillsの手順は複製しない。
