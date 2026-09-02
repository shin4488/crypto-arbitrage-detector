import { memo } from 'react';
import { formatDecimal, formatPercent, fractionDigitsOf, signOf } from '../format/number';
import { useT } from '../i18n';
import type { Direction, ExchangeInfo, PairSnapshot, Quote } from '../protocol/types';
import { exchangeName, profitableDirection } from '../state/selectors';
import { Age } from './Age';
import { Flash } from './Flash';

interface PairBoardProps {
  pair: PairSnapshot;
  exchanges: ExchangeInfo[];
}

/** 価格の表示桁数。取引所の刻みに合わせて最大8桁、末尾の0は落とす */
const PRICE_DIGITS = 8;
/** 数量（Base 通貨）の表示桁数 */
const QUANTITY_DIGITS = 8;
/** 金額（Quote 通貨）の表示桁数 */
const AMOUNT_DIGITS = 4;

/**
 * 1つの通貨ペアの板。取引所ごとの最良気配と、両方向の評価結果を表にして並べる。
 * memo にしているのは、別ペアの更新で再描画されないようにするため（ペアの更新頻度は秒間数十回）。
 */
export const PairBoard = memo(function PairBoard({ pair, exchanges }: PairBoardProps) {
  const t = useT();
  const best = profitableDirection(pair);
  const quoteEntries = exchanges.flatMap((ex) => {
    const q = pair.quotes[ex.id];
    return q ? [{ exchange: ex, quote: q }] : [];
  });

  return (
    <section className={`board ${best ? 'board--profitable' : ''}`} aria-label={pair.pair}>
      <header className="board__header">
        <h2>{pair.pair}</h2>
        {best ? (
          <span className="badge badge--profit">
            {t.profitable}{' '}
            <Flash value={best.netProfit}>
              {formatDecimal(best.netProfit, { maxFractionDigits: AMOUNT_DIGITS, signed: true })}{' '}
              {pair.quote}
            </Flash>
          </span>
        ) : (
          <span className="badge badge--none">{t.noOpportunity}</span>
        )}
      </header>

      {quoteEntries.length === 0 ? (
        <p className="muted board__empty">{t.waitingForData}</p>
      ) : (
        <div className="table-scroll">
          <table className="quotes">
            <thead>
              <tr>
                <th scope="col">{t.colExchange}</th>
                <th scope="col" className="num">
                  {t.colBid}
                  <span className="muted th-sub">{t.priceAndQuantity}</span>
                </th>
                <th scope="col" className="num">
                  {t.colAsk}
                  <span className="muted th-sub">{t.priceAndQuantity}</span>
                </th>
                <th scope="col" className="num">
                  {t.colUpdated}
                </th>
              </tr>
            </thead>
            <tbody>
              {quoteEntries.map(({ exchange, quote }) => (
                <QuoteRow
                  key={exchange.id}
                  name={exchange.name}
                  quote={quote}
                  base={pair.base}
                  levelsLabel={t.levels(Math.max(quote.bidLevels, quote.askLevels))}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="table-scroll">
        <table className="directions">
          <thead>
            <tr>
              <th scope="col">{t.colDirection}</th>
              <th scope="col" className="num">
                {t.colGrossSpread}
              </th>
              <th scope="col" className="num">
                {t.colNetSpread}
              </th>
              <th scope="col" className="num">
                {t.colQuantity}
              </th>
              <th scope="col" className="num">
                {t.colNetProfit}
              </th>
            </tr>
          </thead>
          <tbody>
            {pair.directions.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  {t.notEvaluable}
                </td>
              </tr>
            ) : (
              pair.directions.map((d) => (
                <DirectionRow
                  key={`${d.buyExchange}>${d.sellExchange}`}
                  direction={d}
                  pair={pair}
                  exchanges={exchanges}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
});

interface QuoteRowProps {
  name: string;
  quote: Quote;
  base: string;
  levelsLabel: string;
}

function QuoteRow({ name, quote, base, levelsLabel }: QuoteRowProps) {
  return (
    <tr>
      <th scope="row">
        {name} <span className="muted small">({levelsLabel})</span>
      </th>
      <td className="num">
        <Flash value={quote.bid.price}>
          {formatDecimal(quote.bid.price, { maxFractionDigits: PRICE_DIGITS })}
        </Flash>{' '}
        <span className="muted small">
          ({formatDecimal(quote.bid.quantity, { maxFractionDigits: QUANTITY_DIGITS })} {base})
        </span>
      </td>
      <td className="num">
        <Flash value={quote.ask.price}>
          {formatDecimal(quote.ask.price, { maxFractionDigits: PRICE_DIGITS })}
        </Flash>{' '}
        <span className="muted small">
          ({formatDecimal(quote.ask.quantity, { maxFractionDigits: QUANTITY_DIGITS })} {base})
        </span>
      </td>
      <td className="num muted small">
        <Age since={quote.updatedAt} />
      </td>
    </tr>
  );
}

interface DirectionRowProps {
  direction: Direction;
  pair: PairSnapshot;
  exchanges: ExchangeInfo[];
}

function DirectionRow({ direction: d, pair, exchanges }: DirectionRowProps) {
  const t = useT();
  const buy = exchangeName(exchanges, d.buyExchange);
  const sell = exchangeName(exchanges, d.sellExchange);
  const signClass = (v: string) => ({ '-1': 'neg', '0': '', '1': 'pos' })[String(signOf(v))];
  // 1単位あたりの値は価格の刻み（小数桁数）に合わせて丸める。手数料の乗算で増えた末尾桁は判断に不要なため
  const spreadDigits = Math.max(
    2,
    fractionDigitsOf(d.bestAsk.price),
    fractionDigitsOf(d.bestBid.price),
  );

  return (
    <>
      <tr className={d.profitable ? 'is-profitable' : ''}>
        <th scope="row">{t.direction(buy, sell)}</th>
        <td className={`num ${signClass(d.grossSpread)}`}>
          <Flash value={d.grossSpread}>
            {formatDecimal(d.grossSpread, { maxFractionDigits: spreadDigits, signed: true })}
          </Flash>{' '}
          <span className="muted small">({formatPercent(d.grossSpreadRatio)})</span>
        </td>
        <td className={`num ${signClass(d.netSpread)}`}>
          <Flash value={d.netSpread}>
            {formatDecimal(d.netSpread, { maxFractionDigits: spreadDigits, signed: true })}
          </Flash>
        </td>
        <td className="num">
          {d.profitable ? (
            <Flash value={d.quantity}>
              {formatDecimal(d.quantity, { maxFractionDigits: QUANTITY_DIGITS })} {pair.base}
            </Flash>
          ) : (
            <span className="muted">—</span>
          )}
        </td>
        <td className="num pos">
          {d.profitable ? (
            <strong>
              <Flash value={d.netProfit}>
                {formatDecimal(d.netProfit, { maxFractionDigits: AMOUNT_DIGITS, signed: true })}{' '}
                {pair.quote}
              </Flash>
            </strong>
          ) : (
            <span className="muted">—</span>
          )}
        </td>
      </tr>
      {d.profitable && (
        <tr className="is-profitable detail">
          <td colSpan={5}>
            <span>
              {t.avgBuyPrice} {formatDecimal(d.avgBuyPrice, { maxFractionDigits: PRICE_DIGITS })}
            </span>
            <span>
              {t.avgSellPrice} {formatDecimal(d.avgSellPrice, { maxFractionDigits: PRICE_DIGITS })}
            </span>
            <span>
              {t.grossProfit}{' '}
              {formatDecimal(d.grossProfit, { maxFractionDigits: AMOUNT_DIGITS, signed: true })}{' '}
              {pair.quote}
            </span>
            <span>
              {t.fees}{' '}
              {formatDecimal(sumDecimals(d.buyFee, d.sellFee), {
                maxFractionDigits: AMOUNT_DIGITS,
              })}{' '}
              {pair.quote}
            </span>
            {d.depthExhausted && <span className="note">{t.depthExhausted}</span>}
          </td>
        </tr>
      )}
    </>
  );
}

/** 手数料の合計表示用。値は小数8桁以内なので Number で十分な精度が出る */
function sumDecimals(a: string, b: string): string {
  return (Number(a) + Number(b)).toFixed(8);
}
