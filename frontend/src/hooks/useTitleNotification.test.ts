import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTitleNotification } from './useTitleNotification';

describe('useTitleNotification', () => {
  it('利益が出ている間はタイトルに目印を付け、無くなれば戻す', () => {
    const { rerender, unmount } = renderHook(
      ({ summary }) => useTitleNotification(summary, 'App'),
      { initialProps: { summary: 'BTC +1.23' as string | null } },
    );
    expect(document.title).toBe('● BTC +1.23 | App');

    rerender({ summary: null });
    expect(document.title).toBe('App');

    rerender({ summary: 'ETH +0.45' });
    expect(document.title).toBe('● ETH +0.45 | App');

    unmount();
    expect(document.title).toBe('App');
  });
});
