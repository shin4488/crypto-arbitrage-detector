import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 各テスト後に描画した DOM を片付ける（テスト間の干渉を防ぐ）
afterEach(() => {
  cleanup();
});
