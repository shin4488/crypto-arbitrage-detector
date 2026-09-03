import type { ServerMessage } from './types';

/**
 * 受信した JSON 文字列をサーバーメッセージとして解釈する。
 * 通信相手は自前のバックエンドなので深い検証はせず、種別と主要フィールドの有無だけを確認して
 * 壊れたメッセージで画面全体が落ちるのを防ぐ。形式が不正なら Error を投げる。
 */
export function parseServerMessage(raw: string): ServerMessage {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (cause) {
    throw new Error('JSON として解釈できません', { cause });
  }
  if (!isRecord(data) || typeof data.type !== 'string' || typeof data.seq !== 'number') {
    throw new Error('type または seq がありません');
  }
  switch (data.type) {
    case 'init':
      requireArray(data, 'exchanges');
      requireArray(data, 'pairs');
      requireArray(data, 'history');
      return data as unknown as ServerMessage;
    case 'pair':
      requireObject(data, 'pair');
      return data as unknown as ServerMessage;
    case 'episode':
      requireObject(data, 'episode');
      return data as unknown as ServerMessage;
    case 'exchange':
      requireObject(data, 'exchange');
      return data as unknown as ServerMessage;
    default:
      throw new Error(`未知のメッセージ種別です: ${data.type}`);
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function requireArray(data: Record<string, unknown>, key: string): void {
  if (!Array.isArray(data[key])) {
    throw new Error(`${key} が配列ではありません`);
  }
}

function requireObject(data: Record<string, unknown>, key: string): void {
  if (!isRecord(data[key])) {
    throw new Error(`${key} がオブジェクトではありません`);
  }
}
