import { memo } from 'react';
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
 * 1つの通貨ペアの枠。上から順に「今の状態 → その理由（価格差と手数料の内訳）→ 各取引所の価格」と読める並びにする。
 * 数量や板の深さ、もう一方の方向は普段は見なくてよいので「詳細」に畳む。
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

      {hasQuotes && (
        <details>
          <summary>{t.details}</summary>
          <Details pair={pair} exchanges={exchanges} best={best} />
        </details>
      )}
    </section>
  );
});

interface VerdictProps {
  direction: Direction;
  pair: PairSnapshot;
  exchanges: ExchangeInfo[];
}

/** 今の状態を一文で言い切り、価格差と手数料の内訳でその理由を示す */
function Verdict({ direction: d, pair, exchanges }: VerdictProps) {
  const t = useT();
  const buy = exchangeName(exchanges, d.buyExchange);
  const sell = exchangeName(exchanges, d.sellExchange);

  return (
    <div>
      {d.profitable ? (
        <p className="lead">
          {t.leadProfitable(
            buy,
            `${formatDecimal(d.quantity, { maxFractionDigits: QUANTITY_DIGITS })} ${pair.base}`,
            sell,
          )}{' '}
          <strong className="pos">
            <Flash value={d.netProfit}>
              {t.leadProfit(
                `${formatDecimal(d.netProfit, { maxFractionDigits: AMOUNT_DIGITS, signed: true })} ${pair.quote}`,
              )}
            </Flash>
          </strong>
        </p>
      ) : (
        <p className="lead">{t.leadNone(buy, sell)}</p>
      )}
      <Breakdown direction={d} pair={pair} />
      {!d.profitable && (
        <p className="muted small">
          {t.shortfall(
            `${formatDecimal(d.netSpread.replace('-', ''), { maxFractionDigits: spreadDigits(d) })} ${pair.quote}`,
            pair.base,
          )}
        </p>
      )}
      {d.profitable && d.depthExhausted && <p className="warn small">{t.depthExhausted}</p>}
    </div>
  );
}

/** 1単位あたりの内訳: 価格差 − 手数料 = 手数料込み */
function Breakdown({ direction: d, pair }: { direction: Direction; pair: PairSnapshot }) {
  const t = useT();
  const digits = spreadDigits(d);
  const amount = (v: string) =>
    `${formatDecimal(v, { maxFractionDigits: digits, signed: true })} ${pair.quote}`;
  return (
    <table className="breakdown">
      <caption className="muted small">{t.perUnit(pair.base)}</caption>
      <tbody>
        <tr>
          <th scope="row">{t.rowSpread}</th>
          <td className="num">
            <Flash value={d.grossSpread}>{amount(d.grossSpread)}</Flash>
          </td>
        </tr>
        <tr>
          <th scope="row">{t.rowFees}</th>
          <td className="num">{amount(`-${feePerUnit(d)}`)}</td>
        </tr>
        <tr className="total">
          <th scope="row">{t.rowNet}</th>
          <td className={`num ${d.profitable ? 'pos' : 'neg'}`}>
            <Flash value={d.netSpread}>{amount(d.netSpread)}</Flash>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** 1単位あたりの値は価格の刻み（小数桁数）に合わせて丸める。手数料を掛けて増えた末尾の桁は判断に使わない */
function spreadDigits(d: Direction): number {
  return Math.max(2, fractionDigitsOf(d.bestAsk.price), fractionDigitsOf(d.bestBid.price));
}

/** 取引所ごとの「売れる価格」「買える価格」 */
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

interface DetailsProps {
  pair: PairSnapshot;
  exchanges: ExchangeInfo[];
  best: Direction | null;
}

/** 普段は見なくてよい情報: 最良気配の数量と板の段数、もう一方の方向の内訳 */
function Details({ pair, exchanges, best }: DetailsProps) {
  const t = useT();
  const other = pair.directions.find((d) => d !== best);
  return (
    <div className="details">
      <ul>
        {exchanges.flatMap((ex) => {
          const q = pair.quotes[ex.id];
          if (!q) {
            return [];
          }
          return [
            <li key={ex.id}>
              <strong>{ex.name}</strong>:{' '}
              {t.detailQuantity(
                `${formatDecimal(q.bid.quantity, { maxFractionDigits: QUANTITY_DIGITS })} ${pair.base}`,
                `${formatDecimal(q.ask.quantity, { maxFractionDigits: QUANTITY_DIGITS })} ${pair.base}`,
                Math.max(q.bidLevels, q.askLevels),
              )}
            </li>,
          ];
        })}
      </ul>
      {other && (
        <div>
          <p>
            <strong>{t.otherDirection}</strong>:{' '}
            {t.direction(
              exchangeName(exchanges, other.buyExchange),
              exchangeName(exchanges, other.sellExchange),
            )}
          </p>
          <Breakdown direction={other} pair={pair} />
        </div>
      )}
    </div>
  );
}
