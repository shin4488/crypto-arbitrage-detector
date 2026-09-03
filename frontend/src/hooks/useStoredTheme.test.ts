import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectTheme, useStoredTheme } from './useStoredTheme';

/** OS のライト／ダーク設定を装う（jsdom には matchMedia が無い） */
function stubPrefersDark(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('detectTheme', () => {
  it('OS がダークならダーク、そうでなければライト', () => {
    stubPrefersDark(true);
    expect(detectTheme()).toBe('dark');
    stubPrefersDark(false);
    expect(detectTheme()).toBe('light');
  });

  it('OS の設定が取れない環境ではライトにする', () => {
    expect(detectTheme()).toBe('light');
  });
});

describe('useStoredTheme', () => {
  it('保存が無ければ OS の設定に従い、html に反映する', () => {
    stubPrefersDark(true);
    const { result } = renderHook(() => useStoredTheme());
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('保存した値があれば OS の設定より優先する', () => {
    stubPrefersDark(true);
    localStorage.setItem('arb.theme', 'light');
    const { result } = renderHook(() => useStoredTheme());
    expect(result.current[0]).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('壊れた保存値は無視する', () => {
    localStorage.setItem('arb.theme', 'blue');
    const { result } = renderHook(() => useStoredTheme());
    expect(result.current[0]).toBe('light');
  });

  it('切り替えると html に反映し、保存する', () => {
    const { result } = renderHook(() => useStoredTheme());
    act(() => result.current[1]('dark'));
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('arb.theme')).toBe('dark');
  });

  it('保存できない環境でも切り替えは効く', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => useStoredTheme());
    act(() => result.current[1]('dark'));
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
