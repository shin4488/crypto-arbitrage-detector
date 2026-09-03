/**
 * 10進文字列の表示整形。
 * 値は文字列のまま扱い、浮動小数点に変換しない（価格×数量のような値で末尾桁がずれるのを防ぐ）。
 */

export interface FormatOptions {
  /** 小数部の最大桁数。超える分は四捨五入する */
  maxFractionDigits?: number;
  /** 小数部の最小桁数。足りなければ 0 で埋める */
  minFractionDigits?: number;
  /** 正の値に + を付ける */
  signed?: boolean;
}

/** 桁区切り付きで整形する。例: "65433.79" → "65,433.79" */
export function formatDecimal(value: string, options: FormatOptions = {}): string {
  const parsed = parseDecimal(value);
  if (parsed === null) {
    return value;
  }
  const max = options.maxFractionDigits ?? Number.POSITIVE_INFINITY;
  const min = options.minFractionDigits ?? 0;
  let { intPart, fracPart } = parsed;
  let negative = parsed.negative;

  if (fracPart.length > max) {
    ({ intPart, fracPart } = roundHalfUp(intPart, fracPart, max));
  }
  fracPart = fracPart.replace(/0+$/, '');
  if (fracPart.length < min) {
    fracPart = fracPart.padEnd(min, '0');
  }
  // 四捨五入や切り捨ての結果が 0 なら符号は付けない
  if (/^0*$/.test(intPart) && fracPart === '') {
    negative = false;
  }
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = fracPart ? `${grouped}.${fracPart}` : grouped;
  if (negative) {
    return `-${body}`;
  }
  return options.signed && !/^[0,.]*$/.test(body) ? `+${body}` : body;
}

/** 比率（0.01 = 1%）をパーセント表記にする。例: "0.0000465" → "0.0047%" */
export function formatPercent(ratio: string, maxFractionDigits = 4): string {
  const shifted = shiftDecimalPoint(ratio, 2);
  if (shifted === null) {
    return ratio;
  }
  return `${formatDecimal(shifted, { maxFractionDigits, signed: true })}%`;
}

/** 10進文字列の小数点を右へ places 桁ずらす（×10^places）。 */
export function shiftDecimalPoint(value: string, places: number): string | null {
  const parsed = parseDecimal(value);
  if (parsed === null) {
    return null;
  }
  const digits = parsed.intPart + parsed.fracPart;
  const pointAt = parsed.intPart.length + places;
  let intPart: string;
  let fracPart: string;
  if (pointAt <= 0) {
    intPart = '0';
    fracPart = '0'.repeat(-pointAt) + digits;
  } else if (pointAt >= digits.length) {
    intPart = digits + '0'.repeat(pointAt - digits.length);
    fracPart = '';
  } else {
    intPart = digits.slice(0, pointAt);
    fracPart = digits.slice(pointAt);
  }
  intPart = intPart.replace(/^0+(?=\d)/, '');
  fracPart = fracPart.replace(/0+$/, '');
  const body = fracPart ? `${intPart}.${fracPart}` : intPart;
  return parsed.negative && body !== '0' ? `-${body}` : body;
}

/** 文字列の数値が正・負・ゼロのどれかを返す（表示色の判定用） */
export function signOf(value: string): -1 | 0 | 1 {
  const parsed = parseDecimal(value);
  if (parsed === null) {
    return 0;
  }
  const isZero = /^0*$/.test(parsed.intPart + parsed.fracPart);
  if (isZero) {
    return 0;
  }
  return parsed.negative ? -1 : 1;
}

interface ParsedDecimal {
  negative: boolean;
  intPart: string;
  fracPart: string;
}

function parseDecimal(value: string): ParsedDecimal | null {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(value.trim());
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) {
    return null;
  }
  return {
    negative: m[1] === '-',
    intPart: (m[2] ?? '').replace(/^0+(?=\d)/, '') || '0',
    fracPart: m[3] ?? '',
  };
}

/** 小数部を digits 桁に四捨五入する（BigInt で桁あふれを避ける） */
function roundHalfUp(
  intPart: string,
  fracPart: string,
  digits: number,
): { intPart: string; fracPart: string } {
  const kept = fracPart.slice(0, digits);
  const next = fracPart.charAt(digits);
  let n = BigInt(intPart + kept);
  if (next >= '5') {
    n += 1n;
  }
  const s = n.toString().padStart(digits + 1, '0');
  return { intPart: s.slice(0, s.length - digits), fracPart: s.slice(s.length - digits) };
}

/** 10進文字列の小数部の桁数（"65433.79" → 2, "77256" → 0）。価格の刻みに表示桁を合わせるために使う */
export function fractionDigitsOf(value: string): number {
  const parsed = parseDecimal(value);
  return parsed === null ? 0 : parsed.fracPart.replace(/0+$/, '').length;
}

/** 10進文字列どうしの引き算 a − b。浮動小数点を経由せず、桁をそろえて BigInt で計算する */
export function subtractDecimals(a: string, b: string): string {
  const pa = parseDecimal(a);
  const pb = parseDecimal(b);
  if (pa === null || pb === null) {
    return 'NaN';
  }
  const scale = Math.max(pa.fracPart.length, pb.fracPart.length);
  const toScaled = (p: ParsedDecimal) => {
    const n = BigInt(p.intPart + p.fracPart.padEnd(scale, '0'));
    return p.negative ? -n : n;
  };
  const diff = toScaled(pa) - toScaled(pb);
  const negative = diff < 0n;
  const digits = (negative ? -diff : diff).toString().padStart(scale + 1, '0');
  const intPart = digits.slice(0, digits.length - scale);
  const fracPart = digits.slice(digits.length - scale).replace(/0+$/, '');
  const body = fracPart ? `${intPart}.${fracPart}` : intPart;
  return negative ? `-${body}` : body;
}

/** 10進文字列どうしの掛け算 a × b。誤差なく計算し、末尾の 0 は落とす */
export function multiplyDecimals(a: string, b: string): string {
  const pa = parseDecimal(a);
  const pb = parseDecimal(b);
  if (pa === null || pb === null) {
    return 'NaN';
  }
  const product = BigInt(pa.intPart + pa.fracPart) * BigInt(pb.intPart + pb.fracPart);
  return fromScaled(product, pa.fracPart.length + pb.fracPart.length, pa.negative !== pb.negative);
}

/** 10進文字列どうしの割り算 a ÷ b。小数 scale 桁で切り捨てる。b が 0 なら NaN */
export function divideDecimals(a: string, b: string, scale = 8): string {
  const pa = parseDecimal(a);
  const pb = parseDecimal(b);
  if (pa === null || pb === null) {
    return 'NaN';
  }
  const divisor = BigInt(pb.intPart + pb.fracPart);
  if (divisor === 0n) {
    return 'NaN';
  }
  // (A / 10^fa) ÷ (B / 10^fb) を小数 scale 桁の整数で表す
  const numerator = BigInt(pa.intPart + pa.fracPart) * 10n ** BigInt(pb.fracPart.length + scale);
  const quotient = numerator / (divisor * 10n ** BigInt(pa.fracPart.length));
  return fromScaled(quotient, scale, pa.negative !== pb.negative);
}

/** 10^scale 倍された整数を10進文字列に戻す */
function fromScaled(value: bigint, scale: number, negative: boolean): string {
  const digits = (value < 0n ? -value : value).toString().padStart(scale + 1, '0');
  const intPart = digits.slice(0, digits.length - scale).replace(/^0+(?=\d)/, '');
  const fracPart = digits.slice(digits.length - scale).replace(/0+$/, '');
  const body = fracPart ? `${intPart}.${fracPart}` : intPart;
  return negative && body !== '0' && value !== 0n ? `-${body}` : body;
}

/**
 * 数量（Base 通貨）の表示桁数。1未満なら8桁、1000未満なら4桁、それ以上は2桁。
 * SHIB のように1単位が非常に安い銘柄では数量が数百万になり、小数8桁まで出すと読めなくなるため。
 */
export function quantityFractionDigits(quantity: string): number {
  const n = Math.abs(Number(quantity));
  if (!Number.isFinite(n) || n < 1) {
    return 8;
  }
  return n < 1000 ? 4 : 2;
}
