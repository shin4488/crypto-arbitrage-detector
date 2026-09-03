import type { ConnectionStatus } from '../state/reducer';

export interface WsClientOptions {
  url: string;
  onMessage: (raw: string) => void;
  onStatus: (status: ConnectionStatus) => void;
  /** 再接続の待ち時間（指数的に増える）。既定 1秒〜30秒 */
  minBackoffMs?: number;
  maxBackoffMs?: number;
  /** テストで差し替えるための WebSocket 実装 */
  WebSocketImpl?: typeof WebSocket;
}

export interface WsClient {
  /** 再接続を止めて接続を閉じる */
  close(): void;
}

/**
 * ブラウザ標準の WebSocket に自動再接続を足した薄いラッパー。
 * 切断されるたびに待ち時間を倍にしながら（上限あり、±20% の揺らぎ付き）つなぎ直す。
 * close() は接続の確立を待ってから閉じる。確立前に閉じるとブラウザが警告を出し、Vite の中継も
 * 途中で切られた接続のエラーを残すため（React の StrictMode は開発時に効果を一度余分に実行するので、
 * 画面を開くたびにこれが起きる）。
 */
export function createWsClient(options: WsClientOptions): WsClient {
  const minBackoff = options.minBackoffMs ?? 1000;
  const maxBackoff = options.maxBackoffMs ?? 30_000;
  const Impl = options.WebSocketImpl ?? WebSocket;

  let socket: WebSocket | null = null;
  let backoff = minBackoff;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  function connect(): void {
    if (closed) {
      return;
    }
    options.onStatus('connecting');
    const ws = new Impl(options.url);
    socket = ws;
    ws.onopen = () => {
      backoff = minBackoff;
      options.onStatus('connected');
    };
    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        options.onMessage(event.data);
      }
    };
    ws.onclose = () => {
      if (socket !== ws) {
        return; // 既に別の接続に切り替わっている
      }
      socket = null;
      options.onStatus('disconnected');
      scheduleReconnect();
    };
    // エラー時はブラウザが続けて close を発火するので、ここでは何もしない
    ws.onerror = () => {};
  }

  function scheduleReconnect(): void {
    if (closed || reconnectTimer !== null) {
      return;
    }
    const jitter = 0.8 + Math.random() * 0.4;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, backoff * jitter);
    backoff = Math.min(backoff * 2, maxBackoff);
  }

  connect();

  return {
    close() {
      closed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      const ws = socket;
      socket = null;
      if (!ws) {
        return;
      }
      ws.onmessage = null;
      ws.onclose = null;
      if (ws.readyState === Impl.CONNECTING) {
        // 確立してから閉じる。確立に失敗した場合はブラウザが close を発火して終わる（onclose は外してあるので再接続しない）
        ws.onopen = () => ws.close();
        return;
      }
      ws.close();
    },
  };
}
