import { useEffect, useMemo, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { useArbitrageFeed } from './hooks/useArbitrageFeed';
import { useStoredLang } from './hooks/useStoredLang';
import { useTitleNotification } from './hooks/useTitleNotification';
import { getDict, LangContext } from './i18n';
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
  const wsUrl = useMemo(defaultWsUrl, []);
  const state = useArbitrageFeed(wsUrl);
  // 取引金額（Quote 通貨建て）。開くたびに既定値から始める。入力欄の文字列を持ち、計算には正の数に直したものを使う
  const [amountInput, setAmountInput] = useState(DEFAULT_AMOUNT);
  const amount = normalizeAmount(amountInput);

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
        onLangChange={setLang}
        amountInput={amountInput}
        amount={amount}
        onAmountChange={setAmountInput}
      />
    </LangContext.Provider>
  );
}
