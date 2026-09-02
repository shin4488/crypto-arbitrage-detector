# リポジトリ全体の開発タスク。個別のタスクは backend/Makefile と frontend/package.json を参照。

.PHONY: help test lint build up dev down logs backend-test backend-lint frontend-test frontend-lint

help: ## タスク一覧を表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

test: backend-test frontend-test ## バックエンドとフロントエンドのテストを実行

lint: backend-lint frontend-lint ## バックエンドとフロントエンドの静的検査を実行

backend-test: ## バックエンドのテスト（Docker 内の Go で実行）
	$(MAKE) -C backend test

backend-lint: ## バックエンドの lint（golangci-lint）
	$(MAKE) -C backend vet lint

frontend-test: ## フロントエンドのテスト
	cd frontend && yarn install --immutable && yarn test

frontend-lint: ## フロントエンドの型検査と lint
	cd frontend && yarn install --immutable && yarn typecheck && yarn lint

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
