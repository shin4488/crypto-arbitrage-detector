#!/bin/sh
# Claude Code の hook。Claude がファイルを編集した直後（PostToolUse）と応答を終えるとき（Stop）に、
# 変更のあった側（backend / frontend）の整形と lint を make 経由で Docker の中で実行する。
# 整形はそのまま適用し、lint の指摘が残ったら終了コード 2 で出力を Claude に返して修正させる。
#
# 標準入力の JSON は jq に頼らず grep で見る。編集したファイル（file_path）があればその側だけ、
# なければ（Stop のとき）git の変更一覧から判断する。

cd "$CLAUDE_PROJECT_DIR" || exit 1
input=$(cat)

# この hook が止めた応答の続きでは再度止めない（無限ループの防止）
printf '%s' "$input" | grep -q '"stop_hook_active" *: *true' && exit 0

file=$(printf '%s' "$input" | grep -o '"file_path" *: *"[^"]*"' | head -n 1 | cut -d '"' -f 4)
if [ -n "$file" ]; then
  changed=${file#"$PWD"/}
else
  changed=$(git status --porcelain --untracked-files=all | cut -c 4-)
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
