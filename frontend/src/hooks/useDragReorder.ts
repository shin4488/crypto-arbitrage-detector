import { type DragEvent, useMemo, useRef, useState } from 'react';

/** つかむ・重ねる・落とす・離す。要素の種類（カード、チップ）によらず同じ操作 */
export interface DragHandlers {
  start: (pair: string) => void;
  over: (pair: string) => void;
  drop: (target: string) => void;
  end: () => void;
}

export interface DragReorder {
  /** つかんでいるペア */
  dragging: string | null;
  /** 落とせる位置として示しているペア */
  dropTarget: string | null;
  handlers: DragHandlers;
}

/**
 * ドラッグ＆ドロップで並び替えるときの途中経過。落とした時点で onMove を呼び、並び順の変更は呼び出し側に任せる。
 * カードとチップは同じ並び順を動かすので、1つの状態を共有する（チップをカードに落としても並び替えられる）。
 * handlers は作り直さない（カードの memo を効かせるため）。最新の値は ref で参照する。
 */
export function useDragReorder(onMove: (pair: string, target: string) => void): DragReorder {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const handlers = useMemo<DragHandlers>(() => {
    const end = () => {
      draggingRef.current = null;
      setDragging(null);
      setDropTarget(null);
    };
    return {
      start: (pair) => {
        draggingRef.current = pair;
        setDragging(pair);
      },
      over: (pair) => setDropTarget(pair),
      drop: (target) => {
        const pair = draggingRef.current;
        if (pair !== null && pair !== target) {
          onMoveRef.current(pair, target);
        }
        end();
      },
      end,
    };
  }, []);

  return { dragging, dropTarget, handlers };
}

/**
 * 要素に付ける DOM のイベント処理。
 * dataTransfer はブラウザでは必ずあるが、テスト環境（jsdom）では無いので存在を確かめてから使う。
 */
export function dragEvents(handlers: DragHandlers, pair: string) {
  return {
    onDragStart: (e: DragEvent<HTMLElement>) => {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', pair);
      }
      handlers.start(pair);
    },
    onDragOver: (e: DragEvent<HTMLElement>) => {
      e.preventDefault(); // preventDefault しないと drop が発火しない
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
      handlers.over(pair);
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      handlers.drop(pair);
    },
    onDragEnd: handlers.end,
  };
}
