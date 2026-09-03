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
          <select
            aria-label={t.language}
            value={lang}
            onChange={(e) => onLangChange(e.target.value as Lang)}
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
          <label title={t.tabTitleNotificationHelp}>
            <input
              type="checkbox"
              checked={tabNotification}
              onChange={(e) => onTabNotificationChange(e.target.checked)}
            />{' '}
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
