import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTitleNotification } from './useTitleNotification';

describe('useTitleNotification', () => {
  it('有効で機会があればタイトルに目印を付ける', () => {
    const { rerender, unmount } = renderHook(
      ({ enabled, summary }) => useTitleNotification(enabled, summary, 'App'),
      { initialProps: { enabled: true, summary: 'BTC +1.23' as string | null } },
    );
    expect(document.title).toBe('● BTC +1.23 | App');

    rerender({ enabled: true, summary: null });
    expect(document.title).toBe('App');

    rerender({ enabled: false, summary: 'BTC +1.23' });
    expect(document.title).toBe('App');

    unmount();
    expect(document.title).toBe('App');
  });
});
