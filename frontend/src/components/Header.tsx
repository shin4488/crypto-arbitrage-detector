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
      <div className="header__title">
        <h1>{t.appTitle}</h1>
        <p className="muted">{t.appDescription}</p>
      </div>
      <dl className="status-list" aria-label="status">
        <div className={`status status--${connection}`}>
          <dt>{t.server}</dt>
          <dd>
            <span className="dot" aria-hidden="true" />
            {serverLabel}
          </dd>
        </div>
        {exchanges.map((ex) => (
          <div
            key={ex.id}
            className={`status status--${ex.connected ? 'connected' : 'disconnected'}`}
          >
            <dt>{ex.name}</dt>
            <dd>
              <span className="dot" aria-hidden="true" />
              {ex.connected ? t.exchangeConnected : t.exchangeDisconnected}
              <span className="muted">
                {' '}
                (<Age since={ex.since} />)
              </span>
              <span className="muted">
                {' · '}
                {t.takerFee} {formatPercent(ex.takerFeeRate, 3).replace('+', '')}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <label className="toggle" title={t.tabTitleNotificationHelp}>
        <input
          type="checkbox"
          checked={tabNotification}
          onChange={(e) => onTabNotificationChange(e.target.checked)}
        />
        {t.tabTitleNotification}
      </label>
    </header>
  );
}
