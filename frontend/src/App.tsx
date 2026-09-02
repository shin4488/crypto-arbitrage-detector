import { useMemo } from 'react';
import { Dashboard } from './components/Dashboard';
import { useArbitrageFeed } from './hooks/useArbitrageFeed';
import { useStoredBoolean } from './hooks/useStoredBoolean';
import { useTitleNotification } from './hooks/useTitleNotification';
import { detectLang, getDict, LangContext } from './i18n';
import { titleSummary } from './state/selectors';

/** WebSocket の接続先。通常は同一オリジンの /ws（バックエンドが画面ごと配信する） */
function defaultWsUrl(): string {
  const override = import.meta.env.VITE_WS_URL as string | undefined;
  if (override) {
    return override;
  }
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}/ws`;
}

const TAB_NOTIFICATION_KEY = 'arb.tabNotification';

export function App() {
  const lang = useMemo(() => detectLang(), []);
  const wsUrl = useMemo(defaultWsUrl, []);
  const state = useArbitrageFeed(wsUrl);
  const [tabNotification, setTabNotification] = useStoredBoolean(TAB_NOTIFICATION_KEY, false);

  const summary = useMemo(() => titleSummary(state.pairs), [state.pairs]);
  useTitleNotification(tabNotification, summary, getDict(lang).appTitle);

  return (
    <LangContext.Provider value={lang}>
      <Dashboard
        state={state}
        tabNotification={tabNotification}
        onTabNotificationChange={setTabNotification}
      />
    </LangContext.Provider>
  );
}
