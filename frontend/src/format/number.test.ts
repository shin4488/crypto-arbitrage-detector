import { describe, expect, it } from 'vitest';
import {
  divideDecimals,
  formatDecimal,
  formatPercent,
  fractionDigitsOf,
  multiplyDecimals,
  shiftDecimalPoint,
  signOf,
  subtractDecimals,
} from './number';

describe('formatDecimal', () => {
  it.each([
    ['65433.79', '65,433.79'],
    ['1234567', '1,234,567'],
    ['0.52', '0.52'],
    ['-3.06', '-3.06'],
    ['100', '100'],
    ['0', '0'],
    ['1.500', '1.5'],
    ['007.10', '7.1'],
  ])('桁区切りを付けて整形する: %s → %s', (input, want) => {
    expect(formatDecimal(input)).toBe(want);
  });

  it('最大桁数を超える小数は四捨五入する', () => {
    expect(formatDecimal('0.2995', { maxFractionDigits: 2 })).toBe('0.3');
    expect(formatDecimal('0.2944', { maxFractionDigits: 2 })).toBe('0.29');
    expect(formatDecimal('9.999', { maxFractionDigits: 2 })).toBe('10');
    expect(formatDecimal('-0.004', { maxFractionDigits: 2 })).toBe('0');
    expect(formatDecimal('123456789012345678.5', { maxFractionDigits: 0 })).toBe(
      '123,456,789,012,345,679',
    );
  });

  it('最小桁数まで 0 で埋める', () => {
    expect(formatDecimal('3', { minFractionDigits: 2 })).toBe('3.00');
    expect(formatDecimal('3.1', { minFractionDigits: 2 })).toBe('3.10');
  });

  it('signed なら正の値に + を付け、0 には付けない', () => {
    expect(formatDecimal('3.04', { signed: true })).toBe('+3.04');
    expect(formatDecimal('-3.06', { signed: true })).toBe('-3.06');
    expect(formatDecimal('0', { signed: true })).toBe('0');
    expect(formatDecimal('0.001', { signed: true, maxFractionDigits: 2 })).toBe('0');
  });

  it('数値でない文字列はそのまま返す', () => {
    expect(formatDecimal('abc')).toBe('abc');
    expect(formatDecimal('')).toBe('');
  });
});

describe('shiftDecimalPoint', () => {
  it.each([
    ['0.0000464592', 2, '0.00464592'],
    ['0.01', 2, '1'],
    ['1.5', 2, '150'],
    ['123', 2, '12300'],
    ['-0.0001', 2, '-0.01'],
    ['0', 2, '0'],
    ['0.5', -1, '0.05'],
  ])('%s を %d 桁ずらすと %s', (input, places, want) => {
    expect(shiftDecimalPoint(input, places)).toBe(want);
  });
});

describe('formatPercent', () => {
  it('比率をパーセントにする', () => {
    expect(formatPercent('0.0000464592')).toBe('+0.0046%');
    expect(formatPercent('-0.0000467')).toBe('-0.0047%');
    expect(formatPercent('0.01', 2)).toBe('+1%');
  });
});

describe('signOf', () => {
  it('符号を返す', () => {
    expect(signOf('3.04')).toBe(1);
    expect(signOf('-3.06')).toBe(-1);
    expect(signOf('0')).toBe(0);
    expect(signOf('0.000')).toBe(0);
    expect(signOf('-0')).toBe(0);
    expect(signOf('x')).toBe(0);
  });
});

describe('fractionDigitsOf', () => {
  it('小数部の桁数を返す', () => {
    expect(fractionDigitsOf('65433.79')).toBe(2);
    expect(fractionDigitsOf('77256')).toBe(0);
    expect(fractionDigitsOf('2407.10')).toBe(1);
    expect(fractionDigitsOf('abc')).toBe(0);
  });
});

describe('subtractDecimals', () => {
  it.each([
    ['3.04', '-127.83', '130.87'],
    ['1', '0.799', '0.201'],
    ['0.1', '0.3', '-0.2'],
    ['100', '100', '0'],
    ['-8', '-162.52', '154.52'],
    ['65436.84', '65433.8', '3.04'],
  ])('%s − %s = %s', (a, b, want) => {
    expect(subtractDecimals(a, b)).toBe(want);
  });

  it('数値でなければ NaN', () => {
    expect(subtractDecimals('x', '1')).toBe('NaN');
  });
});

describe('multiplyDecimals', () => {
  it.each([
    ['3.04', '0.00152826', '0.0046459104'],
    ['100', '0.001', '0.1'],
    ['-127.83', '0.00152826', '-0.1953574758'],
    ['0', '5', '0'],
    ['1.5', '2', '3'],
  ])('%s × %s = %s', (a, b, want) => {
    expect(multiplyDecimals(a, b)).toBe(want);
  });
});

describe('divideDecimals', () => {
  it.each([
    ['100', '65433.8', 8, '0.00152826'],
    ['100', '100', 8, '1'],
    ['1', '3', 4, '0.3333'],
    ['-10', '4', 8, '-2.5'],
    ['0.2397', '0.3', 8, '0.799'],
  ])('%s ÷ %s（%d桁）= %s', (a, b, scale, want) => {
    expect(divideDecimals(a, b, scale)).toBe(want);
  });

  it('ゼロ除算や数値でない文字列は NaN', () => {
    expect(divideDecimals('1', '0')).toBe('NaN');
    expect(divideDecimals('x', '1')).toBe('NaN');
  });
});
