import { useT } from '../i18n';
import type { FeedState } from '../state/reducer';
import { Header } from './Header';
import { History } from './History';
import { PairBoard } from './PairBoard';

interface DashboardProps {
  state: FeedState;
  tabNotification: boolean;
  onTabNotificationChange: (enabled: boolean) => void;
}

/** 画面全体。データの取得や設定の保存は持たず、渡された状態を表示するだけにしてテストしやすくしている */
export function Dashboard({ state, tabNotification, onTabNotificationChange }: DashboardProps) {
  const t = useT();
  return (
    <div className="app">
      <Header
        connection={state.connection}
        exchanges={state.exchanges}
        tabNotification={tabNotification}
        onTabNotificationChange={onTabNotificationChange}
      />
      {state.connection === 'disconnected' && state.initialized && (
        <p className="warn" role="status">
          {t.serverDisconnected}
        </p>
      )}
      <main className="boards">
        {state.initialized ? (
          state.pairs.map((pair) => (
            <PairBoard key={pair.pair} pair={pair} exchanges={state.exchanges} />
          ))
        ) : (
          <p className="muted" role="status">
            {state.connection === 'connected' ? t.waitingForData : t.serverConnecting}
          </p>
        )}
      </main>
      {state.initialized && <History history={state.history} exchanges={state.exchanges} />}
    </div>
  );
}
