# Crypto Arbitrage Detection System

リアルタイム暗号通貨アービトラージ検知システム（Docker版）

## 🏗️ アーキテクチャ

```
crypto-arb-system/
├── docker-compose.yml      # Docker Compose設定
├── frontend/               # React フロントエンド
│   ├── Dockerfile
│   ├── src/
│   └── ...
└── backend/                # Go バックエンド
    ├── Dockerfile
    ├── main.go
    └── ...
```

## 🚀 機能

- **リアルタイム価格監視**: Binance と OKX から WebSocket 経由でリアルタイム価格データを取得
- **アービトラージ検知**: 取引所間の価格差を検知して利益機会を特定  
- **リアルタイムUI**: 価格変化時の光るアニメーション効果
- **Docker環境**: 簡単なセットアップとデプロイ

## 📡 サポート対象

### 取引所
- Binance
- OKX

### 通貨ペア
- BTC/USDT
- ETH/USDT

## 🛠️ セットアップ

### 前提条件
- Docker
- Docker Compose

### 起動方法

1. **プロジェクトのクローン**
```bash
git clone <repository-url>
cd crypto-arb-system
```

2. **Docker Composeで起動**
```bash
docker-compose up --build
```

3. **アクセス**
- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:8080
- ヘルスチェック: http://localhost:8080/health

## 🔧 開発環境

### ログの確認
```bash
# 全サービスのログ
docker-compose logs -f

# 特定のサービスのログ
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 再ビルド
```bash
# 全体の再ビルド
docker-compose up --build

# 特定のサービスの再ビルド
docker-compose up --build backend
```

### 停止
```bash
# 停止
docker-compose down

# ボリュームも削除
docker-compose down -v
```

## 📊 データフロー

```
Binance WebSocket ─┐
                   ├─► Go Backend ─► WebSocket ─► React Frontend
OKX WebSocket ─────┘
```

1. **価格取得**: バックエンドが各取引所のWebSocket APIから価格データを取得
2. **アービトラージ検知**: 価格差を計算してアービトラージ機会を特定
3. **リアルタイム通信**: WebSocketでフロントエンドにリアルタイム配信
4. **UI更新**: 価格変化時にアニメーション効果で視覚的にフィードバック

## 🔄 新しい通貨ペアの追加

`backend/main.go` を編集：

```go
// Binance
binanceSymbols := []string{"BTCUSDT", "ETHUSDT", "ADAUSDT"} // 追加

// OKX  
okxSymbols := []string{"BTC-USDT", "ETH-USDT", "ADA-USDT"} // 追加
```

## 🐛 トラブルシューティング

### よくある問題

1. **ポートが使用中**
```bash
# ポート確認
lsof -i :3000
lsof -i :8080

# Docker Composeでポート変更
# docker-compose.ymlのportsセクションを編集
```

2. **コンテナが起動しない**
```bash
# ログ確認
docker-compose logs backend
docker-compose logs frontend

# コンテナの状態確認
docker-compose ps
```

3. **WebSocket接続エラー**
- バックエンドが正常に起動しているか確認
- ファイアウォール設定を確認
- ブラウザの開発者ツールでネットワークエラーを確認

## 📈 パフォーマンス

- **レイテンシ**: WebSocket接続により超低遅延でのリアルタイム更新
- **スケーラビリティ**: Docker環境により水平スケーリングが容易
- **リソース効率**: Go言語による低メモリ使用量

## 🔒 セキュリティ

- CORS設定による適切なオリジン制御
- WebSocket接続の適切なクローズ処理
- 本番環境では環境変数による設定管理を推奨

## �� ライセンス

MIT License 