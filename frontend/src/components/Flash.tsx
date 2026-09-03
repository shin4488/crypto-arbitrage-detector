import { type ReactNode, useEffect, useRef, useState } from 'react';

interface FlashProps {
  /** この値が変わったときに背景を一瞬光らせる */
  value: string;
  children: ReactNode;
  className?: string;
}

/**
 * 値が変わった瞬間だけ控えめに背景を光らせ、どこが動いたか目で追えるようにする。
 * 初回描画では光らせない（画面を開いた直後に全てが光るのを避ける）。
 */
export function Flash({ value, children, className }: FlashProps) {
  const previous = useRef(value);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      setTick((t) => t + 1);
    }
  }, [value]);

  // key を変えることでアニメーションを毎回最初から再生する
  return (
    <span key={tick} className={`${tick > 0 ? 'flash' : ''} ${className ?? ''}`.trim()}>
      {children}
    </span>
  );
}
