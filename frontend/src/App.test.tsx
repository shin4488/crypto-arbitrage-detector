import { fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { trackEvent, updateUserPreferences } from './analytics';
import type { PairSnapshot } from './protocol/types';
import { type FeedState, initialState, reducer } from './state/reducer';
import { bestDirection } from './state/selectors';
import { initFixture, pairFixture } from './test/fixtures';

// 板の更新を模擬できるよう、配信の状態はテストが差し替える
const feed = vi.hoisted(() => ({ state: null as FeedState | null }));

vi.mock('./analytics', () => ({ trackEvent: vi.fn(), updateUserPreferences: vi.fn() }));
vi.mock('./hooks/useArbitrageFeed', () => ({ useArbitrageFeed: () => feed.state }));
// PairBoard は描画のたびに bestDirection(pair) を1回呼ぶので、その呼び出しでカードの描画を数える
vi.mock('./state/selectors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./state/selectors')>();
  return { ...actual, bestDirection: vi.fn(actual.bestDirection) };
});

/** サーバーから1つのペアの板の更新が届いた後の状態にする */
function receivePair(pair: PairSnapshot) {
  const state = feed.state as FeedState;
  feed.state = reducer(state, {
    type: 'messages',
    messages: [{ type: 'pair', seq: state.seq + 1, pair }],
  });
}

function cardRenders(pair: string) {
  return vi.mocked(bestDirection).mock.calls.filter(([p]) => p.pair === pair).length;
}

function card(pair: string) {
  return screen.getByRole('region', { name: pair });
}

function cardOrder() {
  return within(screen.getByRole('main'))
    .getAllByRole('region')
    .map((section) => section.getAttribute('aria-label'));
}

function layoutEvents() {
  return vi.mocked(trackEvent).mock.calls.filter(([name]) => name !== 'dashboard_ready');
}

beforeEach(() => {
  feed.state = reducer(
    { ...initialState, connection: 'connected' },
    { type: 'messages', messages: [initFixture()] },
  );
  localStorage.clear();
  localStorage.setItem('arb.lang', 'ja');
  localStorage.setItem('arb.theme', 'light');
  vi.clearAllMocks();
});

describe('利用状況の計測', () => {
  it('StrictModeでも画面の準備完了を一度だけ計測し、表示設定をユーザー属性に反映する', () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(
      vi.mocked(trackEvent).mock.calls.filter(([name]) => name === 'dashboard_ready'),
    ).toHaveLength(1);
    expect(updateUserPreferences).toHaveBeenCalledWith('ja', 'light');
  });

  it('言語・配色・ペア表示・並び替えの操作を計測し、同じ選択は重複計測しない', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(
      vi.mocked(trackEvent).mock.calls.filter(([name]) => name === 'language_changed'),
    ).toEqual([['language_changed', { ui_language: 'en' }]]);
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(trackEvent).toHaveBeenCalledWith('theme_changed', { ui_theme: 'dark' });
    const group = screen.getByRole('group', { name: /Show pairs/ });
    const pair = within(group).getByRole('button', { name: 'BTC/USDT' });
    fireEvent.click(pair);
    expect(trackEvent).toHaveBeenCalledWith('pair_visibility_changed', {
      pair_symbol: 'BTC/USDT',
      visible: false,
    });
    fireEvent.keyDown(pair, { key: 'ArrowRight' });
    expect(trackEvent).toHaveBeenCalledWith('pair_reordered', {
      pair_symbol: 'BTC/USDT',
      interaction_method: 'keyboard',
    });
  });

  it('取引金額は編集完了だけを計測し、入力値を送信しない', () => {
    render(<App />);
    const amount = screen.getByRole('spinbutton');
    fireEvent.change(amount, { target: { value: '12345.67' } });
    expect(trackEvent).not.toHaveBeenCalledWith('amount_changed');
    fireEvent.blur(amount);
    expect(vi.mocked(trackEvent).mock.calls.filter(([name]) => name === 'amount_changed')).toEqual([
      ['amount_changed'],
    ]);
    expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toContain('12345.67');
  });
});

describe('通貨ペアのカード', () => {
  it('板が更新されたペアのカードだけを描き直す', () => {
    const view = render(<App />);
    const btc = cardRenders('BTC/USDT');
    const eth = cardRenders('ETH/USDT');
    receivePair(pairFixture({ pair: 'ETH/USDT', base: 'ETH' }));
    view.rerender(<App />);
    expect(cardRenders('ETH/USDT')).toBe(eth + 1);
    expect(cardRenders('BTC/USDT')).toBe(btc);
  });

  it('描き直していないカードの操作も、最新のペア一覧と並び順で反映して計測する', () => {
    const view = render(<App />);
    // ETH/USDT のカードは SOL/USDT が届く前に描いたまま描き直されないので、その操作でも追加後のペア一覧を使うかを確かめる
    receivePair(pairFixture({ pair: 'SOL/USDT', base: 'SOL' }));
    view.rerender(<App />);
    const handle = () =>
      within(card('ETH/USDT')).getByRole('button', { name: /ドラッグして並び替え/ });
    fireEvent.keyDown(handle(), { key: 'ArrowDown' });
    expect(cardOrder()).toEqual(['BTC/USDT', 'SOL/USDT', 'ETH/USDT']);
    // 末尾のカードはそれ以上下げられないので、並び順も計測も変わらない
    fireEvent.keyDown(handle(), { key: 'ArrowDown' });
    expect(cardOrder()).toEqual(['BTC/USDT', 'SOL/USDT', 'ETH/USDT']);
    expect(layoutEvents()).toEqual([
      ['pair_reordered', { pair_symbol: 'ETH/USDT', interaction_method: 'keyboard' }],
    ]);
  });

  it('カードのドラッグ・非表示と「すべて表示」を反映して計測する', () => {
    render(<App />);
    fireEvent.dragStart(card('ETH/USDT'));
    fireEvent.dragOver(card('BTC/USDT'));
    fireEvent.drop(card('BTC/USDT'));
    expect(cardOrder()).toEqual(['ETH/USDT', 'BTC/USDT']);
    fireEvent.click(within(card('BTC/USDT')).getByRole('button', { name: 'このペアを隠す' }));
    expect(cardOrder()).toEqual(['ETH/USDT']);
    fireEvent.click(screen.getByRole('button', { name: 'すべて表示' }));
    expect(cardOrder()).toEqual(['ETH/USDT', 'BTC/USDT']);
    expect(layoutEvents()).toEqual([
      ['pair_reordered', { pair_symbol: 'ETH/USDT', interaction_method: 'drag' }],
      ['pair_visibility_changed', { pair_symbol: 'BTC/USDT', visible: false }],
      ['pairs_reset'],
    ]);
  });
});
