---
name: dev-server
description: ローカル起動やブラウザでの動作確認に、ホットリロード付きの開発サーバーを使う。
---

# 開発サーバーをホットリロードで起動する

使うのは `make dev` だけ（`docker compose --profile dev up backend-dev frontend-dev` と同じ）。
`make up` と `docker compose up --build` は本番相当で、ソースの変更が反映されず 8080 番も衝突するので使わない。

1. ブラウザペイン（`preview_start`）が使えるなら `{"name": "dev"}` で起動する。`.claude/launch.json` が `make dev` を指していて、起動済みなら再利用される。
2. 使えない場合は、使用中のツールのバックグラウンド実行または継続セッションで `make dev` を起動する。
3. 画面は http://localhost:3000 を開く。8080 はバックエンドだけで、画面の `/ws` は 3000 が 8080 へ中継する。
4. 次の 2 つで準備完了を確かめる。初回はイメージ取得・依存のインストール・ビルドに数分かかる。待機中は間隔を空け、失敗・進捗停止・ポート競合があればログを調べる。同じ失敗で再起動を繰り返さない。
   - `curl -sf -o /dev/null http://localhost:3000`
   - `curl -sf -o /dev/null http://localhost:8080/healthz`
5. 起動後にソースを編集しても再起動しない。画面は数秒で更新され、バックエンドは `.go` の変更を検知して自動で再起動する（`backend/scripts/dev.sh`）。
6. 止めるのは `make down`。
