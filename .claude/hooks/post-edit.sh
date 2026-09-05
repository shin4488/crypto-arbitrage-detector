#!/usr/bin/env bash
# 共通プラグインから編集ファイル、Stopから変更のあるディレクトリを受け取る。
check_backend=false
check_frontend=false
for file; do
  case "$file" in
    "$PWD"/backend/*) check_backend=true ;;
    "$PWD"/frontend/*) check_frontend=true ;;
  esac
done

if ! $check_backend && ! $check_frontend; then
  exit 0
fi
# Go・Node.jsはホストに不要というリポジトリの方針を守る。Docker未起動時は代替実行しない。
docker info >/dev/null 2>&1 || exit 0
# 一方が失敗してももう一方を確認し、残る指摘をまとめて修正できるようにする。
status=0
if $check_backend; then
  make -s -C backend fmt lint >&2 || status=2
fi
if $check_frontend; then
  make -s frontend-fmt >&2 || status=2
fi
if [ "$status" -ne 0 ]; then
  echo "上の lint の指摘を修正してください" >&2
fi
exit "$status"
