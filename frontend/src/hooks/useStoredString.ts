import { useCallback, useState } from 'react';

/**
 * localStorage に保存される文字列の設定。
 * 保存できない環境（プライベートモードなど）でも動くよう、読み書きの失敗は無視する。
 */
export function useStoredString(key: string, defaultValue: string): [string, (v: string) => void] {
  const [value, setValue] = useState<string>(() => {
    try {
      return localStorage.getItem(key) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const update = useCallback(
    (next: string) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // 保存できなくても画面上の設定は有効にする
      }
    },
    [key],
  );
  return [value, update];
}
