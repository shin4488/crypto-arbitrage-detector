import { useCallback, useState } from 'react';
import { type Lang, useT } from '../i18n';
import { isCollapsed, type LayoutAction, orderedPairs, type PairLayout } from '../state/layout';
import type { FeedState } from '../state/reducer';
import { AmountBar } from './AmountBar';
import { FeeNote } from './FeeNote';
import { Header } from './Header';
import { History } from './History';
import { PairBoard } from './PairBoard';
import { Summary } from './Summary';

interface DashboardProps {
  state: FeedState;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  /** 取引金額の入力欄の文字列（不正な値もそのまま） */
  amountInput: string;
  /** 計算に使う取引金額（正の数に直したもの） */
  amount: string;
  onAmountChange: (value: string) => void;
  layout: PairLayout;
  onLayoutAction: (pair: string, action: LayoutAction) => void;
}

/**
 * 画面全体。上から「接続の状態 → 利益が出る取引（あれば） → ペアごとの根拠 → 履歴」の順に並べ、
 * 上ほど大事な情報になるようにする。データの取得や設定の保存は持たず、渡された状態を表示するだけ。
 */
export function Dashboard({
  state,
  lang,
  onLangChange,
  amountInput,
  amount,
  onAmountChange,
  layout,
  onLayoutAction,
}: DashboardProps) {
  const t = useT();
  const ordered = orderedPairs(state.pairs, layout);
  // ドラッグ＆ドロップの途中経過。落とした時点で layout に反映する
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const handleDragStart = useCallback((pair: string) => setDragging(pair), []);
  const handleDragOver = useCallback((pair: string) => setDropTarget(pair), []);
  const handleDragEnd = useCallback(() => {
    setDragging(null);
    setDropTarget(null);
  }, []);
  const handleDrop = useCallback(
    (target: string) => {
      if (dragging !== null && dragging !== target) {
        onLayoutAction(dragging, { type: 'moveTo', target });
      }
      setDragging(null);
      setDropTarget(null);
    },
    [dragging, onLayoutAction],
  );
  // 取引金額の単位。通貨ペアはすべて同じ Quote 通貨（USDT）を前提に、先頭のペアから取る
  const quote = state.pairs[0]?.quote ?? 'USDT';

  return (
    <div className="app">
      <Header
        connection={state.connection}
        exchanges={state.exchanges}
        lang={lang}
        onLangChange={onLangChange}
      />
      {state.initialized ? (
        <>
          <Summary pairs={state.pairs} exchanges={state.exchanges} amount={amount} />
          <AmountBar amountInput={amountInput} quote={quote} onAmountChange={onAmountChange} />
          <main className="boards">
            {ordered.map((pair) => (
              <PairBoard
                key={pair.pair}
                pair={pair}
                exchanges={state.exchanges}
                amount={amount}
                collapsed={isCollapsed(layout, pair.pair)}
                dragging={dragging === pair.pair}
                dropTarget={dropTarget === pair.pair && dragging !== pair.pair}
                onAction={onLayoutAction}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))}
          </main>
          <History history={state.history} exchanges={state.exchanges} amount={amount} />
          <FeeNote exchanges={state.exchanges} />
        </>
      ) : (
        state.connection === 'connected' && <p className="muted">{t.waitingForData}</p>
      )}
    </div>
  );
}
