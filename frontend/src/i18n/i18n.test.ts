import { describe, expect, it } from 'vitest';
import { en } from './en';
import { detectLang, getDict } from './index';
import { ja } from './ja';

describe('detectLang', () => {
  it.each([
    ['ja', 'ja'],
    ['ja-JP', 'ja'],
    ['en-US', 'en'],
    ['fr', 'en'],
    ['', 'en'],
  ])('%s → %s', (input, want) => {
    expect(detectLang(input)).toBe(want);
  });
});

describe('dictionaries', () => {
  it('日本語と英語で同じキーを持つ', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
  });

  it('経過時間の表記', () => {
    expect(ja.ago(300)).toBe('0.3秒前');
    expect(ja.duration(12_000)).toBe('12秒');
    expect(ja.duration(65_000)).toBe('1分5秒');
    expect(ja.duration(3_720_000)).toBe('1時間2分');
    expect(ja.duration(-5)).toBe('0.0秒');
    expect(en.ago(300)).toBe('0.3s ago');
    expect(en.duration(65_000)).toBe('1m 5s');
  });

  it('getDict は言語ごとの文言を返す', () => {
    expect(getDict('ja').profitable).toBe('利益あり');
    expect(getDict('en').profitable).toBe('Profitable');
  });
});
