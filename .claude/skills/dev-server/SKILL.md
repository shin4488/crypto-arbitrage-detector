---
name: dev-server
description: 「localhost で起動したい」「ブラウザで動作確認したい」「動かして見たい」と言われたら使う。ホットリロードが効く開発用構成（make dev）でアプリを起動し、http://localhost:3000 を開く。本番相当の make up / docker compose up --build は使わない。
---

# 開発サーバーをホットリロードで起動する

使うのは `make dev` だけ（`docker compose --profile dev up backend-dev frontend-dev` と同じ）。
`make up` と `docker compose up --build` は本番相当で、ソースの変更が反映されず 8080 番も衝突するので使わない。

1. ブラウザペイン（`preview_start`）が使えるなら `{"name": "dev"}` で起動する。`.claude/launch.json` が `make dev` を指していて、起動済みなら再利用される。
2. 使えないなら Bash で `make dev` をバックグラウンド実行する（`run_in_background: true`）。
3. 画面は http://localhost:3000 を開く。8080 はバックエンドだけで、画面の `/ws` は 3000 が 8080 へ中継する。
4. 準備完了は固定秒の sleep で待たず、次の 2 つが両方通るまで繰り返し確かめる。初回はイメージ取得・`yarn install`・Go のビルドで数分かかる。
   - `curl -sf -o /dev/null http://localhost:3000`
   - `curl -sf -o /dev/null http://localhost:8080/healthz`
5. 起動後にソースを編集しても再起動しない。画面は数秒で更新され、バックエンドは `.go` の変更を検知して自動で再起動する（`backend/scripts/dev.sh`）。
6. 止めるのは `make down`。
