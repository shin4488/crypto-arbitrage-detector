import { useRef } from 'react';
import { trackEvent } from '../analytics';
import { signOf } from '../format/number';
import { useT } from '../i18n';

interface AmountBarProps {
  /** 入力欄の文字列（不正な値もそのまま） */
  amountInput: string;
  quote: string;
  onAmountChange: (value: string) => void;
}

/** 取引金額の入力。各ペアの計算に効く設定なので、カードのすぐ上に置く */
export function AmountBar({ amountInput, quote, onAmountChange }: AmountBarProps) {
  const t = useT();
  const edited = useRef(false);
  return (
    <div className="amount-bar">
      <label className="amount">
        {t.tradeAmount}
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={amountInput}
          aria-invalid={signOf(amountInput) !== 1}
          onChange={(e) => {
            edited.current = true;
            onAmountChange(e.target.value);
          }}
          onBlur={() => {
            if (edited.current) {
              trackEvent('amount_changed');
              edited.current = false;
            }
          }}
        />
        <span className="muted">{quote}</span>
      </label>
      <span className="muted small">{t.tradeAmountHelp}</span>
    </div>
  );
}
