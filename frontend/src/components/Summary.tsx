import { formatDecimal } from '../format/number';
import { useT } from '../i18n';
import type { ExchangeInfo, PairSnapshot } from '../protocol/types';
import { exchangeName, profitableDirection } from '../state/selectors';

interface SummaryProps {
  pairs: PairSnapshot[];
  exchanges: ExchangeInfo[];
}

/** 「今、利益の出る機会があるか」を画面の最初に示す。機会があればペア・方向・利益を1行ずつ */
export function Summary({ pairs, exchanges }: SummaryProps) {
  const t = useT();
  const opportunities = pairs.flatMap((pair) => {
    const d = profitableDirection(pair);
    return d ? [{ pair, direction: d }] : [];
  });

  if (opportunities.length === 0) {
    return (
      <section className="summary" aria-live="polite">
        <p>{t.summaryNone}</p>
      </section>
    );
  }
  return (
    <section className="summary summary--profitable" aria-live="polite">
      {opportunities.map(({ pair, direction: d }) => (
        <p key={pair.pair}>
          <strong>{pair.pair}</strong>{' '}
          {t.direction(
            exchangeName(exchanges, d.buyExchange),
            exchangeName(exchanges, d.sellExchange),
          )}{' '}
          <strong>
            {formatDecimal(d.netProfit, { maxFractionDigits: 4, signed: true })} {pair.quote}
          </strong>
        </p>
      ))}
    </section>
  );
}
