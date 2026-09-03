import type { KeyboardEvent } from 'react';
import { type DragReorder, dragEvents } from '../hooks/useDragReorder';
import { useT } from '../i18n';
import { isHidden, type LayoutAction, type PairLayout } from '../state/layout';

interface PairFilterProps {
  /** 表示順に並んだ全ペア（隠しているものも含む） */
  pairs: { pair: string }[];
  layout: PairLayout;
  onAction: (action: LayoutAction) => void;
  /** 並び替えのドラッグ操作（カードと共有） */
  drag: DragReorder;
}

/**
 * 表示するペアを選ぶチップの列。押し込まれているペアだけカードが出る。
 * 隠したペアもここに残るので、何を隠しているかと戻し方が同じ場所で分かる。
 * チップをドラッグすると並び替えられる（横に並ぶので ←→ キーでも動かせる）。カードと同じ並び順を動かす。
 * fieldset にしているのは、支援技術に「表示するペア」という一つのまとまりとして伝えるため。
 */
export function PairFilter({ pairs, layout, onAction, drag }: PairFilterProps) {
  const t = useT();
  const anyHidden = pairs.some((p) => isHidden(layout, p.pair));
  const handleKey = (pair: string) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onAction({ type: 'moveBy', pair, delta: e.key === 'ArrowLeft' ? -1 : 1 });
    }
  };
  return (
    <fieldset className="pair-filter">
      <legend>{t.showPairs}:</legend>
      {pairs.map((p) => (
        <button
          key={p.pair}
          type="button"
          className={`chip ${drag.dragging === p.pair ? 'is-dragging' : ''} ${drag.dropTarget === p.pair && drag.dragging !== p.pair ? 'is-drop-target' : ''}`}
          aria-pressed={!isHidden(layout, p.pair)}
          title={t.dragChipToReorder}
          draggable
          onClick={() => onAction({ type: 'toggleHidden', pair: p.pair })}
          onKeyDown={handleKey(p.pair)}
          {...dragEvents(drag.handlers, p.pair)}
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
