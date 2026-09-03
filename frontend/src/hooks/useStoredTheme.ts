import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'arb.theme';

/** OS の設定からライト／ダークを決める。matchMedia が無い環境（テスト）はライト */
export function detectTheme(): Theme {
  if (typeof matchMedia !== 'function') {
    return 'light';
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 画面の配色（ライト／ダーク）。初回は OS の設定から決め、画面で切り替えたら localStorage に保存する。
 * html の data-theme に反映し、CSS の color-scheme がそれに従う（システムカラーと light-dark() が切り替わる）。
 * 保存できない環境（プライベートモードなど）でも動くよう、読み書きの失敗は無視する。
 * 一度決めた後は OS の設定が変わっても追従しない（切り替えは画面で行う）。
 */
export function useStoredTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(KEY);
      return stored === 'light' || stored === 'dark' ? stored : detectTheme();
    } catch {
      return detectTheme();
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const update = useCallback((next: Theme) => {
    setTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // 保存できなくても画面上の切り替えは有効にする
    }
  }, []);
  return [theme, update];
}
