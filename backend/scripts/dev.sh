#!/bin/sh
# 開発用: Go のソースが変わったらサーバーを再起動する。
# Docker Desktop のバインドマウントではファイル変更の通知（inotify）が届かないので、
# 一定間隔で更新時刻を見比べる方式にしている。追加のツールを入れずに済ませるため sh だけで書く。
set -eu

interval="${DEV_POLL_INTERVAL:-2}"

snapshot() {
  # .go と go.mod / go.sum の更新時刻をまとめて1つの文字列にする
  find . -name '*.go' -o -name 'go.mod' -o -name 'go.sum' | sort | xargs stat -c '%n %Y' 2>/dev/null
}

pid=""
start() {
  echo "[dev] go run ./cmd/server"
  go run ./cmd/server &
  pid=$!
}

stop() {
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    # go run の子プロセス（ビルドしたバイナリ）ごと止める
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
}

trap 'stop; exit 0' INT TERM

last="$(snapshot)"
start
while true; do
  sleep "$interval"
  now="$(snapshot)"
  if [ "$now" != "$last" ]; then
    echo "[dev] ソースが変わったので再起動します"
    last="$now"
    stop
    start
  fi
done
