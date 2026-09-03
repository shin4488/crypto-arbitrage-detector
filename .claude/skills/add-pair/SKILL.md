---
name: add-pair
description: 「通貨ペアを追加したい」「ADA/USDT を足して」「監視するペアを増やして／減らして」と言われたら使う。backend/config.json の pairs を編集し、開発サーバーで購読と画面を確かめる。コード・テスト・README は触らない。
---

# 通貨ペアを追加する（減らす）

編集するのは `backend/config.json` の `pairs` だけ。Go・TypeScript・テスト・README・CLAUDE.md は変更しない。
ペアの一覧はコードにもドキュメントにも書かない方針で、取引所ごとのシンボル（`ADAUSDT`、`ADA-USDT`）も画面のカードも設定から自動で組み立てられる。

## 手順

1. 表記は `BASE/QUOTE` の大文字（例 `ADA/USDT`）。QUOTE は既存のペアと同じにする。画面の取引金額の単位は先頭のペアの QUOTE で表示するため。
2. `backend/config.json` の `pairs` の末尾に足す（減らすときは要素を消す）。並びは画面の初期表示順。重複や形式の誤りは起動時のエラーで止まる。編集後に Claude Code の hook が `make -C backend fmt lint` を Docker で回す（十数秒）が、JSON には何もしないので待つだけでよい。
3. `dev-server` skill のとおり `make dev` で動かす。起動済みなら `backend/scripts/dev.sh` が config.json の変更を検知して自動で再起動するので、再起動の操作はしない。本番相当（`docker compose up --build`）は使わない。
4. 下の合格条件 (a) (b) が通るまで確かめる。ブラウザのツールがあれば (c) も見る。通らなければ 2 に戻る。
5. 片方の取引所にしか無いペアは、カードが「データ待ち」のまま判定されない。(a) で購読の拒否が出るか、(c) で気配が片方しか入らなければ、足さずにその旨をユーザーに伝える。ユーザーに確認するのはこの場合だけ。
6. コミットは 1 つ。メッセージは `config: 通貨ペアに ADA/USDT を追加`（減らすなら `を外す`）。PR を頼まれたら本文に合格条件の結果を書く。

## 合格条件

(a) 購読: 最後の `[dev] go run ./cmd/server` より後に、`feed=binance` の URL に `adausdt@depth20@100ms` が含まれ、`feed=okx` の行もあり、`購読が拒否されました` が無い。

```bash
docker compose logs --tail 200 backend-dev | grep -E 'dev\]|接続しました feed=|購読が拒否'
```

(b) 配信: `init` の `pairs` に新しいペアが出る。frontend-dev コンテナの node を使うので、ローカルに Node.js は要らない。

```bash
docker compose exec -T frontend-dev node -e 'const ws=new WebSocket("ws://backend-dev:8080/ws");ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==="init"){console.log(m.pairs.map(p=>p.pair).join(", "));process.exit(0)}};setTimeout(()=>process.exit(1),5000)'
```

(c) 画面: http://localhost:3000 に新しいペアのチップとカードが出て、両取引所の買値・売値が入り、右上が「Binance・OKXに接続中」、コンソールにエラー・警告が無い。

## しないこと

- テスト・README・CLAUDE.md の編集。ペアの一覧に依存するテストは無く、ドキュメントも一覧を持たない
- 画面側の調整。表示桁は値の大きさから自動で決まる
- `make test` を確認の代わりにすること。設定の妥当性は起動時の検証で、購読の可否は合格条件で分かる
