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
    expect(screen.getByRole('status')).toHaveTextContent('サーバーに接続しています');
  });

  it('接続後 init 待ちはデータ待ちと表示する', () => {
    renderDashboard({ ...initialState, connection: 'connected' });
    expect(screen.getByText('取引所からの板を待っています…')).toBeTruthy();
  });

  it('正常時は監視中と接続先を1行で示す', () => {
    renderDashboard(initialized);
    expect(screen.getByRole('status')).toHaveTextContent('監視中（Binance・OKX に接続）');
  });

  it('取引所と切断中はその取引所名を示す', () => {
    renderDashboard({
      ...initialized,
      exchanges: [exchangeFixture(), exchangeFixture({ id: 'okx', name: 'OKX', connected: false })],
    });
    expect(screen.getByRole('status')).toHaveTextContent('OKX と切断中です');
  });

  it('サーバー切断中はその旨を示し、データは表示し続ける', () => {
    renderDashboard({ ...initialized, connection: 'disconnected' });
    expect(screen.getByRole('status')).toHaveTextContent('サーバーと切断されました');
    expect(screen.getByRole('region', { name: 'BTC/USDT' })).toBeTruthy();
  });

  it('機会が無ければ最初の1行でそう言う', () => {
    renderDashboard(initialized);
    expect(screen.getByText('今は利益の出る機会がありません')).toBeTruthy();
  });

  it('機会があれば最初にペア・方向・利益を並べる', () => {
    renderDashboard(withOpportunity);
    const summary = document.querySelector('section.summary');
    expect(summary?.className).toContain('summary--profitable');
    expect(summary).toHaveTextContent('BTC/USDT');
    expect(summary).toHaveTextContent('OKX で買い → Binance で売り');
    expect(summary).toHaveTextContent('+0.2397 USDT');
  });

  it('機会が無いペアは、いちばん有利な方向を式で示し、利益までの距離を出す', () => {
    renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(within(btc).getByText('機会なし')).toBeTruthy();
    expect(within(btc).getByText('Binance で買い → OKX で売り')).toBeTruthy();
    expect(within(btc).getByText('いちばん有利')).toBeTruthy();
    // 価格差 +3.04 − 手数料 130.87 = 手数料込み −127.83（USDT / 1 BTC）
    expect(within(btc).getByText('+3.04')).toBeTruthy();
    expect(within(btc).getByText('130.87')).toBeTruthy();
    expect(within(btc).getByText('-127.83')).toBeTruthy();
    expect(within(btc).getByText('あと 127.83 USDT / 1 BTC')).toBeTruthy();
    expect(within(btc).getByText('利益まで')).toBeTruthy();
  });

  it('機会があるペアは、数量と純利益を数字で示す', () => {
    renderDashboard(withOpportunity);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(btc.className).toContain('card--profitable');
    expect(within(btc).getAllByText('利益あり').length).toBeGreaterThan(0);
    expect(within(btc).getByText('OKX で買い → Binance で売り')).toBeTruthy();
    // 数量 0.3 BTC は畳んだ中の「売れる数量」にも同じ値で出るので複数一致でよい
    expect(within(btc).getAllByText('0.3 BTC').length).toBeGreaterThan(0);
    expect(within(btc).getByText('+0.2397 USDT')).toBeTruthy();
    // 価格差 +1 − 手数料 0.2 = 手数料込み +0.8（価格の刻みに合わせて小数2桁）
    expect(within(btc).getByText('+1')).toBeTruthy();
    expect(within(btc).getByText('0.2')).toBeTruthy();
    expect(within(btc).getByText('+0.8')).toBeTruthy();
    expect(within(btc).getByText(/板の受信範囲まで計算/)).toBeTruthy();
  });

  it('各取引所の売れる価格・買える価格を表示する', () => {
    renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(within(btc).getByText('65,433.79')).toBeTruthy();
    expect(within(btc).getByText('65,433.8')).toBeTruthy();
    expect(within(btc).getByText('65,436.85')).toBeTruthy();
    expect(within(btc).getByRole('columnheader', { name: '売れる価格 (bid)' })).toBeTruthy();
  });

  it('数量と逆方向は畳んだ中に表と1行で示し、上と重複させない', () => {
    renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(within(btc).getByText('数量と逆方向')).toBeTruthy();
    expect(within(btc).getByRole('columnheader', { name: '売れる数量' })).toBeTruthy();
    expect(within(btc).getByText('0.52 BTC')).toBeTruthy();
    expect(within(btc).getByText('20段')).toBeTruthy();
    expect(within(btc).getByText('逆方向')).toBeTruthy();
    expect(within(btc).getByText(/OKX で買い → Binance で売り/)).toBeTruthy();
    expect(within(btc).getByText('-133.93')).toBeTruthy();
    // 逆方向の内訳表は出さない（手数料の数字は主役の方向の分だけ）
    expect(within(btc).getAllByText('130.87')).toHaveLength(1);
  });

  it('板が無いペアはデータ待ちと表示する', () => {
    renderDashboard(initialized);
    const eth = screen.getByRole('region', { name: 'ETH/USDT' });
    expect(within(eth).getByText('データ待ち')).toBeTruthy();
    expect(within(eth).getByText('取引所からの板を待っています…')).toBeTruthy();
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
    const history = screen.getByRole('region', { name: '機会の履歴' });
    const rows = within(history).getAllByRole('row').slice(1); // ヘッダーを除く
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('+1.5 USDT');
    expect(rows[0]).toHaveTextContent('2.5秒');
    expect(rows[1]).toHaveTextContent('継続中');
    expect(rows[1]).toHaveTextContent('OKX で買い → Binance で売り (0.3 BTC)');
  });

  it('履歴が無ければその旨を表示する', () => {
    renderDashboard({ ...initialized, history: [] });
    expect(screen.getByText('まだ機会は検知されていません')).toBeTruthy();
  });

  it('手数料の設定を最後に添える', () => {
    renderDashboard(initialized);
    expect(screen.getByText(/手数料: Binance 0.1%・OKX 0.1%（taker）/)).toBeTruthy();
  });

  it('タブ通知のトグルを切り替えると通知される', () => {
    const { onTabNotificationChange } = renderDashboard(initialized);
    fireEvent.click(screen.getByRole('checkbox', { name: 'タブのタイトルで通知' }));
    expect(onTabNotificationChange).toHaveBeenCalledWith(true);
  });

  it('言語を選ぶと通知される', () => {
    const { onLangChange } = renderDashboard(initialized);
    fireEvent.change(screen.getByRole('combobox', { name: '言語' }), { target: { value: 'en' } });
    expect(onLangChange).toHaveBeenCalledWith('en');
  });

  it('英語表示に切り替わる', () => {
    renderDashboard(initialized, { lang: 'en' });
    expect(screen.getByText('No profitable opportunity right now')).toBeTruthy();
    expect(screen.getByRole('status')).toHaveTextContent('Watching (connected to Binance・OKX)');
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeTruthy();
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
