import { formatPercent } from '../format/number';
import { useT } from '../i18n';
import type { ExchangeInfo } from '../protocol/types';
import type { ConnectionStatus } from '../state/reducer';
import { Age } from './Age';

interface HeaderProps {
  connection: ConnectionStatus;
  exchanges: ExchangeInfo[];
  tabNotification: boolean;
  onTabNotificationChange: (enabled: boolean) => void;
}

export function Header({
  connection,
  exchanges,
  tabNotification,
  onTabNotificationChange,
}: HeaderProps) {
  const t = useT();
  const serverLabel = {
    connecting: t.serverConnecting,
    connected: t.serverConnected,
    disconnected: t.serverDisconnected,
  }[connection];

  return (
    <header className="header">
      <div>
        <h1>{t.appTitle}</h1>
        <p className="muted">{t.appDescription}</p>
      </div>
      <ul className="status-list" aria-label="status">
        <li>
          <Dot ok={connection === 'connected'} />
          <strong>{t.server}:</strong> {serverLabel}
        </li>
        {exchanges.map((ex) => (
          <li key={ex.id}>
            <Dot ok={ex.connected} />
            <strong>{ex.name}:</strong>{' '}
            {ex.connected ? t.exchangeConnected : t.exchangeDisconnected}{' '}
            <span className="muted">
              (<Age since={ex.since} />) · {t.takerFee}{' '}
              {formatPercent(ex.takerFeeRate, 3).replace('+', '')}
            </span>
          </li>
        ))}
      </ul>
      <label title={t.tabTitleNotificationHelp}>
        <input
          type="checkbox"
          checked={tabNotification}
          onChange={(e) => onTabNotificationChange(e.target.checked)}
        />{' '}
        {t.tabTitleNotification}
      </label>
    </header>
  );
}

/** 接続状態を色で示す点。緑＝接続中、赤＝切断 */
function Dot({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? 'pos' : 'neg'} aria-hidden="true">
      ●{' '}
    </span>
  );
}
