import { useCallback, useState } from 'react';

/**
 * localStorage に保存される真偽値の設定。
 * 保存できない環境（プライベートモードなど）でも動くよう、読み書きの失敗は無視する。
 */
export function useStoredBoolean(
  key: string,
  defaultValue: boolean,
): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? defaultValue : stored === 'true';
    } catch {
      return defaultValue;
    }
  });
  const update = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // 保存できなくても画面上の設定は有効にする
      }
    },
    [key],
  );
  return [value, update];
}
