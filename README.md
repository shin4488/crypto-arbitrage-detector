# Crypto Arbitrage Detection System

リアルタイム暗号通貨アービトラージ検知システム（Docker版）

## 🏗️ アーキテクチャ

```
crypto-arbitrage-detector/
├── docker-compose.yml      # Docker Compose設定
├── frontend/               # React TypeScript フロントエンド
│   ├── Dockerfile
│   ├── src/
│   └── ...
└── backend/                # Go バックエンド
    ├── Dockerfile
    ├── main.go
    ├── arbitrage/          # アービトラージ検知エンジン
    └── ...
```

## 🚀 機能

- **リアルタイム価格監視**: Binance と OKX から WebSocket 経由でリアルタイム価格データを取得
- **高速アービトラージ検知**: 取引所間の価格差を即座に検知して利益機会を特定
- **リアルタイムUI**: 価格変化時の光るアニメーション効果とダークテーマUI
- **多言語対応**: ブラウザ言語に基づく自動言語切り替え（日本語/英語）
- **Docker環境**: 簡単なセットアップとデプロイ

## 📡 サポート対象

### 取引所
- **Binance**: bid/ask 価格をリアルタイム取得
- **OKX**: bid/ask 価格をリアルタイム取得

### 通貨ペア
- **BTC/USDT**: ビットコイン/テザー
- **ETH/USDT**: イーサリアム/テザー

## 🎯 アービトラージ検知仕様

### 検知ロジック
- **データ有効期限**: 5秒以内の価格データのみ使用
- **最小スプレッド閾値**: なし（小さな機会も検知）
- **検知パターン**:
  1. OKXで買い → Binanceで売り
  2. Binanceで買い → OKXで売り
- **利益計算**: `(売り量 × 売り価格) - (買い量 × 買り価格)`

### 取引量制限
- **BTC/USDT**: 最大1.0 BTC、最小0.00001 BTC
- **ETH/USDT**: 最大10.0 ETH、最小0.0001 ETH
- **取引可能量**: 買い側と売り側の最小量を採用

### 表示仕様
- **利益のみ表示**: 正のスプレッドのみ表示
- **損失時**: 「機会なし」として表示
- **リアルタイム更新**: 価格変動があれば即座にUI更新

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
OKX WebSocket ─────┘    (アービトラージ検知)       (リアルタイムUI)
```

1. **価格取得**: バックエンドが各取引所のWebSocket APIからbid/ask価格データを取得
2. **データ検証**: 5秒以内の新鮮な価格データのみを使用
3. **アービトラージ検知**: 2つの検知パターンで価格差を計算し最適な機会を特定
4. **利益計算**: 実際の取引可能量を考慮した利益額を算出
5. **リアルタイム通信**: WebSocketでフロントエンドにリアルタイム配信
6. **UI更新**: 価格変化時にアニメーション効果で視覚的にフィードバック

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

## 📈 パフォーマンス特性

- **レイテンシ**: WebSocket接続により超低遅延でのリアルタイム更新
- **検知速度**: 5秒以内の新鮮なデータによる高速検知
- **スケーラビリティ**: Docker環境により水平スケーリングが容易
- **リソース効率**: Go言語による低メモリ使用量とgoroutineによる並行処理
- **UI応答性**: 価格変動時の即座のアニメーション反映

## 🔒 セキュリティ

- CORS設定による適切なオリジン制御
- WebSocket接続の適切なクローズ処理
- decimal.Decimal による高精度計算（浮動小数点誤差回避）
- 本番環境では環境変数による設定管理を推奨

## 💡 技術的特徴

### バックエンド（Go）
- **高精度計算**: `shopspring/decimal` による正確な価格・利益計算
- **並行処理**: goroutine による複数取引所の同時監視
- **エラーハンドリング**: WebSocket接続の自動復旧機能
- **データ管理**: bid/ask 価格の分離管理とstale データフィルタリング

### フロントエンド（React TypeScript）
- **Material-UI**: モダンなダークテーマデザイン
- **リアルタイムアニメーション**: 価格変動時のflashアニメーション
- **多言語対応**: ブラウザ言語検出による自動切り替え
- **TypeScript**: 型安全なコードによる開発効率向上
- **ESLint + Prettier**: 一貫したコード品質管理

## �� ライセンス

MIT License 