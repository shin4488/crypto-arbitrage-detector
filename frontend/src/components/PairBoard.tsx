import { memo, type ReactNode } from 'react';
import { formatDecimal, fractionDigitsOf } from '../format/number';
import { useT } from '../i18n';
import type { Direction, ExchangeInfo, PairSnapshot } from '../protocol/types';
import { bestDirection, exchangeName, feePerUnit } from '../state/selectors';
import { Age } from './Age';
import { Flash } from './Flash';

interface PairBoardProps {
  pair: PairSnapshot;
  exchanges: ExchangeInfo[];
}

/** 価格の表示桁数。取引所の刻みに合わせて最大8桁、末尾の 0 は落とす */
const PRICE_DIGITS = 8;
/** 数量（Base 通貨）の表示桁数 */
const QUANTITY_DIGITS = 8;
/** 金額（Quote 通貨）の表示桁数 */
const AMOUNT_DIGITS = 4;

/**
 * 1つの通貨ペアの枠。上から「今の状態 → 方向と『価格差 − 手数料 ＝ 差引』の式 → 各取引所の売値・買値」の順。
 * 板に並ぶ数量や逆方向の値は売買の判断に使わないので出さない（利益が出るときの数量は式の下に出す）。
 * memo にしているのは、別のペアが更新されたときに描き直さないようにするため（更新は秒間数十回ある）。
 */
export const PairBoard = memo(function PairBoard({ pair, exchanges }: PairBoardProps) {
  const t = useT();
  const best = bestDirection(pair);
  const hasQuotes = Object.keys(pair.quotes).length > 0;
  const badge = best?.profitable
    ? { className: 'badge', text: t.badgeProfitable }
    : hasQuotes
      ? { className: 'muted', text: t.badgeNone }
      : { className: 'muted', text: t.badgeWaiting };

  return (
    <section
      className={`card ${best?.profitable ? 'card--profitable' : ''}`}
      aria-label={pair.pair}
    >
      <header className="card__header">
        <h2>{pair.pair}</h2>
        <span className={badge.className}>{badge.text}</span>
      </header>

      {!hasQuotes ? (
        <p className="muted">{t.waitingForData}</p>
      ) : best === null ? (
        <p className="muted">{t.notEvaluable}</p>
      ) : (
        <Verdict direction={best} pair={pair} exchanges={exchanges} />
      )}

      {hasQuotes && <QuoteTable pair={pair} exchanges={exchanges} />}
    </section>
  );
});

interface VerdictProps {
  direction: Direction;
  pair: PairSnapshot;
  exchanges: ExchangeInfo[];
}

/** 主役の方向と、1単位あたりの「価格差 − 手数料 ＝ 差引」。利益が出れば数量と純利益、出なければ利益までの距離 */
function Verdict({ direction: d, pair, exchanges }: VerdictProps) {
  const t = useT();
  const digits = spreadDigits(d);
  return (
    <div className="verdict">
      <p>
        <strong>
          {t.direction(
            exchangeName(exchanges, d.buyExchange),
            exchangeName(exchanges, d.sellExchange),
          )}
        </strong>
        {!d.profitable && (
          <>
            {' '}
            <span className="tag">{t.tagBest}</span>
          </>
        )}
      </p>
      <Equation direction={d} pair={pair} />
      {d.profitable ? (
        <p className="figures">
          <Figure label={t.quantity}>
            <Flash value={d.quantity}>
              {formatDecimal(d.quantity, { maxFractionDigits: QUANTITY_DIGITS })} {pair.base}
            </Flash>
          </Figure>
          <Figure label={t.netProfit} className="pos">
            <Flash value={d.netProfit}>
              {formatDecimal(d.netProfit, { maxFractionDigits: AMOUNT_DIGITS, signed: true })}{' '}
              {pair.quote}
            </Flash>
          </Figure>
        </p>
      ) : (
        <p>
          <Flash value={d.netSpread}>
            {t.gapToProfit(
              `${formatDecimal(d.netSpread.replace('-', ''), { maxFractionDigits: digits })} ${t.perUnit(pair.base, pair.quote)}`,
            )}
          </Flash>
        </p>
      )}
      {d.profitable && d.depthExhausted && <p className="warn small">{t.depthExhausted}</p>}
    </div>
  );
}

/** 1単位あたりの「価格差 − 手数料 ＝ 差引」を式の形で並べる。文章を読まなくても数字の関係が分かる */
function Equation({ direction: d, pair }: { direction: Direction; pair: PairSnapshot }) {
  const t = useT();
  const digits = spreadDigits(d);
  const amount = (v: string) => formatDecimal(v, { maxFractionDigits: digits, signed: true });
  return (
    <p className="equation">
      <Figure label={t.rowSpread}>
        <Flash value={d.grossSpread}>{amount(d.grossSpread)}</Flash>
      </Figure>
      <span className="op">−</span>
      <Figure label={t.rowFees}>
        {formatDecimal(feePerUnit(d), { maxFractionDigits: digits })}
      </Figure>
      <span className="op">=</span>
      <Figure label={t.rowNet} className={d.profitable ? 'pos' : 'neg'}>
        <Flash value={d.netSpread}>{amount(d.netSpread)}</Flash>
      </Figure>
      <span className="muted small">{t.perUnit(pair.base, pair.quote)}</span>
    </p>
  );
}

/** 数字の下にラベルを添えた1項目 */
function Figure({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`figure ${className ?? ''}`}>
      <span className="figure__value">{children}</span>
      <span className="figure__label">{label}</span>
    </span>
  );
}

/** 1単位あたりの値は価格の刻み（小数桁数）に合わせて丸める。手数料を掛けて増えた末尾の桁は判断に使わない */
function spreadDigits(d: Direction): number {
  return Math.max(2, fractionDigitsOf(d.bestAsk.price), fractionDigitsOf(d.bestBid.price));
}

/** 取引所ごとの売値（bid）と買値（ask） */
function QuoteTable({ pair, exchanges }: { pair: PairSnapshot; exchanges: ExchangeInfo[] }) {
  const t = useT();
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">{t.colExchange}</th>
            <th scope="col" className="num">
              {t.colSellPrice}
            </th>
            <th scope="col" className="num">
              {t.colBuyPrice}
            </th>
            <th scope="col" className="num">
              {t.colUpdated}
            </th>
          </tr>
        </thead>
        <tbody>
          {exchanges.flatMap((ex) => {
            const q = pair.quotes[ex.id];
            if (!q) {
              return [];
            }
            return [
              <tr key={ex.id}>
                <th scope="row">{ex.name}</th>
                <td className="num">
                  <Flash value={q.bid.price}>
                    {formatDecimal(q.bid.price, { maxFractionDigits: PRICE_DIGITS })}
                  </Flash>
                </td>
                <td className="num">
                  <Flash value={q.ask.price}>
                    {formatDecimal(q.ask.price, { maxFractionDigits: PRICE_DIGITS })}
                  </Flash>
                </td>
                <td className="num muted small">
                  <Age since={q.updatedAt} />
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
