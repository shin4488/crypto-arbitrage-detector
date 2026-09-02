/**
 * アプリ内で唯一 console に触る場所。通常運用で出るログはここを通す想定で、
 * 開発時のデバッグ出力が本番に残らないよう lint（noConsole）で他の場所を検出する。
 */
export const log = {
  warn(message: string, detail?: unknown): void {
    // biome-ignore lint/suspicious/noConsole: 意図した警告出力
    console.warn(message, detail);
  },
};
