import { describe, expect, it } from 'vitest';
import { episodeFixture, initFixture, pairFixture } from '../test/fixtures';
import { HISTORY_LIMIT, initialState, reducer } from './reducer';

const init = initFixture();

describe('reducer', () => {
  it('接続状態を更新する（同じ状態なら同一オブジェクトを返す）', () => {
    const s1 = reducer(initialState, { type: 'connection', status: 'connected' });
    expect(s1.connection).toBe('connected');
    expect(reducer(s1, { type: 'connection', status: 'connected' })).toBe(s1);
  });

  it('init で全状態を置き換える', () => {
    const s = reducer(initialState, { type: 'messages', messages: [init] });
    expect(s.initialized).toBe(true);
    expect(s.seq).toBe(init.seq);
    expect(s.exchanges.map((e) => e.id)).toEqual(['binance', 'okx']);
    expect(s.pairs.map((p) => p.pair)).toEqual(['BTC/USDT', 'ETH/USDT']);
    expect(s.history).toHaveLength(1);
  });

  it('pair メッセージは該当ペアだけ差し替え、他のペアのオブジェクトは保つ', () => {
    const s0 = reducer(initialState, { type: 'messages', messages: [init] });
    const updated = pairFixture({ pair: 'BTC/USDT', updatedAt: '2026-09-02T12:00:01.000Z' });
    const s1 = reducer(s0, {
      type: 'messages',
      messages: [{ type: 'pair', seq: init.seq + 1, pair: updated }],
    });
    expect(s1.pairs[0]).toBe(updated);
    expect(s1.pairs[1]).toBe(s0.pairs[1]);
    expect(s1.seq).toBe(init.seq + 1);
  });

  it('未知のペアは末尾に追加する', () => {
    const s0 = reducer(initialState, { type: 'messages', messages: [init] });
    const s1 = reducer(s0, {
      type: 'messages',
      messages: [
        { type: 'pair', seq: init.seq + 1, pair: pairFixture({ pair: 'SOL/USDT', base: 'SOL' }) },
      ],
    });
    expect(s1.pairs.map((p) => p.pair)).toEqual(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']);
  });

  it('seq が古いメッセージは無視する', () => {
    const s0 = reducer(initialState, { type: 'messages', messages: [init] });
    const s1 = reducer(s0, {
      type: 'messages',
      messages: [{ type: 'pair', seq: init.seq, pair: pairFixture({ pair: 'BTC/USDT' }) }],
    });
    expect(s1).toBe(s0);
  });

  it('episode は id で upsert し、新しい順に並べる', () => {
    const s0 = reducer(initialState, { type: 'messages', messages: [init] });
    const newer = episodeFixture({ id: 2, startedAt: '2026-09-02T12:00:05.000Z' });
    const s1 = reducer(s0, {
      type: 'messages',
      messages: [{ type: 'episode', seq: init.seq + 1, episode: newer }],
    });
    expect(s1.history.map((e) => e.id)).toEqual([2, 1]);

    const ended = { ...newer, endedAt: '2026-09-02T12:00:09.000Z' };
    const s2 = reducer(s1, {
      type: 'messages',
      messages: [{ type: 'episode', seq: init.seq + 2, episode: ended }],
    });
    expect(s2.history).toHaveLength(2);
    expect(s2.history[0]?.endedAt).toBe('2026-09-02T12:00:09.000Z');
  });

  it('履歴は上限件数で打ち切る', () => {
    let s = reducer(initialState, { type: 'messages', messages: [init] });
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      s = reducer(s, {
        type: 'messages',
        messages: [
          {
            type: 'episode',
            seq: init.seq + 1 + i,
            episode: episodeFixture({
              id: 100 + i,
              startedAt: `2026-09-02T13:00:${String(i % 60).padStart(2, '0')}.${String(i).padStart(3, '0')}Z`,
            }),
          },
        ],
      });
    }
    expect(s.history).toHaveLength(HISTORY_LIMIT);
  });

  it('exchange メッセージで接続状態を更新する', () => {
    const s0 = reducer(initialState, { type: 'messages', messages: [init] });
    const s1 = reducer(s0, {
      type: 'messages',
      messages: [
        {
          type: 'exchange',
          seq: init.seq + 1,
          exchange: { id: 'okx', connected: false, since: '2026-09-02T12:00:10.000Z' },
        },
      ],
    });
    expect(s1.exchanges[1]?.connected).toBe(false);
    expect(s1.exchanges[1]?.since).toBe('2026-09-02T12:00:10.000Z');
    expect(s1.exchanges[0]).toBe(s0.exchanges[0]);
  });

  it('複数メッセージを順に適用する', () => {
    const s = reducer(initialState, {
      type: 'messages',
      messages: [
        init,
        { type: 'pair', seq: init.seq + 1, pair: pairFixture({ pair: 'BTC/USDT' }) },
        { type: 'pair', seq: init.seq + 2, pair: pairFixture({ pair: 'ETH/USDT', base: 'ETH' }) },
      ],
    });
    expect(s.seq).toBe(init.seq + 2);
  });
});
