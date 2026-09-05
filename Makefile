# リポジトリ全体の開発タスク。個別のタスクは backend/Makefile と frontend/package.json を参照。
#
# Go も Node.js もローカルに入れない前提で、バックエンドは backend/Makefile が、フロントエンドはここが
# Docker コンテナの中でコマンドを動かす。フロントエンドは docker compose の frontend-dev サービスを使い、
# node_modules はコンテナ専用のボリュームに置く（macOS 用のバイナリと混ざらないようにするため）。
# ローカルの Node.js で動かすなら `make frontend-lint FRONTEND_SH="cd frontend && sh -c"` のように上書きできる。

FRONTEND_SH ?= docker compose run --rm --no-deps -T frontend-dev sh -c
# Node.js に同梱の corepack 経由で、package.json の packageManager に固定した版の yarn を呼び出す
YARN ?= corepack yarn

.PHONY: help fmt test lint build up dev down logs backend-fmt backend-test backend-lint frontend-fmt frontend-test frontend-lint

help: ## タスク一覧を表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

fmt: backend-fmt frontend-fmt ## バックエンドとフロントエンドのコード整形（Claude Code の hook もこれを使う）

test: backend-test frontend-test ## バックエンドとフロントエンドのテストを実行

lint: backend-lint frontend-lint ## バックエンドとフロントエンドの静的検査を実行

backend-fmt: ## バックエンドの整形（gofmt + goimports）
	$(MAKE) -C backend fmt

backend-test: ## バックエンドのテスト（Docker 内の Go で実行）
	$(MAKE) -C backend test

backend-lint: ## バックエンドの lint（golangci-lint）
	$(MAKE) -C backend vet lint

frontend-fmt: ## フロントエンドの整形と安全な自動修正（Biome）。直せない lint の指摘が残れば失敗する
	$(FRONTEND_SH) '$(YARN) install --immutable && $(YARN) lint:fix'

frontend-test: ## フロントエンドのテスト
	$(FRONTEND_SH) '$(YARN) install --immutable && $(YARN) test'

frontend-lint: ## フロントエンドの型検査と lint
	$(FRONTEND_SH) '$(YARN) install --immutable && $(YARN) typecheck && $(YARN) lint'

build: ## 本番用 Docker イメージをビルド
	docker compose build

up: ## 本番相当の構成で起動（http://localhost:8080）
	docker compose up --build

dev: ## 開発用に起動（画面 http://localhost:3000、バックエンド 8080。ソースの変更が反映される）
	docker compose --profile dev up backend-dev frontend-dev

down: ## 停止
	docker compose down

logs: ## ログを表示
	docker compose logs -f

# 導入済みのCLIにだけ共通AIプラグインを登録する。ユーザー単位なので他リポジトリでも使える。
.PHONY: setup

setup:
	@if command -v claude >/dev/null 2>&1; then \
		claude plugin marketplace add shin4488/agent-plugins --scope user && \
		claude plugin install agent-plugins@agent-plugins --scope user; \
	else \
		printf '%s\n' 'Claude Code is not installed; skipping plugin setup.'; \
	fi
	@if command -v codex >/dev/null 2>&1; then \
		codex plugin marketplace add shin4488/agent-plugins && \
		codex plugin add agent-plugins@agent-plugins; \
	else \
		printf '%s\n' 'Codex is not installed; skipping plugin setup.'; \
	fi
