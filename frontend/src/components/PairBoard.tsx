import { type DragEvent, type KeyboardEvent, memo, type ReactNode, useState } from 'react';
import { formatDecimal, multiplyDecimals, quantityFractionDigits } from '../format/number';
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
  collapsed: boolean;
  /** このカードをドラッグ中 */
  dragging: boolean;
  /** ドラッグ中のカードをここに落とせる位置として示す */
  dropTarget: boolean;
  onAction: (pair: string, action: LayoutAction) => void;
  onDragStart: (pair: string) => void;
  onDragOver: (pair: string) => void;
  onDrop: (pair: string) => void;
  onDragEnd: () => void;
}

/** 価格の表示桁数。取引所の刻みに合わせて最大8桁、末尾の 0 は落とす */
const PRICE_DIGITS = 8;
/** 金額（Quote 通貨）の表示桁数 */
const AMOUNT_DIGITS = 4;

/**
 * 1つの通貨ペアの枠。左に「方向と、取引金額ぶんの『価格差 − 手数料 ＝ 差引』の式」、右に「各取引所の買値・売値」。
 * 左上の取っ手をつかんでドラッグすると並び替えられる（取っ手にフォーカスして ↑↓ でも動かせる）。
 * memo にしているのは、別のペアが更新されたときに描き直さないようにするため（更新は秒間数十回ある）。
 */
export const PairBoard = memo(function PairBoard({
  pair,
  exchanges,
  amount,
  collapsed,
  dragging,
  dropTarget,
  onAction,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
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
      onAction(pair.pair, { type: 'moveBy', delta: e.key === 'ArrowUp' ? -1 : 1 });
    }
  };
  // dataTransfer はブラウザでは必ずあるが、テスト環境（jsdom）では無いので存在を確かめてから使う
  const handleDragStart = (e: DragEvent<HTMLElement>) => {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', pair.pair);
    }
    onDragStart(pair.pair);
  };
  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault(); // preventDefault しないと drop が発火しない
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    onDragOver(pair.pair);
  };
  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    onDrop(pair.pair);
  };

  return (
    <section
      className={`card ${best?.profitable ? 'card--profitable' : ''} ${dragging ? 'is-dragging' : ''} ${dropTarget ? 'is-drop-target' : ''}`}
      aria-label={pair.pair}
      draggable={armed}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={() => {
        setArmed(false);
        onDragEnd();
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
          ⋮⋮
        </button>
        <h2>{pair.pair}</h2>
        <span className={badge.className}>{badge.text}</span>
        <button
          type="button"
          className="icon-button"
          aria-label={collapsed ? t.expand : t.collapse}
          title={collapsed ? t.expand : t.collapse}
          aria-expanded={!collapsed}
          onClick={() => onAction(pair.pair, { type: 'toggleCollapsed' })}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      </header>

      {!collapsed && (
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
      )}
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
  const quantity = formatDecimal(plan.quantity, {
    maxFractionDigits: quantityFractionDigits(plan.quantity),
  });
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
