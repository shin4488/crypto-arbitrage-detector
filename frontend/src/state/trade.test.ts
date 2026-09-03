import { describe, expect, it } from 'vitest';
import { directionFixture, episodeFixture, profitableDirectionFixture } from '../test/fixtures';
import { episodeForAmount, normalizeAmount, planForAmount } from './trade';

describe('normalizeAmount', () => {
  it('正の数ならそのまま、そうでなければ既定の 100', () => {
    expect(normalizeAmount('250')).toBe('250');
    expect(normalizeAmount(' 30.5 ')).toBe('30.5');
    expect(normalizeAmount('0')).toBe('100');
    expect(normalizeAmount('-5')).toBe('100');
    expect(normalizeAmount('')).toBe('100');
    expect(normalizeAmount('abc')).toBe('100');
  });
});

describe('planForAmount', () => {
  it('利益が出ない方向は、金額を買値で割った数量に1単位あたりの値を掛ける', () => {
    // 買値 65433.8、価格差 +3.04、差引 −127.83
    const plan = planForAmount(directionFixture(), '100');
    expect(plan.quantity).toBe('0.00152826');
    expect(plan.gross).toBe('0.0046459104');
    expect(plan.fees).toBe('0.2000033862');
    expect(plan.net).toBe('-0.1953574758');
    expect(plan.capped).toBe(false);
  });

  it('利益が出る方向で、板で利益が出る量に収まるなら数量倍で計算する', () => {
    // 買値 100、板で利益が出る量 0.3 BTC、差引 0.799 / BTC
    const plan = planForAmount(profitableDirectionFixture(), '20');
    expect(plan.quantity).toBe('0.2');
    expect(plan.net).toBe('0.1598');
    expect(plan.capped).toBe(false);
  });

  it('利益が出る方向で、板で利益が出る量を超えるならその上限とサーバーの計算値を使う', () => {
    const plan = planForAmount(profitableDirectionFixture(), '100');
    expect(plan.quantity).toBe('0.3');
    expect(plan.net).toBe('0.2397');
    expect(plan.gross).toBe('0.3');
    expect(plan.fees).toBe('0.0603');
    expect(plan.capped).toBe(true);
  });

  it('金額が不正なら既定の 100 で計算する', () => {
    expect(planForAmount(directionFixture(), '').quantity).toBe('0.00152826');
  });
});

describe('episodeForAmount', () => {
  it('最大純利益の時点の価格で、指定額ぶんの数量と純利益を出す', () => {
    // 最大純利益 0.2397 / 数量 0.3 → 1単位 0.799。平均買値 100 なら 20 USDT で 0.2 BTC
    const r = episodeForAmount(episodeFixture(), '20');
    expect(r.quantity).toBe('0.2');
    expect(r.net).toBe('0.1598');
  });

  it('当時の数量を超える金額なら、その数量で頭打ち', () => {
    const r = episodeForAmount(episodeFixture(), '100');
    expect(r.quantity).toBe('0.3');
    expect(r.net).toBe('0.2397');
  });
});
