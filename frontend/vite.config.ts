import { defineConfig } from 'vitest/config';

// React 用プラグイン（Babel 依存）は使わず、Vite 内蔵の変換で TSX を扱う。
// 依存パッケージを減らしてサプライチェーンの影響範囲を小さくするため。
// 代償として編集時に React の状態が保持される Fast Refresh は効かない（モジュール単位の再読み込みになる）。
export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      // 開発中はバックエンド（8080）へ WebSocket を中継する。本番はバックエンドが静的ファイルごと配信するため同一オリジン。
      '/ws': {
        target: 'ws://localhost:8080',
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
