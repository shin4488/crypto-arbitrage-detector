import { useEffect, useMemo, useRef, useState } from 'react';
import { trackEvent, updateUserPreferences } from './analytics';
import { Dashboard } from './components/Dashboard';
import { useArbitrageFeed } from './hooks/useArbitrageFeed';
import { usePairLayout } from './hooks/usePairLayout';
import { useStoredLang } from './hooks/useStoredLang';
import { useStoredTheme } from './hooks/useStoredTheme';
import { useTitleNotification } from './hooks/useTitleNotification';
import { getDict, LangContext } from './i18n';
import { applyLayoutAction, isHidden, type LayoutAction } from './state/layout';
import { titleSummary } from './state/selectors';
import { DEFAULT_AMOUNT, normalizeAmount } from './state/trade';

/** WebSocket の接続先。通常は同一オリジンの /ws（バックエンドが画面ごと配信する） */
function defaultWsUrl(): string {
  const override = import.meta.env.VITE_WS_URL as string | undefined;
  if (override) {
    return override;
  }
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}/ws`;
}

export function App() {
  const [lang, setLang] = useStoredLang();
  const [theme, setTheme] = useStoredTheme();
  const wsUrl = useMemo(defaultWsUrl, []);
  const state = useArbitrageFeed(wsUrl);
  // 取引金額（Quote 通貨建て）。開くたびに既定値から始める。入力欄の文字列を持ち、計算には正の数に直したものを使う
  const [amountInput, setAmountInput] = useState(DEFAULT_AMOUNT);
  const amount = normalizeAmount(amountInput);
  const [layout, onLayoutAction] = usePairLayout(state.pairs);
  const readyTracked = useRef(false);

  useEffect(() => {
    updateUserPreferences(lang, theme);
  }, [lang, theme]);

  useEffect(() => {
    if (state.initialized && !readyTracked.current) {
      readyTracked.current = true;
      trackEvent('dashboard_ready');
    }
  }, [state.initialized]);

  function handleLayoutAction(action: LayoutAction) {
    const next = applyLayoutAction(layout, state.pairs, action);
    if (next !== layout) {
      switch (action.type) {
        case 'toggleHidden':
          trackEvent('pair_visibility_changed', {
            pair_symbol: action.pair,
            visible: !isHidden(next, action.pair),
          });
          break;
        case 'showAll':
          trackEvent('pairs_reset');
          break;
        case 'moveBy':
        case 'moveTo':
          trackEvent('pair_reordered', {
            pair_symbol: action.pair,
            interaction_method: action.type === 'moveBy' ? 'keyboard' : 'drag',
          });
          break;
      }
    }
    onLayoutAction(action);
  }

  const summary = useMemo(() => titleSummary(state.pairs, amount), [state.pairs, amount]);
  // 利益が出ている間はタブのタイトルにも出す。文字列を1つ設定するだけなので常に有効にしている
  useTitleNotification(summary, getDict(lang).appTitle);

  // 読み上げや翻訳機能が正しい言語として扱えるよう、html の lang 属性も合わせる
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LangContext.Provider value={lang}>
      <Dashboard
        state={state}
        lang={lang}
        onLangChange={(next) => {
          if (next !== lang) {
            trackEvent('language_changed', { ui_language: next });
            setLang(next);
          }
        }}
        theme={theme}
        onThemeChange={(next) => {
          if (next !== theme) {
            trackEvent('theme_changed', { ui_theme: next });
            setTheme(next);
          }
        }}
        amountInput={amountInput}
        amount={amount}
        onAmountChange={setAmountInput}
        layout={layout}
        onLayoutAction={handleLayoutAction}
      />
    </LangContext.Provider>
  );
}
