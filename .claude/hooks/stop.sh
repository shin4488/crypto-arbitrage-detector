#!/usr/bin/env bash
set -e
input=$(cat)
# このhookで応答を再開した場合は、再び停止させない。
[ "$(jq -r '.stop_hook_active // false' <<< "$input")" = true ] && exit 0
event_cwd=$(jq -er '.cwd' <<< "$input")
project_dir=$(git -C "$event_cwd" rev-parse --show-toplevel)
cd "$project_dir"

# 削除・改名・未追跡ファイルも含めて、変更のある側を一度ずつ検査する。
targets=()
[ -z "$(git status --porcelain --untracked-files=all -- backend)" ] || targets+=("$PWD/backend/")
[ -z "$(git status --porcelain --untracked-files=all -- frontend)" ] || targets+=("$PWD/frontend/")
exec bash .claude/hooks/post-edit.sh "${targets[@]}"
