import { defineConfig } from 'vitest/config';

// React 用プラグイン（Babel に依存する）は使わず、Vite に内蔵された変換で TSX を扱う。
// 依存パッケージを減らしてサプライチェーンの影響範囲を小さくするため。
// そのぶん、編集時にコンポーネントの状態を保ったまま更新する Fast Refresh は効かない（モジュール単位で再読み込みされる）。

// 開発サーバーの挙動は環境変数で切り替える（docker-compose.yml の frontend-dev を参照）
// 中継先は http:// で指定する。Vite は Origin ヘッダを中継先のオリジンに書き換えるが、
// ws:// で指定すると Origin も ws:// になり、バックエンドの同一オリジン判定（http/https）を通らない。
const proxyTarget = process.env.DEV_PROXY_TARGET ?? 'http://localhost:8080';
const watchPolling = process.env.DEV_WATCH_POLLING === 'true';

export default defineConfig({
  server: {
    // コンテナ内で動かすときは外から接続できるよう全インターフェースで待ち受ける
    host: watchPolling ? true : 'localhost',
    port: 3000,
    strictPort: true,
    watch: { usePolling: watchPolling },
    proxy: {
      // 開発中は /ws をバックエンドへ中継する。本番はバックエンドが画面ごと配信するので同一オリジンになる。
      '/ws': {
        target: proxyTarget,
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
});
