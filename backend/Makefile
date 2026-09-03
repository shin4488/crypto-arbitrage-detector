# バックエンド（Go）の開発用タスク
#
# Go はローカルに入れない前提なので、既定では Docker コンテナの中で go コマンドを動かす。
# ローカルに Go がある環境や CI では `make test GO=go` のように上書きできる。

GO_IMAGE      ?= golang:1.24-alpine
LINT_IMAGE    ?= golangci/golangci-lint:v2.1.6
MOD_CACHE     ?= crypto-arb-gomod
BUILD_CACHE   ?= crypto-arb-gobuild

# コンテナ内で動かす go コマンド。モジュールとビルドのキャッシュは名前付きボリュームに残し、2回目以降を速くする。
DOCKER_GO = docker run --rm -t \
	-v "$(CURDIR)":/src -w /src \
	-v $(MOD_CACHE):/go/pkg/mod \
	-v $(BUILD_CACHE):/root/.cache/go-build \
	-e CGO_ENABLED=0 \
	$(GO_IMAGE)
GO ?= $(DOCKER_GO) go

.PHONY: help tidy fmt vet test test-race cover lint build run clean

help: ## タスク一覧を表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-12s %s\n", $$1, $$2}'

tidy: ## go.mod / go.sum を整理
	$(GO) mod tidy

fmt: ## コード整形（gofmt）
	$(GO) fmt ./...

vet: ## 静的検査（go vet）
	$(GO) vet ./...

test: ## テスト実行
	$(GO) test ./...

test-race: ## データ競合の検出付きテスト（CGO が必要なので golang:1.24 などの glibc イメージかローカルの Go で実行する）
	$(GO) test -race ./...

cover: ## カバレッジ計測
	$(GO) test -coverprofile=coverage.out ./... && $(GO) tool cover -func=coverage.out | tail -1

lint: ## golangci-lint 実行
	docker run --rm -t -v "$(CURDIR)":/src -w /src -v $(MOD_CACHE):/go/pkg/mod $(LINT_IMAGE) golangci-lint run ./...

build: ## バイナリをビルド（bin/server）
	$(GO) build -o bin/server ./cmd/server

run: ## 開発用にサーバーを起動（docker compose の backend-dev、ポート8080）
	cd .. && docker compose --profile dev up backend-dev

clean: ## 生成物を削除
	rm -rf bin coverage.out
