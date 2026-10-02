import { fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { trackEvent, updateUserPreferences } from './analytics';
import { initialState, reducer } from './state/reducer';
import { initFixture } from './test/fixtures';

vi.mock('./analytics', () => ({ trackEvent: vi.fn(), updateUserPreferences: vi.fn() }));
vi.mock('./hooks/useArbitrageFeed', () => ({
  useArbitrageFeed: () =>
    reducer(
      { ...initialState, connection: 'connected' },
      { type: 'messages', messages: [initFixture()] },
    ),
}));

beforeEach(() => {
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
