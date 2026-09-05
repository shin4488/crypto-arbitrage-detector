#!/usr/bin/env bash
# 共通プラグインから編集ファイル、Stopから変更のあるディレクトリを受け取る。
backend=false
frontend=false
for file; do
  case "$file" in
    "$PWD"/backend/*) backend=true ;;
    "$PWD"/frontend/*) frontend=true ;;
  esac
done

$backend || $frontend || exit 0
# Go・Node.jsはホストに不要というリポジトリの方針を守る。Docker未起動時は代替実行しない。
docker info >/dev/null 2>&1 || exit 0
# 一方が失敗してももう一方を確認し、残る指摘をまとめて修正できるようにする。
status=0
if $backend; then
  make -s -C backend fmt lint >&2 || status=2
fi
if $frontend; then
  make -s frontend-fmt >&2 || status=2
fi
[ "$status" = 0 ] || echo "上の lint の指摘を修正してください" >&2
exit "$status"
