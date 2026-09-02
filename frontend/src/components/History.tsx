import { formatDecimal } from '../format/number';
import { useT } from '../i18n';
import type { Episode, ExchangeInfo } from '../protocol/types';
import { exchangeName } from '../state/selectors';
import { Duration } from './Age';

interface HistoryProps {
  history: Episode[];
  exchanges: ExchangeInfo[];
}

export function History({ history, exchanges }: HistoryProps) {
  const t = useT();
  return (
    <section className="history" aria-label={t.historyTitle}>
      <header className="history__header">
        <h2>
          {t.historyTitle} <span className="muted small">({t.historyCount(history.length)})</span>
        </h2>
        <p className="muted small">{t.historyHelp}</p>
      </header>
      {history.length === 0 ? (
        <p className="muted">{t.historyEmpty}</p>
      ) : (
        <div className="table-scroll">
          <table className="episodes">
            <thead>
              <tr>
                <th scope="col">{t.colStarted}</th>
                <th scope="col">{t.colPair}</th>
                <th scope="col">{t.colDirection}</th>
                <th scope="col" className="num">
                  {t.colDuration}
                </th>
                <th scope="col" className="num">
                  {t.colMaxNetProfit}
                </th>
                <th scope="col" className="num">
                  {t.colQuantityAtMax}
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((ep) => {
                const [base, quote] = ep.pair.split('/');
                return (
                  <tr key={ep.id} className={ep.endedAt === null ? 'is-ongoing' : ''}>
                    <td>
                      <time dateTime={ep.startedAt}>{formatTime(ep.startedAt)}</time>
                    </td>
                    <td>{ep.pair}</td>
                    <td>
                      {t.direction(
                        exchangeName(exchanges, ep.buyExchange),
                        exchangeName(exchanges, ep.sellExchange),
                      )}
                    </td>
                    <td className="num">
                      {ep.endedAt === null && (
                        <span className="badge badge--live">{t.ongoing}</span>
                      )}{' '}
                      <Duration from={ep.startedAt} to={ep.endedAt} />
                    </td>
                    <td className="num pos">
                      {formatDecimal(ep.maxNetProfit, { maxFractionDigits: 4, signed: true })}{' '}
                      {quote}
                    </td>
                    <td className="num">
                      {formatDecimal(ep.quantityAtMax, { maxFractionDigits: 8 })} {base}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** ローカル時刻の "HH:MM:SS.mmm"。日付は同日運用が中心なので title 属性に回す */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}
