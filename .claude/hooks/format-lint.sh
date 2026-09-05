#!/bin/sh
# Claude Code の hook。Claude がファイルを編集した直後（PostToolUse）と応答を終えるとき（Stop）に、
# 変更のあった側（backend / frontend）の整形と lint を make 経由で Docker の中で実行する。
# 整形はそのまま適用し、lint の指摘が残ったら終了コード 2 で出力を Claude に返して修正させる。
#
# 標準入力の JSON は jq で読む。編集したファイル（file_path）があればその側だけ、
# なければ（Stop のとき）git の変更一覧から判断する。

project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
cd "$project_dir" || exit 1
input=$(cat)

# この hook が止めた応答の続きでは再度止めない（無限ループの防止）
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = true ] && exit 0

file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty') || exit 2
if [ -n "$file" ]; then
  changed=${file#"$PWD"/}
else
  # -z なら空白・引用符を含むパスも Git が引用しない。改名元は読み飛ばす。
  changed=$(git status --porcelain -z --untracked-files=all | python3 -c '
import sys
entries = iter(sys.stdin.buffer.read().split(b"\0"))
for entry in entries:
    if not entry:
        continue
    print(entry[3:].decode())
    if b"R" in entry[:2] or b"C" in entry[:2]:
        next(entries, None)
')
fi

# Docker が動いていなければ何もしない（環境の都合で作業を止めない）
docker info >/dev/null 2>&1 || exit 0

status=0
if printf '%s\n' "$changed" | grep -q '^backend/'; then
  make -s -C backend fmt lint >&2 || status=2
fi
if printf '%s\n' "$changed" | grep -q '^frontend/'; then
  make -s frontend-fmt >&2 || status=2
fi
[ "$status" = 0 ] || echo "上の lint の指摘を修正してください" >&2
exit "$status"
