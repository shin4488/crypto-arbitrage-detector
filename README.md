# Crypto Arbitrage Detector

暗号資産取引所（Binance および OKX）のオーダーブック（板情報）をリアルタイムに監視し、取引所間の価格差から手数料を差し引いた「純利益が見込める機会」を検知・可視化するツールです。

※ 本ツールは価格差の検知と画面表示のみを行い、自動発注は行いません。

---

## 主な特徴

- **リアルタイム検知**: 各取引所のWebSocketフィードを常時受信し、ミリ秒単位でオーダーブックを突き合わせて利鞘を算出。
- **実効利益の計算**: 単純な最良気配の比較だけでなく、板の厚み（深さ）とtaker手数料率（往復分）を考慮した現実的な利益を試算。
- **直感的なダッシュボード**: 有利な売買方向、推定純利益、各取引所の最良気配、検知履歴をリアルタイムに表示。
- **シングルコンテナ配信**: ビルド済みReactフロントエンドをGoバイナリに内包し、単一のコンテナでシンプルに稼働。

---

## アーキテクチャ

```mermaid
flowchart LR
    subgraph Exchanges["暗号資産取引所"]
        B["Binance<br>(WebSocket)"]
        O["OKX<br>(WebSocket)"]
    end

    subgraph Backend["Go バックエンド (:8080)"]
        Feed["Exchange Feed<br>(板情報受信 & 再接続)"]
        Engine["Arbitrage Engine<br>(利鞘計算 & 履歴管理)"]
        WS["WebSocket Server<br>(/ws 差分配信)"]
    end

    subgraph Frontend["フロントエンド"]
        UI["React SPA<br>(リアルタイム描画 & 設定)"]
    end

    B --> Feed
    O --> Feed
    Feed --> Engine
    Engine --> WS
    WS -->|WebSocket| UI
```

---

## 技術スタック

- **バックエンド**: Go, Gorilla WebSocket, Decimal
- **フロントエンド**: React, TypeScript, Vite, Biome
- **インフラ**: Docker, Docker Compose

---

## クイックスタート

Docker環境があれば、ローカルにGoやNode.jsをインストールすることなく起動できます。

```bash
# 本番相当（単一コンテナで起動）
docker compose up --build
```

起動後、ブラウザで `http://localhost:8080` にアクセスします。

### 開発環境での起動

```bash
# バックエンドとフロントエンドをホットリロード付きで起動
make dev
```

- フロントエンド（開発UI）: `http://localhost:3000`
- バックエンド（API / WebSocket）: `http://localhost:8080`

---

## 主なコマンド

```bash
make fmt    # コード整形（Go: gofmt/goimports, TS: Biome）
make test   # テスト実行（競合状態検知付き）
make lint   # 静的解析（golangci-lint, 型検査, Biome）
```

---

## 設定方法

監視対象の通貨ペアや取引所の手数料率は `backend/config.json` で管理されています。

```json
{
  "server": {
    "addr": ":8080"
  },
  "pairs": [
    "BTC/USDT",
    "ETH/USDT"
  ]
}
```

- **通貨ペアの追加**: `pairs` 配列に `"SOL/USDT"` などのシンボルを追記して再起動するだけで、自動的に監視が開始されます。
- **環境変数による上書き**: `ARB_CONFIG` で任意の設定JSONファイルを指定できるほか、`ARB_ADDR` や `ARB_LOG_LEVEL` などの環境変数にも対応しています。

---

## アクセス解析

本番サイトは専用の Google Analytics 4 プロパティで計測します。設定の入口は
[Google Analytics](https://analytics.google.com/analytics/web/#/a154552231p557168511/reports/intelligenthome)
です。タイムゾーンは日本時間、レポート通貨は日本円です。

`frontend/src/analytics.ts` が本番ビルドかつ本番オリジンの場合だけタグを読み込みます。
ローカル開発・プレビューは集計しません。本番ドメインや測定ストリームを変更するときは、
このファイルの公開識別子・オリジンと Google Analytics 側のストリームをそろえてください。

ページビュー・流入元・新規／再訪・利用時間・端末・地域に加えて、次の操作を計測します。

| イベント | 計測する操作 | 追加パラメータ |
| --- | --- | --- |
| `dashboard_ready` | 配信データを受信して画面が利用可能になった | なし |
| `language_changed` | 表示言語の変更 | `ui_language` |
| `theme_changed` | 配色の変更 | `ui_theme` |
| `pair_visibility_changed` | 通貨ペアの表示／非表示 | `pair_symbol`、`visible` |
| `pairs_reset` | すべての通貨ペアを再表示 | なし |
| `pair_reordered` | 通貨ペアの並べ替え | `pair_symbol`、`interaction_method` |
| `amount_changed` | 金額欄の編集後にフォーカスを移動 | なし |
| `fee_info_opened` | 手数料の説明をボタンで表示 | なし |

表示言語と配色はユーザー属性 `ui_language`・`ui_theme` にも反映します。
取引金額・利益・板データ・個人を識別するユーザーIDは送信しません。URLと参照元からクエリと断片を除き、
変化する利益通知タイトルの代わりに固定ページ名を使います。広告向けの Google シグナルと広告のパーソナライズは無効です。
拡張計測はページビュー・スクロール・離脱クリックを使い、フォーム・検索・動画・ダウンロードは無効にしています。
解析タグがブロックされた場合も監視画面は動作します。

## ディレクトリ構成

```text
crypto-arbitrage-detector/
├── backend/
│   ├── cmd/server/            # サーバー起動・エントリポイント
│   ├── internal/
│   │   ├── arbitrage/         # 板突き合わせ・利鞘計算ロジック
│   │   ├── engine/            # 板の保持・判定・機会の履歴管理
│   │   ├── exchange/          # 取引所別WebSocketクライアント（Binance / OKX）
│   │   └── server/            # クライアント配信・HTTPハンドラ
│   └── config.json            # 通貨ペア・取引所設定
└── frontend/
    └── src/
        ├── components/        # UIコンポーネント（カード、ヘッダー、履歴等）
        ├── state/             # リアルタイム状態管理
        └── ws/                # 自動再接続付きWebSocketクライアント
```
