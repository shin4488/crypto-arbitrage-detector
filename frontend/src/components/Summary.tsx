import { formatDecimal } from '../format/number';
import { useT } from '../i18n';
import type { ExchangeInfo, PairSnapshot } from '../protocol/types';
import { exchangeName, profitableDirection } from '../state/selectors';

interface SummaryProps {
  pairs: PairSnapshot[];
  exchanges: ExchangeInfo[];
}

/** 「今、利益の出る機会があるか」を画面の最初に1行で示す */
export function Summary({ pairs, exchanges }: SummaryProps) {
  const t = useT();
  const lines = pairs.flatMap((pair) => {
    const d = profitableDirection(pair);
    if (!d) {
      return [];
    }
    const profit = `${formatDecimal(d.netProfit, { maxFractionDigits: 4, signed: true })} ${pair.quote}`;
    return [
      {
        key: pair.pair,
        text: t.summaryProfitable(
          pair.pair,
          exchangeName(exchanges, d.buyExchange),
          exchangeName(exchanges, d.sellExchange),
          profit,
        ),
      },
    ];
  });

  return (
    <section
      className={`summary ${lines.length > 0 ? 'summary--profitable' : ''}`}
      aria-live="polite"
    >
      {lines.length === 0 ? (
        <p>{t.summaryNone}</p>
      ) : (
        lines.map((line) => <p key={line.key}>{line.text}</p>)
      )}
    </section>
  );
}
