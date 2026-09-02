import { useEffect } from 'react';

/**
 * 機会がある間、タブのタイトルに目印を出す。
 * enabled が false か summary が null なら元のタイトルに戻す。
 */
export function useTitleNotification(
  enabled: boolean,
  summary: string | null,
  baseTitle: string,
): void {
  useEffect(() => {
    document.title = enabled && summary ? `● ${summary} | ${baseTitle}` : baseTitle;
    return () => {
      document.title = baseTitle;
    };
  }, [enabled, summary, baseTitle]);
}
