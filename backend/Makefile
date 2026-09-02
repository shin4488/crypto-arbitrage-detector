# バックエンド（Go）の開発用タスク
#
# このMacにはGoをインストールしない方針のため、既定ではDockerコンテナ内でGoを実行する。
# ローカルにGoがある環境やCIでは `make test GO=go` のように上書きできる。

GO_IMAGE      ?= golang:1.24-alpine
LINT_IMAGE    ?= golangci/golangci-lint:v2.1.6
MOD_CACHE     ?= crypto-arb-gomod
BUILD_CACHE   ?= crypto-arb-gobuild

# コンテナ内で実行する go コマンド。モジュールとビルドのキャッシュを名前付きボリュームに保持して2回目以降を高速化する。
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

test-race: ## データ競合検出付きテスト（CGOが必要なためローカルGo向け。Docker内では -race を省略）
	$(GO) test -race ./...

cover: ## カバレッジ計測
	$(GO) test -coverprofile=coverage.out ./... && $(GO) tool cover -func=coverage.out | tail -1

lint: ## golangci-lint 実行
	docker run --rm -t -v "$(CURDIR)":/src -w /src -v $(MOD_CACHE):/go/pkg/mod $(LINT_IMAGE) golangci-lint run ./...

build: ## バイナリをビルド（bin/server）
	$(GO) build -o bin/server ./cmd/server

run: ## サーバーをローカル実行（Docker内、ポート8080）
	docker run --rm -it -v "$(CURDIR)":/src -w /src -v $(MOD_CACHE):/go/pkg/mod -v $(BUILD_CACHE):/root/.cache/go-build -p 8080:8080 $(GO_IMAGE) go run ./cmd/server

clean: ## 生成物を削除
	rm -rf bin coverage.out
