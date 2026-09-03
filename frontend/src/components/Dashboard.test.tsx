import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type Lang, LangContext } from '../i18n';
import { type FeedState, initialState, reducer } from '../state/reducer';
import {
  episodeFixture,
  exchangeFixture,
  initFixture,
  pairFixture,
  profitableDirectionFixture,
} from '../test/fixtures';
import { Dashboard } from './Dashboard';

function renderDashboard(
  state: FeedState,
  { lang = 'ja' as Lang, onLangChange = vi.fn(), onTabNotificationChange = vi.fn() } = {},
) {
  render(
    <LangContext.Provider value={lang}>
      <Dashboard
        state={state}
        lang={lang}
        onLangChange={onLangChange}
        tabNotification={false}
        onTabNotificationChange={onTabNotificationChange}
      />
    </LangContext.Provider>,
  );
  return { onLangChange, onTabNotificationChange };
}

const initialized = reducer(reducer(initialState, { type: 'connection', status: 'connected' }), {
  type: 'messages',
  messages: [initFixture()],
});

const withOpportunity: FeedState = {
  ...initialized,
  pairs: [
    pairFixture({ directions: [profitableDirectionFixture()] }),
    ...initialized.pairs.slice(1),
  ],
};

describe('Dashboard', () => {
  it('接続前は接続中と表示する', () => {
    renderDashboard(initialState);
    expect(screen.getByRole('status')).toHaveTextContent('サーバーに接続中');
  });

  it('接続後 init 待ちはデータ待ちと表示する', () => {
    renderDashboard({ ...initialState, connection: 'connected' });
    expect(screen.getByText('取引所からのデータを待っています…')).toBeTruthy();
  });

  it('正常時は監視中と接続先を1行で示す', () => {
    renderDashboard(initialized);
    expect(screen.getByRole('status')).toHaveTextContent('Binance・OKXに接続中');
  });

  it('取引所と切断中はその取引所名を示す', () => {
    renderDashboard({
      ...initialized,
      exchanges: [exchangeFixture(), exchangeFixture({ id: 'okx', name: 'OKX', connected: false })],
    });
    expect(screen.getByRole('status')).toHaveTextContent('OKXとの接続が切れました');
  });

  it('サーバー切断中はその旨を示し、データは表示し続ける', () => {
    renderDashboard({ ...initialized, connection: 'disconnected' });
    expect(screen.getByRole('status')).toHaveTextContent('サーバーとの接続が切れました');
    expect(screen.getByRole('region', { name: 'BTC/USDT' })).toBeTruthy();
  });

  it('機会が無ければ最初の1行でそう言う', () => {
    renderDashboard(initialized);
    expect(screen.getByText('現在、利益の出る取引はありません')).toBeTruthy();
  });

  it('機会があれば最初にペア・方向・利益を並べる', () => {
    renderDashboard(withOpportunity);
    const summary = document.querySelector('section.summary');
    expect(summary?.className).toContain('summary--profitable');
    expect(summary).toHaveTextContent('BTC/USDT');
    expect(summary).toHaveTextContent('OKXで買い → Binanceで売り');
    expect(summary).toHaveTextContent('+0.2397 USDT');
  });

  it('利益が出ないペアは、有利な方向を式で示し、利益までの距離を1行で出す', () => {
    renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(within(btc).getByText('利益なし')).toBeTruthy();
    expect(within(btc).getByText('Binanceで買い → OKXで売り')).toBeTruthy();
    expect(within(btc).getByText('有利な方向')).toBeTruthy();
    // 価格差 +3.04 − 手数料 130.87 = 差引 −127.83（USDT / 1 BTC）
    expect(within(btc).getByText('+3.04')).toBeTruthy();
    expect(within(btc).getByText('130.87')).toBeTruthy();
    expect(within(btc).getByText('-127.83')).toBeTruthy();
    expect(within(btc).getByText('利益まであと 127.83 USDT / 1 BTC')).toBeTruthy();
  });

  it('利益が出るペアは、数量と純利益を数字で示す', () => {
    renderDashboard(withOpportunity);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(btc.className).toContain('card--profitable');
    expect(within(btc).getAllByText('利益あり').length).toBeGreaterThan(0);
    expect(within(btc).getByText('OKXで買い → Binanceで売り')).toBeTruthy();
    expect(within(btc).queryByText('有利な方向')).toBeNull();
    expect(within(btc).getByText('0.3 BTC')).toBeTruthy();
    expect(within(btc).getByText('+0.2397 USDT')).toBeTruthy();
    // 価格差 +1 − 手数料 0.2 = 差引 +0.8（価格の刻みに合わせて小数2桁）
    expect(within(btc).getByText('+1')).toBeTruthy();
    expect(within(btc).getByText('0.2')).toBeTruthy();
    expect(within(btc).getByText('+0.8')).toBeTruthy();
    expect(within(btc).getByText(/取得済みの板の範囲での値/)).toBeTruthy();
  });

  it('各取引所の売値・買値を表示する', () => {
    renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(within(btc).getByText('65,433.79')).toBeTruthy();
    expect(within(btc).getByText('65,433.8')).toBeTruthy();
    expect(within(btc).getByText('65,436.85')).toBeTruthy();
    expect(within(btc).getByRole('columnheader', { name: '売値 (bid)' })).toBeTruthy();
  });

  it('板に並ぶ数量や逆方向の値は出さない（判断に使わないため）', () => {
    renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(btc.querySelector('details')).toBeNull();
    expect(within(btc).queryByText('0.52 BTC')).toBeNull();
    expect(within(btc).queryByText(/OKXで買い → Binanceで売り/)).toBeNull();
  });

  it('板が無いペアはデータ待ちと表示する', () => {
    renderDashboard(initialized);
    const eth = screen.getByRole('region', { name: 'ETH/USDT' });
    expect(within(eth).getByText('データ待ち')).toBeTruthy();
    expect(within(eth).getByText('取引所からのデータを待っています…')).toBeTruthy();
  });

  it('履歴を新しい順に表示し、継続中を示す', () => {
    const state: FeedState = {
      ...initialized,
      history: [
        episodeFixture({
          id: 2,
          startedAt: '2026-09-02T12:00:05.000Z',
          endedAt: '2026-09-02T12:00:07.500Z',
          maxNetProfit: '1.5',
        }),
        episodeFixture({ id: 1 }),
      ],
    };
    renderDashboard(state);
    const history = screen.getByRole('region', { name: '検知履歴' });
    const rows = within(history).getAllByRole('row').slice(1); // ヘッダーを除く
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('+1.5 USDT');
    expect(rows[0]).toHaveTextContent('2.5秒');
    expect(rows[1]).toHaveTextContent('継続中');
    expect(rows[1]).toHaveTextContent('OKXで買い → Binanceで売り (0.3 BTC)');
  });

  it('履歴が無ければその旨を表示する', () => {
    renderDashboard({ ...initialized, history: [] });
    expect(screen.getByText('検知はまだありません')).toBeTruthy();
  });

  it('手数料の設定を最後に添える', () => {
    renderDashboard(initialized);
    expect(screen.getByText(/手数料: Binance 0.1%・OKX 0.1%（taker）/)).toBeTruthy();
  });

  it('タブ通知のトグルを切り替えると通知される', () => {
    const { onTabNotificationChange } = renderDashboard(initialized);
    fireEvent.click(screen.getByRole('checkbox', { name: 'タブに通知' }));
    expect(onTabNotificationChange).toHaveBeenCalledWith(true);
  });

  it('言語を選ぶと通知され、選択中の言語が押された状態になる', () => {
    const { onLangChange } = renderDashboard(initialized);
    const group = screen.getByRole('group', { name: '言語' });
    expect(within(group).getByRole('button', { name: '日本語', pressed: true })).toBeTruthy();
    fireEvent.click(within(group).getByRole('button', { name: 'English', pressed: false }));
    expect(onLangChange).toHaveBeenCalledWith('en');
  });

  it('英語表示に切り替わる', () => {
    renderDashboard(initialized, { lang: 'en' });
    expect(screen.getByText('No profitable trade right now')).toBeTruthy();
    expect(screen.getByRole('status')).toHaveTextContent('Connected to Binance・OKX');
    expect(screen.getByRole('group', { name: 'Language' })).toBeTruthy();
  });
});

// toHaveTextContent は jest-dom 無しで使えるよう最小限の実装を用意する
expect.extend({
  toHaveTextContent(received: unknown, expected: string) {
    const text = received instanceof HTMLElement ? (received.textContent ?? '') : '';
    const pass = text.includes(expected);
    return {
      pass,
      message: () =>
        `expected element text ${pass ? 'not ' : ''}to contain "${expected}", got "${text}"`,
    };
  },
});

declare module 'vitest' {
  interface Assertion {
    toHaveTextContent(expected: string): void;
  }
}
