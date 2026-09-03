import { memo, type ReactNode } from 'react';
import { formatDecimal, multiplyDecimals } from '../format/number';
import { useT } from '../i18n';
import type { Direction, ExchangeInfo, PairSnapshot } from '../protocol/types';
import { bestDirection, exchangeName } from '../state/selectors';
import { planForAmount } from '../state/trade';
import { Age } from './Age';
import { Flash } from './Flash';

interface PairBoardProps {
  pair: PairSnapshot;
  exchanges: ExchangeInfo[];
  /** 取引金額（Quote 通貨建て、正の数） */
  amount: string;
}

/** 価格の表示桁数。取引所の刻みに合わせて最大8桁、末尾の 0 は落とす */
const PRICE_DIGITS = 8;
/** 数量（Base 通貨）の表示桁数 */
const QUANTITY_DIGITS = 8;
/** 金額（Quote 通貨）の表示桁数 */
const AMOUNT_DIGITS = 4;

/**
 * 1つの通貨ペアの枠。上から「今の状態 → 方向と、取引金額ぶんの『価格差 − 手数料 ＝ 差引』の式 → 各取引所の買値・売値」の順。
 * 板に並ぶ数量や逆方向の値は売買の判断に使わないので出さない。
 * memo にしているのは、別のペアが更新されたときに描き直さないようにするため（更新は秒間数十回ある）。
 */
export const PairBoard = memo(function PairBoard({ pair, exchanges, amount }: PairBoardProps) {
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
        <Verdict direction={best} pair={pair} exchanges={exchanges} amount={amount} />
      )}

      {hasQuotes && <QuoteTable pair={pair} exchanges={exchanges} best={best} />}
    </section>
  );
});

interface VerdictProps {
  direction: Direction;
  pair: PairSnapshot;
  exchanges: ExchangeInfo[];
  amount: string;
}

/** 主役の方向と、取引金額ぶんの「価格差 − 手数料 ＝ 差引」。差引がそのまま損益になる */
function Verdict({ direction: d, pair, exchanges, amount }: VerdictProps) {
  const t = useT();
  const plan = planForAmount(d, amount);
  const money = (v: string) => formatDecimal(v, { maxFractionDigits: AMOUNT_DIGITS, signed: true });
  const quantity = formatDecimal(plan.quantity, { maxFractionDigits: QUANTITY_DIGITS });
  // 実際にかかる金額（数量 × 買値）。数量を8桁で切っているので、指定額とわずかにずれることがある
  const cost = formatDecimal(multiplyDecimals(plan.quantity, d.bestAsk.price), {
    maxFractionDigits: 2,
  });

  return (
    <div className="verdict">
      <p>
        <strong>
          <span className="buy">{t.buyOn(exchangeName(exchanges, d.buyExchange))}</span>
          {' → '}
          <span className="sell">{t.sellOn(exchangeName(exchanges, d.sellExchange))}</span>
        </strong>
      </p>
      <p className="equation">
        <Figure label={t.rowSpread}>
          <Flash value={plan.gross}>{money(plan.gross)}</Flash>
        </Figure>
        <span className="op">−</span>
        <Figure label={t.rowFees}>
          {formatDecimal(plan.fees, { maxFractionDigits: AMOUNT_DIGITS })}
        </Figure>
        <span className="op">=</span>
        <Figure label={t.rowNet} className={d.profitable ? 'pos' : 'neg'}>
          <Flash value={plan.net}>{money(plan.net)}</Flash>
        </Figure>
        <span className="muted small">{t.forAmount(quantity, pair.base, cost, pair.quote)}</span>
      </p>
      {plan.capped && (
        <p className="warn small">
          {t.capped(quantity, pair.base, cost, pair.quote)}
          {d.depthExhausted && `。${t.depthExhausted}`}
        </p>
      )}
    </div>
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

/**
 * 取引所ごとの買値（ask）と売値（bid）。「買って売る」の順に読めるよう買値を左に置く。
 * 有利な方向で使う2つの価格（買う取引所の買値、売る取引所の売値）に色と札を付け、いくらで買っていくらで売るかを一目で示す。
 */
function QuoteTable({
  pair,
  exchanges,
  best,
}: {
  pair: PairSnapshot;
  exchanges: ExchangeInfo[];
  best: Direction | null;
}) {
  const t = useT();
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">{t.colExchange}</th>
            <th scope="col" className="num">
              {t.colBuyPrice}
            </th>
            <th scope="col" className="num">
              {t.colSellPrice}
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
            const isBuy = best?.buyExchange === ex.id;
            const isSell = best?.sellExchange === ex.id;
            return [
              <tr key={ex.id}>
                <th scope="row">{ex.name}</th>
                <td className={`num ${isBuy ? 'pick pick--buy' : ''}`}>
                  {isBuy && <span className="pick__tag">{t.pickBuy}</span>}
                  <Flash value={q.ask.price}>
                    {formatDecimal(q.ask.price, { maxFractionDigits: PRICE_DIGITS })}
                  </Flash>
                </td>
                <td className={`num ${isSell ? 'pick pick--sell' : ''}`}>
                  {isSell && <span className="pick__tag">{t.pickSell}</span>}
                  <Flash value={q.bid.price}>
                    {formatDecimal(q.bid.price, { maxFractionDigits: PRICE_DIGITS })}
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
