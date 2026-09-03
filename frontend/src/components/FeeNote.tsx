import { useState } from 'react';
import { EXCHANGE_FEE_INFO } from '../exchanges';
import { formatPercent } from '../format/number';
import { useT } from '../i18n';
import type { ExchangeInfo } from '../protocol/types';

interface FeeNoteProps {
  exchanges: ExchangeInfo[];
}

/** 画面の最後に置く手数料の注記。ⓘ を押すかマウスを乗せると、手数料の根拠と公式ページへのリンクが出る */
export function FeeNote({ exchanges }: FeeNoteProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const fees = exchanges
    .map((ex) => `${ex.name} ${formatPercent(ex.takerFeeRate, 3).replace('+', '')}`)
    .join('・');

  return (
    <div className="muted small">
      {t.feeNote(fees)}{' '}
      <span className="info">
        <button
          type="button"
          className="info__button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="info__icon" aria-hidden="true">
            i
          </span>
          {t.feeInfoLabel}
        </button>
        <span className={`info__popover ${open ? 'is-open' : ''}`} role="tooltip">
          <strong>{t.feeInfoTitle}</strong>
          <span>{t.feeInfoIntro}</span>
          {exchanges.map((ex) => {
            const info = EXCHANGE_FEE_INFO[ex.id];
            if (!info) {
              return null;
            }
            return (
              <span key={ex.id} className="info__item">
                {t.feeInfoRate(ex.name, t.feeTier[info.tier], info.maker, info.taker)}{' '}
                <a href={info.url} target="_blank" rel="noopener noreferrer">
                  {t.feeInfoLink}
                </a>
              </span>
            );
          })}
          <span>{t.feeInfoTier}</span>
          <span>{t.feeInfoTaker}</span>
        </span>
      </span>{' '}
      · {t.theoreticalNote}
    </div>
  );
}
