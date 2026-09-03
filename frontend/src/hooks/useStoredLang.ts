import { useCallback, useState } from 'react';
import { detectLang, type Lang } from '../i18n';

const KEY = 'arb.lang';

/**
 * 表示言語。初回はブラウザの言語設定から決め、画面で切り替えたら localStorage に保存する。
 * 保存できない環境（プライベートモードなど）でも動くよう、読み書きの失敗は無視する。
 */
export function useStoredLang(): [Lang, (lang: Lang) => void] {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(KEY);
      return stored === 'ja' || stored === 'en' ? stored : detectLang();
    } catch {
      return detectLang();
    }
  });
  const update = useCallback((next: Lang) => {
    setLang(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // 保存できなくても画面上の切り替えは有効にする
    }
  }, []);
  return [lang, update];
}
