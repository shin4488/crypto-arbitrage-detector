import { describe, expect, it } from 'vitest';
import { exchangeFixture, pairFixture, profitableDirectionFixture } from '../test/fixtures';
import { exchangeName, profitableDirection, titleSummary } from './selectors';

describe('selectors', () => {
  it('profitableDirection は利益の出る方向を返す', () => {
    expect(profitableDirection(pairFixture())).toBeNull();
    const pair = pairFixture({ directions: [profitableDirectionFixture()] });
    expect(profitableDirection(pair)?.buyExchange).toBe('okx');
  });

  it('titleSummary は機会のあるペアだけを短く要約する', () => {
    expect(titleSummary([pairFixture()])).toBeNull();
    const pairs = [
      pairFixture({ directions: [profitableDirectionFixture({ netProfit: '1.234' })] }),
      pairFixture({ pair: 'ETH/USDT', base: 'ETH' }),
      pairFixture({
        pair: 'SOL/USDT',
        base: 'SOL',
        directions: [profitableDirectionFixture({ netProfit: '0.45' })],
      }),
    ];
    expect(titleSummary(pairs)).toBe('BTC +1.23 / SOL +0.45');
  });

  it('exchangeName は表示名を返し、未知ならIDのまま', () => {
    const exchanges = [exchangeFixture(), exchangeFixture({ id: 'okx', name: 'OKX' })];
    expect(exchangeName(exchanges, 'okx')).toBe('OKX');
    expect(exchangeName(exchanges, 'bybit')).toBe('bybit');
  });
});
