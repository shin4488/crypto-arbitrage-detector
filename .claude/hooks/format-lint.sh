#!/usr/bin/env bash
# 編集直後と応答終了時に、変更のあった側を既存の Docker タスクで検査する。
source "$(dirname "$0")/edited-files.sh"
cd "$project_dir" || exit 2

# この hook による応答の再開中は、再び停止させない。
[ "$(jq -r '.stop_hook_active // false' <<< "$input")" = true ] && exit 0

backend=false
frontend=false
if [ "$(jq -r '.hook_event_name // empty' <<< "$input")" = Stop ]; then
  # パス自体は不要。削除・改名・未追跡ファイルも含め、各側の変更の有無を調べる。
  [ -z "$(git status --porcelain --untracked-files=all -- backend)" ] || backend=true
  [ -z "$(git status --porcelain --untracked-files=all -- frontend)" ] || frontend=true
else
  for file in "${files[@]}"; do
    case "$file" in
      "$project_dir"/backend/*) backend=true ;;
      "$project_dir"/frontend/*) frontend=true ;;
    esac
  done
fi

$backend || $frontend || exit 0
docker info >/dev/null 2>&1 || exit 0
status=0
if $backend; then
  make -s -C backend fmt lint >&2 || status=2
fi
if $frontend; then
  make -s frontend-fmt >&2 || status=2
fi
[ "$status" = 0 ] || echo "上の lint の指摘を修正してください" >&2
exit "$status"
