import { describe, expect, it } from 'vitest';
import {
  directionFixture,
  exchangeFixture,
  pairFixture,
  profitableDirectionFixture,
} from '../test/fixtures';
import { bestDirection, exchangeName, profitableDirection, titleSummary } from './selectors';
import { feePerUnit } from './trade';

describe('selectors', () => {
  it('profitableDirection は利益の出る方向を返す', () => {
    expect(profitableDirection(pairFixture())).toBeNull();
    const pair = pairFixture({ directions: [profitableDirectionFixture()] });
    expect(profitableDirection(pair)?.buyExchange).toBe('okx');
  });

  it('bestDirection は利益が無ければ手数料込みの損益がいちばん大きい方向を返す', () => {
    // fixture: binance→okx は -127.83、okx→binance は -133.93
    expect(bestDirection(pairFixture())?.buyExchange).toBe('binance');
    expect(bestDirection(pairFixture({ directions: [] }))).toBeNull();
  });

  it('bestDirection は利益の出る方向を最優先する', () => {
    const pair = pairFixture({
      directions: [
        directionFixture({ netSpread: '5' }),
        profitableDirectionFixture({ netSpread: '0.1' }),
      ],
    });
    expect(bestDirection(pair)?.profitable).toBe(true);
  });

  it('feePerUnit は価格差と手数料込み損益の差', () => {
    expect(feePerUnit(directionFixture({ grossSpread: '3.04', netSpread: '-127.83' }))).toBe(
      '130.87',
    );
    expect(feePerUnit(profitableDirectionFixture())).toBe('0.201');
  });

  it('titleSummary は機会のあるペアだけを、取引金額ぶんの利益で短く要約する', () => {
    expect(titleSummary([pairFixture()], '100')).toBeNull();
    const pairs = [
      pairFixture({ directions: [profitableDirectionFixture({ netProfit: '1.234' })] }),
      pairFixture({ pair: 'ETH/USDT', base: 'ETH' }),
      pairFixture({
        pair: 'SOL/USDT',
        base: 'SOL',
        directions: [profitableDirectionFixture({ netProfit: '0.45' })],
      }),
    ];
    // 100 USDT は板で利益が出る量（0.3 BTC ≈ 30 USDT）を超えるので、サーバーの純利益がそのまま出る
    expect(titleSummary(pairs, '100')).toBe('BTC +1.23 / SOL +0.45');
    // 20 USDT なら 0.2 BTC ぶん: 0.799 × 0.2 = 0.1598
    expect(titleSummary(pairs, '20')).toBe('BTC +0.16 / SOL +0.16');
  });

  it('exchangeName は表示名を返し、未知ならIDのまま', () => {
    const exchanges = [exchangeFixture(), exchangeFixture({ id: 'okx', name: 'OKX' })];
    expect(exchangeName(exchanges, 'okx')).toBe('OKX');
    expect(exchangeName(exchanges, 'bybit')).toBe('bybit');
  });
});
