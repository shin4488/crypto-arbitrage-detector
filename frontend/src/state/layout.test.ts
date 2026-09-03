import { describe, expect, it } from 'vitest';
import { applyLayoutAction, emptyLayout, isCollapsed, orderedPairs, parseLayout } from './layout';

const pairs = [{ pair: 'BTC' }, { pair: 'ETH' }, { pair: 'XRP' }, { pair: 'DOGE' }];
const ids = (list: { pair: string }[]) => list.map((p) => p.pair);

describe('orderedPairs', () => {
  it('設定が無ければサーバーの順のまま', () => {
    expect(ids(orderedPairs(pairs, emptyLayout))).toEqual(['BTC', 'ETH', 'XRP', 'DOGE']);
  });

  it('保存した並び順を先に、知らないペアはサーバーの順で末尾に置く', () => {
    const layout = { ...emptyLayout, order: ['XRP', 'BTC', 'SOL'] };
    expect(ids(orderedPairs(pairs, layout))).toEqual(['XRP', 'BTC', 'ETH', 'DOGE']);
  });
});

describe('applyLayoutAction', () => {
  it('moveBy は隣と入れ替え、端では動かない', () => {
    const down = applyLayoutAction(emptyLayout, pairs, 'BTC', { type: 'moveBy', delta: 1 });
    expect(ids(orderedPairs(pairs, down))).toEqual(['ETH', 'BTC', 'XRP', 'DOGE']);
    expect(applyLayoutAction(emptyLayout, pairs, 'BTC', { type: 'moveBy', delta: -1 })).toBe(
      emptyLayout,
    );
    expect(applyLayoutAction(emptyLayout, pairs, 'DOGE', { type: 'moveBy', delta: 1 })).toBe(
      emptyLayout,
    );
  });

  it('moveTo は下へ動かせば目標の後ろ、上へ動かせば目標の前に入る', () => {
    const down = applyLayoutAction(emptyLayout, pairs, 'BTC', { type: 'moveTo', target: 'XRP' });
    expect(ids(orderedPairs(pairs, down))).toEqual(['ETH', 'XRP', 'BTC', 'DOGE']);
    const up = applyLayoutAction(emptyLayout, pairs, 'DOGE', { type: 'moveTo', target: 'ETH' });
    expect(ids(orderedPairs(pairs, up))).toEqual(['BTC', 'DOGE', 'ETH', 'XRP']);
  });

  it('moveTo は同じ位置や知らないペアでは何もしない', () => {
    expect(applyLayoutAction(emptyLayout, pairs, 'BTC', { type: 'moveTo', target: 'BTC' })).toBe(
      emptyLayout,
    );
    expect(applyLayoutAction(emptyLayout, pairs, 'SOL', { type: 'moveTo', target: 'BTC' })).toBe(
      emptyLayout,
    );
    expect(applyLayoutAction(emptyLayout, pairs, 'BTC', { type: 'moveTo', target: 'SOL' })).toBe(
      emptyLayout,
    );
  });

  it('折りたたみの切り替え', () => {
    const a = applyLayoutAction(emptyLayout, pairs, 'ETH', { type: 'toggleCollapsed' });
    expect(isCollapsed(a, 'ETH')).toBe(true);
    const b = applyLayoutAction(a, pairs, 'ETH', { type: 'toggleCollapsed' });
    expect(isCollapsed(b, 'ETH')).toBe(false);
  });
});

describe('parseLayout', () => {
  it('保存した値を読み、壊れていれば既定値', () => {
    expect(parseLayout({ order: ['A'], collapsed: ['C'] })).toEqual({
      order: ['A'],
      collapsed: ['C'],
    });
    expect(parseLayout({ order: ['A', 1], collapsed: 'x' })).toEqual({
      order: ['A'],
      collapsed: [],
    });
    expect(parseLayout(null)).toEqual(emptyLayout);
    expect(parseLayout('bad')).toEqual(emptyLayout);
  });
});
