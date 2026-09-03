import { type KeyboardEvent, memo, type ReactNode, useState } from 'react';
import { formatDecimal, multiplyDecimals, quantityFractionDigits } from '../format/number';
import { type DragHandlers, dragEvents } from '../hooks/useDragReorder';
import { useT } from '../i18n';
import type { Direction, ExchangeInfo, PairSnapshot } from '../protocol/types';
import type { LayoutAction } from '../state/layout';
import { bestDirection, exchangeName } from '../state/selectors';
import { planForAmount } from '../state/trade';
import { Age } from './Age';
import { Flash } from './Flash';

interface PairBoardProps {
  pair: PairSnapshot;
  exchanges: ExchangeInfo[];
  /** 取引金額（Quote 通貨建て、正の数） */
  amount: string;
  /** このカードをドラッグ中 */
  dragging: boolean;
  /** ドラッグ中のカードをここに落とせる位置として示す */
  dropTarget: boolean;
  onAction: (action: LayoutAction) => void;
  /** 並び替えのドラッグ操作（チップと共有） */
  drag: DragHandlers;
}

/** 価格の表示桁数。取引所の刻みに合わせて最大8桁、末尾の 0 は落とす */
const PRICE_DIGITS = 8;
/** 金額（Quote 通貨）の表示桁数 */
const AMOUNT_DIGITS = 4;

/**
 * 1つの通貨ペアの枠。上に「方向と、取引金額ぶんの『価格差 − 手数料 ＝ 差引』の式」、下に「各取引所の買値・売値」。
 * 左上の取っ手をつかんでドラッグすると並び替えられ（取っ手にフォーカスして ↑↓ でも動かせる）、右上の目で隠せる。
 * memo にしているのは、別のペアが更新されたときに描き直さないようにするため（更新は秒間数十回ある）。
 */
export const PairBoard = memo(function PairBoard({
  pair,
  exchanges,
  amount,
  dragging,
  dropTarget,
  onAction,
  drag,
}: PairBoardProps) {
  const t = useT();
  const best = bestDirection(pair);
  const hasQuotes = Object.keys(pair.quotes).length > 0;
  const badge = best?.profitable
    ? { className: 'badge', text: t.badgeProfitable }
    : hasQuotes
      ? { className: 'muted', text: t.badgeNone }
      : { className: 'muted', text: t.badgeWaiting };
  // 取っ手を押している間だけカードをドラッグ可能にする（本文の選択やリンク操作を邪魔しないため）
  const [armed, setArmed] = useState(false);

  const handleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      onAction({ type: 'moveBy', pair: pair.pair, delta: e.key === 'ArrowUp' ? -1 : 1 });
    }
  };
  const events = dragEvents(drag, pair.pair);

  return (
    <section
      className={`card ${best?.profitable ? 'card--profitable' : ''} ${dragging ? 'is-dragging' : ''} ${dropTarget ? 'is-drop-target' : ''}`}
      aria-label={pair.pair}
      draggable={armed}
      {...events}
      onDragEnd={() => {
        setArmed(false);
        events.onDragEnd();
      }}
    >
      <header className="card__header">
        <button
          type="button"
          className="drag-handle"
          aria-label={t.dragToReorder}
          title={t.dragToReorder}
          onMouseDown={() => setArmed(true)}
          onMouseUp={() => setArmed(false)}
          onKeyDown={handleKey}
        >
          <GripIcon />
        </button>
        <h2>{pair.pair}</h2>
        <span className={badge.className}>{badge.text}</span>
        <button
          type="button"
          className="icon-button"
          aria-label={t.hidePair}
          title={t.hidePair}
          onClick={() => onAction({ type: 'toggleHidden', pair: pair.pair })}
        >
          <EyeOffIcon />
        </button>
      </header>

      <div className="card__body">
        {!hasQuotes ? (
          <p className="muted">{t.waitingForData}</p>
        ) : best === null ? (
          <p className="muted">{t.notEvaluable}</p>
        ) : (
          <Verdict direction={best} pair={pair} exchanges={exchanges} amount={amount} />
        )}
        {hasQuotes && <QuoteTable pair={pair} exchanges={exchanges} best={best} />}
      </div>
    </section>
  );
});

/**
 * 取っ手の6つの点。文字の「⋮⋮」はフォント次第で細く小さくなり見つけにくかったので、点を描いて大きさをそろえる。
 * アイコン集を依存に足すほどではないので手で描いている（目のアイコンも同じ）
 */
function GripIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="currentColor">
      <circle cx="9" cy="5" r="2.2" />
      <circle cx="15" cy="5" r="2.2" />
      <circle cx="9" cy="12" r="2.2" />
      <circle cx="15" cy="12" r="2.2" />
      <circle cx="9" cy="19" r="2.2" />
      <circle cx="15" cy="19" r="2.2" />
    </svg>
  );
}

/** 「隠す」の目のアイコン */
function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="1.1em"
      height="1.1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.2A10 10 0 0 1 12 5c5 0 9 4 10 7a11 11 0 0 1-2.7 3.9" />
      <path d="M6.6 6.6C4.4 8 2.8 10 2 12c1 3 5 7 10 7a9.5 9.5 0 0 0 4.1-.9" />
    </svg>
  );
}

interface VerdictProps {
  direction: Direction;
  pair: PairSnapshot;
  exchanges: ExchangeInfo[];
  amount: string;
}

/** 主役の方向と、取引金額ぶんの「価格差 − 手数料 ＝ 差引」。差引がそのまま損益になる（プラスは緑、マイナスは赤） */
function Verdict({ direction: d, pair, exchanges, amount }: VerdictProps) {
  const t = useT();
  const plan = planForAmount(d, amount);
  const money = (v: string) => formatDecimal(v, { maxFractionDigits: AMOUNT_DIGITS, signed: true });
  const quantity = formatDecimal(plan.quantity, {
    maxFractionDigits: quantityFractionDigits(plan.quantity),
  });
  // 実際にかかる金額（数量 × 買値）。数量を8桁で切っているので、指定額とわずかにずれることがある
  const cost = formatDecimal(multiplyDecimals(plan.quantity, d.bestAsk.price), {
    maxFractionDigits: 2,
  });

  return (
    <div className="verdict">
      <p className="direction">
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
      </p>
      <p className="muted small">{t.forAmount(quantity, pair.base, cost, pair.quote)}</p>
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
