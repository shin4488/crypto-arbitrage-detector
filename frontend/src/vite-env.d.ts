/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WebSocket の接続先を上書きする（既定は同一オリジンの /ws） */
  readonly VITE_WS_URL?: string;
}
