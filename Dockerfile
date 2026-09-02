# syntax=docker/dockerfile:1
#
# フロントエンドをビルドして Go バイナリに埋め込み、単一の実行イメージにする。
# 実行イメージは distroless（シェルもパッケージマネージャも無い）で、実行時の攻撃面を最小にする。
# ベースイメージは digest で固定し、タグの差し替えによる意図しない変更を防ぐ（更新は Dependabot が提案する）。

# --- フロントエンドのビルド ---
FROM node:24-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS frontend
WORKDIR /app/frontend
# package.json の packageManager（ハッシュ付き）で固定した Yarn を corepack が取得する
RUN corepack enable
COPY frontend/package.json frontend/yarn.lock frontend/.yarnrc.yml ./
RUN yarn install --immutable
COPY frontend/ ./
RUN yarn build

# --- バックエンドのビルド ---
FROM golang:1.24-alpine@sha256:8bee1901f1e530bfb4a7850aa7a479d17ae3a18beb6e09064ed54cfd245b7191 AS backend
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
# go.sum と Go のチェックサム DB で依存の内容が改ざんされていないことを検証する
RUN go mod download && go mod verify
COPY backend/ ./
COPY --from=frontend /app/frontend/dist ./internal/webui/dist
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# --- 実行イメージ ---
FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab
COPY --from=backend /out/server /server
EXPOSE 8080
# 実行イメージには curl 等が無いため、バイナリ自身のヘルスチェック機能を使う
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["/server", "-healthcheck"]
ENTRYPOINT ["/server"]
