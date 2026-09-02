import { formatDecimal } from '../format/number';
import type { Direction, ExchangeInfo, PairSnapshot } from '../protocol/types';

/** 利益が出ている方向（ペアごとに高々1つ）。タブ通知やバッジ表示に使う */
export function profitableDirection(pair: PairSnapshot): Direction | null {
  return pair.directions.find((d) => d.profitable) ?? null;
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
