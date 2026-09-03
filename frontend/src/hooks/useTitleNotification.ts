import { useEffect } from 'react';

/**
 * 利益が出ている間、タブのタイトルに目印を出す。summary が null なら元のタイトルに戻す。
 * document.title を書き換えるだけで、summary が変わったときにしか動かない。
 */
export function useTitleNotification(summary: string | null, baseTitle: string): void {
  useEffect(() => {
    document.title = summary ? `● ${summary} | ${baseTitle}` : baseTitle;
    return () => {
      document.title = baseTitle;
    };
  }, [summary, baseTitle]);
}
