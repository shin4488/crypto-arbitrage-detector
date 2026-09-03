import { useCallback, useRef, useState } from 'react';
import {
  applyLayoutAction,
  type LayoutAction,
  type PairLayout,
  parseLayout,
} from '../state/layout';

const KEY = 'arb.pairLayout';

/**
 * 通貨ペアのカードの並び順と表示・非表示。開き直しても保てるよう localStorage に保存する。
 * 保存できない環境（プライベートモードなど）でも動くよう、読み書きの失敗は無視する。
 */
export function usePairLayout(
  pairs: { pair: string }[],
): [PairLayout, (action: LayoutAction) => void] {
  const [layout, setLayout] = useState<PairLayout>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? parseLayout(JSON.parse(raw)) : parseLayout(null);
    } catch {
      return parseLayout(null);
    }
  });
  // 操作の関数を作り直さずに最新のペア一覧を参照できるようにする（カードの memo を効かせるため）
  const pairsRef = useRef(pairs);
  pairsRef.current = pairs;

  const act = useCallback((action: LayoutAction) => {
    setLayout((current) => {
      const next = applyLayoutAction(current, pairsRef.current, action);
      if (next !== current) {
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          // 保存できなくても画面上の設定は有効にする
        }
      }
      return next;
    });
  }, []);

  return [layout, act];
}
