import { useDragReorder } from '../hooks/useDragReorder';
import type { Theme } from '../hooks/useStoredTheme';
import { type Lang, useT } from '../i18n';
import { type LayoutAction, orderedPairs, type PairLayout, visiblePairs } from '../state/layout';
import type { FeedState } from '../state/reducer';
import { AmountBar } from './AmountBar';
import { FeeNote } from './FeeNote';
import { Header } from './Header';
import { History } from './History';
import { PairBoard } from './PairBoard';
import { PairFilter } from './PairFilter';
import { Summary } from './Summary';

interface DashboardProps {
  state: FeedState;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  /** 取引金額の入力欄の文字列（不正な値もそのまま） */
  amountInput: string;
  /** 計算に使う取引金額（正の数に直したもの） */
  amount: string;
  onAmountChange: (value: string) => void;
  layout: PairLayout;
  onLayoutAction: (action: LayoutAction) => void;
}

/**
 * 画面全体。上から「接続の状態 → 利益が出る取引（あれば） → ペアごとの根拠 → 履歴」の順に並べ、
 * 上ほど大事な情報になるようにする。データの取得や設定の保存は持たず、渡された状態を表示するだけ。
 */
export function Dashboard({
  state,
  lang,
  onLangChange,
  theme,
  onThemeChange,
  amountInput,
  amount,
  onAmountChange,
  layout,
  onLayoutAction,
}: DashboardProps) {
  const t = useT();
  const ordered = orderedPairs(state.pairs, layout);
  const visible = visiblePairs(state.pairs, layout);
  // カードとチップのドラッグ＆ドロップ。落とした時点で layout に反映する
  const drag = useDragReorder((pair, target) => onLayoutAction({ type: 'moveTo', pair, target }));
  // 取引金額の単位。通貨ペアはすべて同じ Quote 通貨（USDT）を前提に、先頭のペアから取る
  const quote = state.pairs[0]?.quote ?? 'USDT';

  return (
    <div className="app">
      <Header
        connection={state.connection}
        exchanges={state.exchanges}
        lang={lang}
        onLangChange={onLangChange}
        theme={theme}
        onThemeChange={onThemeChange}
      />
      {state.initialized ? (
        <>
          <Summary pairs={state.pairs} exchanges={state.exchanges} amount={amount} />
          <div className="toolbar">
            <AmountBar amountInput={amountInput} quote={quote} onAmountChange={onAmountChange} />
            <PairFilter pairs={ordered} layout={layout} onAction={onLayoutAction} drag={drag} />
          </div>
          <main className="boards">
            {visible.length === 0 && <p className="muted">{t.noVisiblePairs}</p>}
            {visible.map((pair) => (
              <PairBoard
                key={pair.pair}
                pair={pair}
                exchanges={state.exchanges}
                amount={amount}
                dragging={drag.dragging === pair.pair}
                dropTarget={drag.dropTarget === pair.pair && drag.dragging !== pair.pair}
                onAction={onLayoutAction}
                drag={drag.handlers}
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
