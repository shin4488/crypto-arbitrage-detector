import { formatPercent } from '../format/number';
import { type Lang, useT } from '../i18n';
import type { FeedState } from '../state/reducer';
import { Header } from './Header';
import { History } from './History';
import { PairBoard } from './PairBoard';
import { Summary } from './Summary';

interface DashboardProps {
  state: FeedState;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  tabNotification: boolean;
  onTabNotificationChange: (enabled: boolean) => void;
}

/**
 * 画面全体。上から「接続の状態 → 今、機会があるか → ペアごとの根拠 → 履歴」の順に並べ、
 * 上ほど大事な情報になるようにする。データの取得や設定の保存は持たず、渡された状態を表示するだけ。
 */
export function Dashboard({
  state,
  lang,
  onLangChange,
  tabNotification,
  onTabNotificationChange,
}: DashboardProps) {
  const t = useT();
  const fees = state.exchanges
    .map((ex) => `${ex.name} ${formatPercent(ex.takerFeeRate, 3).replace('+', '')}`)
    .join('・');

  return (
    <div className="app">
      <Header
        connection={state.connection}
        exchanges={state.exchanges}
        lang={lang}
        onLangChange={onLangChange}
        tabNotification={tabNotification}
        onTabNotificationChange={onTabNotificationChange}
      />
      {state.initialized ? (
        <>
          <Summary pairs={state.pairs} exchanges={state.exchanges} />
          <main className="boards">
            {state.pairs.map((pair) => (
              <PairBoard key={pair.pair} pair={pair} exchanges={state.exchanges} />
            ))}
          </main>
          <History history={state.history} exchanges={state.exchanges} />
          <p className="muted small">
            {t.feeNote(fees)} · {t.theoreticalNote}
          </p>
        </>
      ) : (
        state.connection === 'connected' && <p className="muted">{t.waitingForData}</p>
      )}
    </div>
  );
}
