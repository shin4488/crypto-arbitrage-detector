# syntax=docker/dockerfile:1
#
# フロントエンドをビルドして Go バイナリに埋め込み、1つの実行イメージにまとめる。
# 実行イメージは distroless（シェルもパッケージマネージャも入っていない）にして、動かすものを最小限にする。
# ベースイメージは digest で固定する。タグの中身が差し替わっても影響を受けないようにするため（更新は Dependabot が提案する）。
#
# RUN --mount=type=cache は BuildKit のキャッシュで、依存の取得やコンパイル結果を次回のビルドに引き継ぐ。

# --- フロントエンドのビルド ---
FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS frontend
WORKDIR /app/frontend
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    COREPACK_HOME=/cache/corepack \
    YARN_CACHE_FOLDER=/cache/yarn
# corepack が package.json の packageManager（ハッシュ付き）どおりの Yarn を取得する
RUN corepack enable
COPY frontend/package.json frontend/yarn.lock frontend/.yarnrc.yml ./
RUN --mount=type=cache,target=/cache \
    yarn install --immutable
COPY frontend/index.html frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/public ./public
COPY frontend/src ./src
RUN yarn build

# --- バックエンドのビルド ---
FROM golang:1.27-alpine@sha256:cf6fca6641884b8433441b2b0652976f975e1d0fdd26d177eaaf8596087f3125 AS backend
WORKDIR /app/backend
ENV CGO_ENABLED=0
COPY backend/go.mod backend/go.sum ./
# go.sum と Go のチェックサム DB で、取得した依存が改ざんされていないことを確かめる
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download && go mod verify
COPY backend/ ./
COPY --from=frontend /app/frontend/dist ./internal/webui/dist
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# --- 実行イメージ ---
FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab
LABEL org.opencontainers.image.title="crypto-arbitrage-detector" \
      org.opencontainers.image.source="https://github.com/shin4488/crypto-arbitrage-detector"
COPY --from=backend /out/server /server
EXPOSE 8080
# 実行イメージには curl や wget が無いので、バイナリに組み込んだヘルスチェックを使う
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["/server", "-healthcheck"]
ENTRYPOINT ["/server"]
