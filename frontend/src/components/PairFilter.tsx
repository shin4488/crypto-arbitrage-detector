import { useT } from '../i18n';
import { isHidden, type LayoutAction, type PairLayout } from '../state/layout';

interface PairFilterProps {
  /** 表示順に並んだ全ペア（隠しているものも含む） */
  pairs: { pair: string }[];
  layout: PairLayout;
  onAction: (action: LayoutAction) => void;
}

/**
 * 表示するペアを選ぶチップの列。押し込まれているペアだけカードが出る。
 * 隠したペアもここに残るので、何を隠しているかと戻し方が同じ場所で分かる。
 * fieldset にしているのは、支援技術に「表示するペア」という一つのまとまりとして伝えるため。
 */
export function PairFilter({ pairs, layout, onAction }: PairFilterProps) {
  const t = useT();
  const anyHidden = pairs.some((p) => isHidden(layout, p.pair));
  return (
    <fieldset className="pair-filter">
      <legend>{t.showPairs}:</legend>
      {pairs.map((p) => (
        <button
          key={p.pair}
          type="button"
          className="chip"
          aria-pressed={!isHidden(layout, p.pair)}
          onClick={() => onAction({ type: 'toggleHidden', pair: p.pair })}
        >
          {p.pair}
        </button>
      ))}
      <button
        type="button"
        className="chip"
        disabled={!anyHidden}
        onClick={() => onAction({ type: 'showAll' })}
      >
        {t.showAll}
      </button>
    </fieldset>
  );
}
