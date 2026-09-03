import { divideDecimals, multiplyDecimals, signOf, subtractDecimals } from '../format/number';
import type { Direction, Episode } from '../protocol/types';

/** 取引金額の既定値（Quote 通貨建て）。1 BTC 単位は金額が大きすぎて実感が湧かないため、少額を基準にする */
export const DEFAULT_AMOUNT = '100';

/** 数量（Base 通貨）の小数桁数。取引所の最小刻みに合わせて8桁 */
const QUANTITY_SCALE = 8;

/** 指定した金額で売買したときの内訳 */
export interface TradePlan {
  /** 売買する数量（Base 通貨建て） */
  quantity: string;
  /** 価格差による利益（手数料前） */
  gross: string;
  /** 手数料の合計 */
  fees: string;
  /** 差引（手数料後の損益） */
  net: string;
  /** 板で利益が出る量が指定額に足りず、その上限で計算した */
  capped: boolean;
}

/** 1単位あたりの手数料の合計。サーバーは価格差と手数料込み損益を送ってくるので、その差から求める */
export function feePerUnit(d: Direction): string {
  return subtractDecimals(d.grossSpread, d.netSpread);
}

/** 入力された金額が使えるか（正の数か）。使えなければ既定値で計算する */
export function normalizeAmount(input: string): string {
  return signOf(input) === 1 ? input.trim() : DEFAULT_AMOUNT;
}

/**
 * 金額を買値で割って数量にし、1単位あたりの値を数量倍する。
 * 少額なら最良価格の数量で足りるので、最良価格で計算する（板の深い段は使わない）。
 * 利益が出る方向で、板で利益が出る数量を超える場合は、その数量とサーバーの計算値を使う。
 */
export function planForAmount(d: Direction, amount: string): TradePlan {
  const quantity = divideDecimals(normalizeAmount(amount), d.bestAsk.price, QUANTITY_SCALE);
  if (d.profitable && Number(quantity) > Number(d.quantity)) {
    return {
      quantity: d.quantity,
      gross: d.grossProfit,
      fees: multiplyDecimals(feePerUnit(d), d.quantity),
      net: d.netProfit,
      capped: true,
    };
  }
  return {
    quantity,
    gross: multiplyDecimals(d.grossSpread, quantity),
    fees: multiplyDecimals(feePerUnit(d), quantity),
    net: multiplyDecimals(d.netSpread, quantity),
    capped: false,
  };
}

/** 履歴1件について、指定した金額で売買していた場合の数量と純利益（最大純利益の時点の価格で計算） */
export function episodeForAmount(ep: Episode, amount: string): { quantity: string; net: string } {
  const perUnit = divideDecimals(ep.maxNetProfit, ep.quantityAtMax, QUANTITY_SCALE);
  const wanted = divideDecimals(normalizeAmount(amount), ep.avgBuyPriceAtMax, QUANTITY_SCALE);
  const quantity = Number(wanted) > Number(ep.quantityAtMax) ? ep.quantityAtMax : wanted;
  return { quantity, net: multiplyDecimals(perUnit, quantity) };
}
