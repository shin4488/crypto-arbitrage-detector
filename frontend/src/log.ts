/**
 * アプリの中で console を使うのはここだけ。ほかの場所で console を使うと lint（noConsole）が警告するので、
 * 開発中のデバッグ出力が残らない。
 */
export const log = {
  warn(message: string, detail?: unknown): void {
    // biome-ignore lint/suspicious/noConsole: 意図した警告出力
    console.warn(message, detail);
  },
};
