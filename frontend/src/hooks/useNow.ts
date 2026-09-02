import { useEffect, useState } from 'react';

/**
 * 一定間隔で更新される現在時刻（ミリ秒）。「x秒前」や継続時間の表示に使う。
 * 必要な末端のコンポーネントだけで使い、画面全体の再描画を避ける。
 */
export function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
