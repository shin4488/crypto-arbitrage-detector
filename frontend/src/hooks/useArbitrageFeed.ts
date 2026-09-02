import { useEffect, useReducer, useRef } from 'react';
import { log } from '../log';
import { parseServerMessage } from '../protocol/parse';
import type { ServerMessage } from '../protocol/types';
import { type FeedState, initialState, reducer } from '../state/reducer';
import { createWsClient } from '../ws/client';

export interface FeedOptions {
  /** テストで差し替えるための WebSocket 実装 */
  WebSocketImpl?: typeof WebSocket;
}

/**
 * バックエンドに接続し、受信したメッセージを画面用の状態に反映する。
 * 板の更新は秒間数十件届くため、1フレーム分をまとめて1回の再描画にする。
 */
export function useArbitrageFeed(url: string, options: FeedOptions = {}): FeedState {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pending = useRef<ServerMessage[]>([]);
  const flushScheduled = useRef(false);

  useEffect(() => {
    let active = true;

    function flush(): void {
      flushScheduled.current = false;
      if (!active || pending.current.length === 0) {
        return;
      }
      const messages = pending.current;
      pending.current = [];
      dispatch({ type: 'messages', messages });
    }

    function scheduleFlush(): void {
      if (flushScheduled.current) {
        return;
      }
      flushScheduled.current = true;
      // 画面の描画タイミングに合わせてまとめる。バックグラウンドタブでは rAF が止まるので setTimeout で補う
      if (typeof requestAnimationFrame === 'function' && document.visibilityState === 'visible') {
        requestAnimationFrame(flush);
      } else {
        setTimeout(flush, 100);
      }
    }

    const client = createWsClient({
      url,
      ...(options.WebSocketImpl ? { WebSocketImpl: options.WebSocketImpl } : {}),
      onStatus: (status) => {
        if (active) {
          dispatch({ type: 'connection', status });
        }
      },
      onMessage: (raw) => {
        try {
          pending.current.push(parseServerMessage(raw));
        } catch (err) {
          log.warn('サーバーからのメッセージを解釈できません', err);
          return;
        }
        scheduleFlush();
      },
    });

    return () => {
      active = false;
      pending.current = [];
      client.close();
    };
  }, [url, options.WebSocketImpl]);

  return state;
}
