/**
 * 通貨ペアのカードの並び順と折りたたみ。見たいペアを上に、見ないペアは見出しだけにするための設定。
 * サーバーから届くペアの集合とは独立に持ち、知らないペアはサーバーの順で末尾に、無くなったペアは無視する。
 */
export interface PairLayout {
  /** 並び順（ペア名の配列）。ここに無いペアはサーバーの順で末尾に並ぶ */
  order: string[];
  collapsed: string[];
}

export type LayoutAction =
  | { type: 'toggleCollapsed' }
  /** 隣と入れ替える（キーボード操作用） */
  | { type: 'moveBy'; delta: -1 | 1 }
  /** 指定したペアの位置へ動かす（ドラッグ＆ドロップ用） */
  | { type: 'moveTo'; target: string };

export const emptyLayout: PairLayout = { order: [], collapsed: [] };

/** サーバーの順を基準に、保存した並び順を反映した全ペア */
export function orderedPairs<T extends { pair: string }>(pairs: T[], layout: PairLayout): T[] {
  const index = new Map(layout.order.map((id, i) => [id, i]));
  const known = pairs.filter((p) => index.has(p.pair));
  const unknown = pairs.filter((p) => !index.has(p.pair));
  known.sort((a, b) => (index.get(a.pair) ?? 0) - (index.get(b.pair) ?? 0));
  return [...known, ...unknown];
}

export function isCollapsed(layout: PairLayout, pair: string): boolean {
  return layout.collapsed.includes(pair);
}

/** 操作を適用した新しい設定を返す。pairs は現在サーバーから届いている全ペア（並び替えの基準にする） */
export function applyLayoutAction(
  layout: PairLayout,
  pairs: { pair: string }[],
  pair: string,
  action: LayoutAction,
): PairLayout {
  switch (action.type) {
    case 'toggleCollapsed':
      return {
        ...layout,
        collapsed: layout.collapsed.includes(pair)
          ? layout.collapsed.filter((id) => id !== pair)
          : [...layout.collapsed, pair],
      };
    case 'moveBy': {
      const ids = orderedPairs(pairs, layout).map((p) => p.pair);
      const from = ids.indexOf(pair);
      const to = from + action.delta;
      if (from === -1 || to < 0 || to >= ids.length) {
        return layout;
      }
      const next = ids.slice();
      [next[from], next[to]] = [next[to] as string, next[from] as string];
      return { ...layout, order: next };
    }
    case 'moveTo': {
      const ids = orderedPairs(pairs, layout).map((p) => p.pair);
      const from = ids.indexOf(pair);
      const to = ids.indexOf(action.target);
      if (from === -1 || to === -1 || from === to) {
        return layout;
      }
      // 動かすものを抜いてから目標の位置に差し込む。上へ動かせば目標の前、下へ動かせば目標の後ろに入る
      const next = ids.filter((id) => id !== pair);
      next.splice(to, 0, pair);
      return { ...layout, order: next };
    }
  }
}

/** localStorage から読んだ値を検証する。形が違えば既定値 */
export function parseLayout(raw: unknown): PairLayout {
  if (typeof raw !== 'object' || raw === null) {
    return emptyLayout;
  }
  const r = raw as Record<string, unknown>;
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return { order: strings(r.order), collapsed: strings(r.collapsed) };
}
