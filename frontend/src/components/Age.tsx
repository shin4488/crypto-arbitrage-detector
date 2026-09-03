import { useNow } from '../hooks/useNow';
import { useT } from '../i18n';

interface AgeProps {
  /** ISO 8601 の時刻 */
  since: string;
}

/** 「0.3秒前」のような経過時間。0.5秒ごとに更新される */
export function Age({ since }: AgeProps) {
  const now = useNow();
  const t = useT();
  const ms = now - Date.parse(since);
  return (
    <time dateTime={since} title={new Date(since).toLocaleString()}>
      {t.ago(ms)}
    </time>
  );
}

interface DurationProps {
  from: string;
  /** null なら現在まで（継続中） */
  to: string | null;
}

/** 開始から終了（または現在）までの継続時間 */
export function Duration({ from, to }: DurationProps) {
  const now = useNow();
  const t = useT();
  const end = to === null ? now : Date.parse(to);
  return <span>{t.duration(end - Date.parse(from))}</span>;
}
