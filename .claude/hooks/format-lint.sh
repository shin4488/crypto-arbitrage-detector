#!/bin/sh
# Claude Code の hook。Claude がファイルを編集したあと（PostToolUse）と応答を終えるとき（Stop）に、
# 変更のあった側（backend / frontend）の整形と lint を Docker の中で実行する。
#
# - 整形と安全な自動修正はそのまま適用する
# - lint の指摘が残ったら終了コード 2 で内容を Claude に返し、修正させる
# - Docker が動いていなければ何もしない（環境の都合で作業を止めない）
#
# 入力は標準入力の JSON。jq に依存しないよう、必要なキーだけ grep と sed で取り出す。
set -u

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
input="$(cat)"

# キー $1 の値（文字列か真偽値）を取り出す。値に " を含まない前提で、パスと真偽値にしか使わない
json_value() {
  printf '%s' "$input" \
    | grep -oE "\"$1\"[[:space:]]*:[[:space:]]*(\"[^\"]*\"|true|false)" \
    | head -n 1 \
    | sed -E 's/^"[^"]*"[[:space:]]*:[[:space:]]*"?//; s/"$//'
}

case "$(json_value hook_event_name)" in
  PostToolUse)
    # Edit / Write / MultiEdit が触ったファイル
    paths="$(json_value file_path)"
    ;;
  Stop)
    # この hook が止めた応答の続きでは再度止めない（無限ループの防止）
    [ "$(json_value stop_hook_active)" = "true" ] && exit 0
    # Bash で編集した場合も拾えるよう、git の変更一覧（変更・追加・未追跡）から判断する
    paths="$(git -C "$root" status --porcelain --untracked-files=all | cut -c4-)"
    ;;
  *)
    exit 0
    ;;
esac

[ -z "$paths" ] && exit 0

backend=0
frontend=0
IFS='
'
for p in $paths; do
  p="${p#"$root"/}"
  case "$p" in
    backend/*.go | backend/go.mod | backend/go.sum | backend/.golangci.yml) backend=1 ;;
    frontend/node_modules/* | frontend/dist/*) ;;
    frontend/*) frontend=1 ;;
  esac
done
unset IFS

[ "$backend" = 0 ] && [ "$frontend" = 0 ] && exit 0

if ! docker info >/dev/null 2>&1; then
  echo "format-lint hook: Docker が動いていないため整形と lint を省略しました" >&2
  exit 0
fi

log="$(mktemp)"
trap 'rm -f "$log"' EXIT
failed=""
if [ "$backend" = 1 ]; then
  make -s -C "$root/backend" fmt lint >>"$log" 2>&1 || failed="$failed backend"
fi
if [ "$frontend" = 1 ]; then
  make -s -C "$root" frontend-fmt >>"$log" 2>&1 || failed="$failed frontend"
fi

if [ -n "$failed" ]; then
  {
    echo "lint の指摘があります（${failed# }）。以下を修正してください:"
    cat "$log"
  } >&2
  exit 2
fi
