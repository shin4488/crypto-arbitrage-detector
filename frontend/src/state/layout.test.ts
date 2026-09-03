import { describe, expect, it } from 'vitest';
import {
  applyLayoutAction,
  emptyLayout,
  isHidden,
  orderedPairs,
  parseLayout,
  visiblePairs,
} from './layout';

const pairs = [{ pair: 'BTC' }, { pair: 'ETH' }, { pair: 'XRP' }, { pair: 'DOGE' }];
const ids = (list: { pair: string }[]) => list.map((p) => p.pair);

describe('orderedPairs / visiblePairs', () => {
  it('設定が無ければサーバーの順のまま', () => {
    expect(ids(orderedPairs(pairs, emptyLayout))).toEqual(['BTC', 'ETH', 'XRP', 'DOGE']);
  });

  it('保存した並び順を先に、知らないペアはサーバーの順で末尾に置く', () => {
    const layout = { ...emptyLayout, order: ['XRP', 'BTC', 'SOL'] };
    expect(ids(orderedPairs(pairs, layout))).toEqual(['XRP', 'BTC', 'ETH', 'DOGE']);
  });

  it('visiblePairs は並び順を反映し、隠したペアを除く', () => {
    const layout = { order: ['XRP', 'BTC'], hidden: ['ETH', 'SOL'] };
    expect(ids(orderedPairs(pairs, layout))).toEqual(['XRP', 'BTC', 'ETH', 'DOGE']);
    expect(ids(visiblePairs(pairs, layout))).toEqual(['XRP', 'BTC', 'DOGE']);
  });
});

describe('applyLayoutAction', () => {
  it('moveBy は隣と入れ替え、端では動かない', () => {
    const down = applyLayoutAction(emptyLayout, pairs, { type: 'moveBy', pair: 'BTC', delta: 1 });
    expect(ids(orderedPairs(pairs, down))).toEqual(['ETH', 'BTC', 'XRP', 'DOGE']);
    expect(applyLayoutAction(emptyLayout, pairs, { type: 'moveBy', pair: 'BTC', delta: -1 })).toBe(
      emptyLayout,
    );
    expect(applyLayoutAction(emptyLayout, pairs, { type: 'moveBy', pair: 'DOGE', delta: 1 })).toBe(
      emptyLayout,
    );
  });

  it('moveTo は下へ動かせば目標の後ろ、上へ動かせば目標の前に入る', () => {
    const down = applyLayoutAction(emptyLayout, pairs, {
      type: 'moveTo',
      pair: 'BTC',
      target: 'XRP',
    });
    expect(ids(orderedPairs(pairs, down))).toEqual(['ETH', 'XRP', 'BTC', 'DOGE']);
    const up = applyLayoutAction(emptyLayout, pairs, {
      type: 'moveTo',
      pair: 'DOGE',
      target: 'ETH',
    });
    expect(ids(orderedPairs(pairs, up))).toEqual(['BTC', 'DOGE', 'ETH', 'XRP']);
  });

  it('moveTo は同じ位置や知らないペアでは何もしない', () => {
    const same = { type: 'moveTo', pair: 'BTC', target: 'BTC' } as const;
    expect(applyLayoutAction(emptyLayout, pairs, same)).toBe(emptyLayout);
    const unknownPair = { type: 'moveTo', pair: 'SOL', target: 'BTC' } as const;
    expect(applyLayoutAction(emptyLayout, pairs, unknownPair)).toBe(emptyLayout);
    const unknownTarget = { type: 'moveTo', pair: 'BTC', target: 'SOL' } as const;
    expect(applyLayoutAction(emptyLayout, pairs, unknownTarget)).toBe(emptyLayout);
  });

  it('toggleHidden で隠したり戻したりできる', () => {
    const a = applyLayoutAction(emptyLayout, pairs, { type: 'toggleHidden', pair: 'ETH' });
    expect(isHidden(a, 'ETH')).toBe(true);
    expect(ids(visiblePairs(pairs, a))).toEqual(['BTC', 'XRP', 'DOGE']);
    const b = applyLayoutAction(a, pairs, { type: 'toggleHidden', pair: 'ETH' });
    expect(isHidden(b, 'ETH')).toBe(false);
  });

  it('showAll は隠したペアをすべて戻し、何も隠していなければ何もしない', () => {
    const hidden = { order: [], hidden: ['ETH', 'DOGE'] };
    expect(applyLayoutAction(hidden, pairs, { type: 'showAll' })).toEqual(emptyLayout);
    expect(applyLayoutAction(emptyLayout, pairs, { type: 'showAll' })).toBe(emptyLayout);
  });
});

describe('parseLayout', () => {
  it('保存した値を読み、壊れていれば既定値', () => {
    expect(parseLayout({ order: ['A'], hidden: ['C'] })).toEqual({ order: ['A'], hidden: ['C'] });
    expect(parseLayout({ order: ['A', 1], hidden: 'x' })).toEqual({ order: ['A'], hidden: [] });
    expect(parseLayout(null)).toEqual(emptyLayout);
    expect(parseLayout('bad')).toEqual(emptyLayout);
  });
});
