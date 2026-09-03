import { formatDecimal, quantityFractionDigits } from '../format/number';
import { useT } from '../i18n';
import type { Episode, ExchangeInfo } from '../protocol/types';
import { exchangeName } from '../state/selectors';
import { episodeForAmount } from '../state/trade';
import { Duration } from './Age';

interface HistoryProps {
  history: Episode[];
  exchanges: ExchangeInfo[];
  /** 取引金額（Quote 通貨建て、正の数）。履歴の利益もこの金額ぶんで示す */
  amount: string;
}

export function History({ history, exchanges, amount }: HistoryProps) {
  const t = useT();
  return (
    <section className="card" aria-label={t.historyTitle}>
      <div>
        <h2>
          {t.historyTitle} <span className="muted small">({t.historyCount(history.length)})</span>
        </h2>
        <p className="muted small">{t.historyHelp}</p>
      </div>
      {history.length === 0 ? (
        <p className="muted">{t.historyEmpty}</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{t.colTime}</th>
                <th scope="col">{t.colPair}</th>
                <th scope="col">{t.colTrade}</th>
                <th scope="col" className="num">
                  {t.colMaxNetProfit}
                </th>
                <th scope="col" className="num">
                  {t.colDuration}
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((ep) => {
                const [base, quote] = ep.pair.split('/');
                const trade = episodeForAmount(ep, amount);
                return (
                  <tr key={ep.id}>
                    <td>
                      <time dateTime={ep.startedAt} title={new Date(ep.startedAt).toLocaleString()}>
                        {formatTime(ep.startedAt)}
                      </time>
                    </td>
                    <td>{ep.pair}</td>
                    <td>
                      {t.direction(
                        exchangeName(exchanges, ep.buyExchange),
                        exchangeName(exchanges, ep.sellExchange),
                      )}{' '}
                      <span className="muted small">
                        (
                        {formatDecimal(trade.quantity, {
                          maxFractionDigits: quantityFractionDigits(trade.quantity),
                        })}{' '}
                        {base})
                      </span>
                    </td>
                    <td className="num pos">
                      {formatDecimal(trade.net, { maxFractionDigits: 4, signed: true })} {quote}
                    </td>
                    <td className="num">
                      {ep.endedAt === null && <span className="badge small">{t.ongoing}</span>}{' '}
                      <Duration from={ep.startedAt} to={ep.endedAt} />
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

/** ローカル時刻の "HH:MM:SS.mmm"。日付は title 属性で確認できる */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}
