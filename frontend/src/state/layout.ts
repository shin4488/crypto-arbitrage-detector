/**
 * 通貨ペアのカードの並び順と表示・非表示。見たいペアを見たい順に置くための設定。
 * サーバーから届くペアの集合とは独立に持ち、知らないペアはサーバーの順で末尾に、無くなったペアは無視する。
 */
export interface PairLayout {
  /** 並び順（ペア名の配列）。ここに無いペアはサーバーの順で末尾に並ぶ */
  order: string[];
  /** 隠しているペア。カードを出さないだけで、利益が出ればまとめの帯とタブのタイトルには出る */
  hidden: string[];
}

export type LayoutAction =
  | { type: 'toggleHidden'; pair: string }
  | { type: 'showAll' }
  /** 隣と入れ替える（キーボード操作用） */
  | { type: 'moveBy'; pair: string; delta: -1 | 1 }
  /** 指定したペアの位置へ動かす（ドラッグ＆ドロップ用） */
  | { type: 'moveTo'; pair: string; target: string };

export const emptyLayout: PairLayout = { order: [], hidden: [] };

/** サーバーの順を基準に、保存した並び順を反映した全ペア（隠しているものも含む） */
export function orderedPairs<T extends { pair: string }>(pairs: T[], layout: PairLayout): T[] {
  const index = new Map(layout.order.map((id, i) => [id, i]));
  const known = pairs.filter((p) => index.has(p.pair));
  const unknown = pairs.filter((p) => !index.has(p.pair));
  known.sort((a, b) => (index.get(a.pair) ?? 0) - (index.get(b.pair) ?? 0));
  return [...known, ...unknown];
}

export function isHidden(layout: PairLayout, pair: string): boolean {
  return layout.hidden.includes(pair);
}

/** 並び順を反映し、隠しているペアを除いた、カードとして出すペア */
export function visiblePairs<T extends { pair: string }>(pairs: T[], layout: PairLayout): T[] {
  return orderedPairs(pairs, layout).filter((p) => !isHidden(layout, p.pair));
}

/** 操作を適用した新しい設定を返す。pairs は現在サーバーから届いている全ペア（並び替えの基準にする） */
export function applyLayoutAction(
  layout: PairLayout,
  pairs: { pair: string }[],
  action: LayoutAction,
): PairLayout {
  switch (action.type) {
    case 'toggleHidden':
      return {
        ...layout,
        hidden: isHidden(layout, action.pair)
          ? layout.hidden.filter((id) => id !== action.pair)
          : [...layout.hidden, action.pair],
      };
    case 'showAll':
      return layout.hidden.length === 0 ? layout : { ...layout, hidden: [] };
    case 'moveBy': {
      const ids = orderedPairs(pairs, layout).map((p) => p.pair);
      const from = ids.indexOf(action.pair);
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
      const from = ids.indexOf(action.pair);
      const to = ids.indexOf(action.target);
      if (from === -1 || to === -1 || from === to) {
        return layout;
      }
      // 動かすものを抜いてから目標の位置に差し込む。上へ動かせば目標の前、下へ動かせば目標の後ろに入る
      const next = ids.filter((id) => id !== action.pair);
      next.splice(to, 0, action.pair);
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
  return { order: strings(r.order), hidden: strings(r.hidden) };
}
