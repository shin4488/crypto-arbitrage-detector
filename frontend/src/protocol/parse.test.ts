import { describe, expect, it } from 'vitest';
import { parseServerMessage } from './parse';

describe('parseServerMessage', () => {
  it('init メッセージを解釈できる', () => {
    const msg = parseServerMessage(
      JSON.stringify({ type: 'init', seq: 1, exchanges: [], pairs: [], history: [] }),
    );
    expect(msg.type).toBe('init');
    expect(msg.seq).toBe(1);
  });

  it('pair / episode / exchange メッセージを解釈できる', () => {
    expect(parseServerMessage('{"type":"pair","seq":2,"pair":{}}').type).toBe('pair');
    expect(parseServerMessage('{"type":"episode","seq":3,"episode":{}}').type).toBe('episode');
    expect(parseServerMessage('{"type":"exchange","seq":4,"exchange":{}}').type).toBe('exchange');
  });

  it.each([
    ['JSON でない', 'not json'],
    ['配列', '[]'],
    ['type がない', '{"seq":1}'],
    ['seq がない', '{"type":"pair","pair":{}}'],
    ['未知の種別', '{"type":"hello","seq":1}'],
    ['init に pairs がない', '{"type":"init","seq":1,"exchanges":[],"history":[]}'],
    ['pair が配列', '{"type":"pair","seq":1,"pair":[]}'],
  ])('不正なメッセージはエラーになる: %s', (_name, raw) => {
    expect(() => parseServerMessage(raw)).toThrow();
  });
});
