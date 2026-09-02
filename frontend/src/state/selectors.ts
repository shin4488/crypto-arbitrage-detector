import { formatDecimal, subtractDecimals } from '../format/number';
import type { Direction, ExchangeInfo, PairSnapshot } from '../protocol/types';

/** 利益が出ている方向（ペアごとに多くても1つ）。タブ通知やバッジの表示に使う */
export function profitableDirection(pair: PairSnapshot): Direction | null {
  return pair.directions.find((d) => d.profitable) ?? null;
}

/**
 * 画面で主役にする方向。利益が出ていればその方向、出ていなければ手数料込みの損益がいちばん大きい
 * （利益にいちばん近い）方向。評価できる方向が無ければ null
 */
export function bestDirection(pair: PairSnapshot): Direction | null {
  return pair.directions.reduce<Direction | null>((best, d) => {
    if (best === null || d.profitable || Number(d.netSpread) > Number(best.netSpread)) {
      return best?.profitable ? best : d;
    }
    return best;
  }, null);
}

/** 1単位あたりの手数料の合計。サーバーは価格差と手数料込み損益を送ってくるので、その差から求める */
export function feePerUnit(d: Direction): string {
  return subtractDecimals(d.grossSpread, d.netSpread);
}

/** タブのタイトル用の短い要約。例: "BTC +1.23 / ETH +0.45"。機会が無ければ null */
export function titleSummary(pairs: PairSnapshot[]): string | null {
  const parts = pairs.flatMap((p) => {
    const d = profitableDirection(p);
    return d
      ? [`${p.base} ${formatDecimal(d.netProfit, { maxFractionDigits: 2, signed: true })}`]
      : [];
  });
  return parts.length > 0 ? parts.join(' / ') : null;
}

/** 取引所IDから表示名を引く。未知のIDならIDをそのまま返す */
export function exchangeName(exchanges: ExchangeInfo[], id: string): string {
  return exchanges.find((e) => e.id === id)?.name ?? id;
}
