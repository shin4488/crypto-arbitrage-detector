import { type Lang, useT } from '../i18n';
import type { ExchangeInfo } from '../protocol/types';
import type { ConnectionStatus } from '../state/reducer';

interface HeaderProps {
  connection: ConnectionStatus;
  exchanges: ExchangeInfo[];
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  tabNotification: boolean;
  onTabNotificationChange: (enabled: boolean) => void;
}

/** タイトル、言語と通知の切り替え、接続状態の1行 */
export function Header({
  connection,
  exchanges,
  lang,
  onLangChange,
  tabNotification,
  onTabNotificationChange,
}: HeaderProps) {
  const t = useT();
  const status = connectionSentence(connection, exchanges, t);

  return (
    <header>
      <div className="header">
        <div>
          <h1>{t.appTitle}</h1>
          <p className="muted">{t.appDescription}</p>
        </div>
        <div className="controls">
          <LangSwitch lang={lang} onChange={onLangChange} label={t.language} />
          <label className="switch" title={t.tabTitleNotificationHelp}>
            <input
              type="checkbox"
              checked={tabNotification}
              onChange={(e) => onTabNotificationChange(e.target.checked)}
            />
            <span className="switch__track" aria-hidden="true" />
            {t.tabTitleNotification}
          </label>
        </div>
      </div>
      <p className={`status ${status.ok ? 'pos' : 'warn'}`} role="status">
        ● {status.text}
      </p>
    </header>
  );
}

/** 接続の状態を「今どうなっているか」が分かる1文にまとめる */
function connectionSentence(
  connection: ConnectionStatus,
  exchanges: ExchangeInfo[],
  t: ReturnType<typeof useT>,
): { ok: boolean; text: string } {
  if (connection === 'connecting') {
    return { ok: false, text: t.statusConnecting };
  }
  if (connection === 'disconnected') {
    return { ok: false, text: t.statusServerDisconnected };
  }
  const down = exchanges.filter((ex) => !ex.connected).map((ex) => ex.name);
  if (down.length > 0) {
    return { ok: false, text: t.statusExchangeDisconnected(down.join('・')) };
  }
  return { ok: true, text: t.statusWatching(exchanges.map((ex) => ex.name).join('・')) };
}

const LANGS: { value: Lang; label: string }[] = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
];

/** 言語の切り替え。選択肢を並べて選択中を反転させる（セグメントコントロール） */
function LangSwitch({
  lang,
  onChange,
  label,
}: {
  lang: Lang;
  onChange: (lang: Lang) => void;
  label: string;
}) {
  return (
    <fieldset className="segmented" aria-label={label}>
      {LANGS.map((item) => (
        <button
          key={item.value}
          type="button"
          lang={item.value}
          aria-pressed={lang === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </fieldset>
  );
}
