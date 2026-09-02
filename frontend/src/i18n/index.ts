import { createContext, useContext } from 'react';
import { en } from './en';
import { ja } from './ja';

export type Lang = 'ja' | 'en';

/** 画面の文言。関数になっているものは数値や名前を埋め込む */
export type Dict = typeof ja;

const dictionaries: Record<Lang, Dict> = { ja, en };

/** ブラウザの言語設定から表示言語を決める。日本語以外は英語 */
export function detectLang(language: string = navigator.language): Lang {
  return language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function getDict(lang: Lang): Dict {
  return dictionaries[lang];
}

export const LangContext = createContext<Lang>('ja');

/** 現在の言語の文言を返す */
export function useT(): Dict {
  return getDict(useContext(LangContext));
}

export function useLang(): Lang {
  return useContext(LangContext);
}
