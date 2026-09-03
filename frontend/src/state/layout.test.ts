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
  it('上下に動かすと隣と入れ替わる', () => {
    const down = applyLayoutAction(emptyLayout, pairs, 'BTC', 'moveDown');
    expect(ids(orderedPairs(pairs, down))).toEqual(['ETH', 'BTC', 'XRP', 'DOGE']);
    const up = applyLayoutAction(down, pairs, 'DOGE', 'moveUp');
    expect(ids(orderedPairs(pairs, up))).toEqual(['ETH', 'BTC', 'DOGE', 'XRP']);
  });

  it('端では動かず、知らないペアも無視する', () => {
    expect(applyLayoutAction(emptyLayout, pairs, 'BTC', 'moveUp')).toBe(emptyLayout);
    expect(applyLayoutAction(emptyLayout, pairs, 'DOGE', 'moveDown')).toBe(emptyLayout);
    expect(applyLayoutAction(emptyLayout, pairs, 'SOL', 'moveDown')).toBe(emptyLayout);
  });

  it('折りたたみの切り替え', () => {
    const a = applyLayoutAction(emptyLayout, pairs, 'ETH', 'toggleCollapsed');
    expect(isCollapsed(a, 'ETH')).toBe(true);
    const b = applyLayoutAction(a, pairs, 'ETH', 'toggleCollapsed');
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
