import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LangContext } from '../i18n';
import { type FeedState, initialState, reducer } from '../state/reducer';
import {
  episodeFixture,
  exchangeFixture,
  initFixture,
  pairFixture,
  profitableDirectionFixture,
} from '../test/fixtures';
import { Dashboard } from './Dashboard';

function renderDashboard(state: FeedState, onChange = vi.fn(), tabNotification = false) {
  render(
    <LangContext.Provider value="ja">
      <Dashboard
        state={state}
        tabNotification={tabNotification}
        onTabNotificationChange={onChange}
      />
    </LangContext.Provider>,
  );
  return { onChange };
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
    expect(screen.getByText('今、利益の出る機会はありません')).toBeTruthy();
  });

  it('機会があれば最初の1行でペア・方向・利益を言う', () => {
    renderDashboard(withOpportunity);
    expect(
      screen.getByText('BTC/USDT: OKX で買い → Binance で売り で +0.2397 USDT の利益'),
    ).toBeTruthy();
  });

  it('機会が無いペアは、いちばん有利な方向とその内訳、あとどれだけ差が要るかを示す', () => {
    renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(within(btc).getByText('機会なし')).toBeTruthy();
    expect(
      within(btc).getByText(
        'いちばん有利なのは「Binance で買い → OKX で売り」ですが、手数料を引くと赤字です',
      ),
    ).toBeTruthy();
    // 内訳: 価格差 +3.04、手数料 −130.87、手数料込み −127.83（1 BTC あたり）
    expect(within(btc).getByText('+3.04 USDT')).toBeTruthy();
    // 手数料は「もう一方の方向」の内訳にも同じ値で出るので複数一致でよい
    expect(within(btc).getAllByText('-130.87 USDT').length).toBeGreaterThan(0);
    expect(within(btc).getByText('-127.83 USDT')).toBeTruthy();
    expect(
      within(btc).getByText('あと 127.83 USDT / BTC 価格差が広がれば利益が出ます'),
    ).toBeTruthy();
  });

  it('機会があるペアは、何をいくつ売買していくら儲かるかを言い切る', () => {
    renderDashboard(withOpportunity);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(btc.className).toContain('card--profitable');
    expect(within(btc).getByText('利益あり')).toBeTruthy();
    expect(within(btc).getByText('OKX で 0.3 BTC を買い、Binance で売ると')).toBeTruthy();
    expect(within(btc).getByText('+0.2397 USDT の利益')).toBeTruthy();
    // 内訳: 価格差 +1、手数料 −0.201、手数料込み +0.799（価格の刻みに合わせて小数2桁）
    expect(within(btc).getByText('-0.2 USDT')).toBeTruthy();
    expect(within(btc).getByText('+0.8 USDT')).toBeTruthy();
    expect(within(btc).getByText(/実際にはもっと多く取引できるかもしれません/)).toBeTruthy();
  });

  it('各取引所の売れる価格・買える価格を表示する', () => {
    renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(within(btc).getByText('65,433.79')).toBeTruthy();
    expect(within(btc).getByText('65,433.8')).toBeTruthy();
    expect(within(btc).getByText('65,436.85')).toBeTruthy();
    expect(within(btc).getByRole('columnheader', { name: '売れる価格 (bid)' })).toBeTruthy();
  });

  it('数量・板の深さ・もう一方の方向は詳細に畳む', () => {
    renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(within(btc).getByText('詳細（数量・板の深さ・もう一方の方向）')).toBeTruthy();
    expect(
      within(btc).getByText(/売れる数量 0.52 BTC \/ 買える数量 1.2 BTC（板20段）/),
    ).toBeTruthy();
    expect(within(btc).getByText(/OKX で買い → Binance で売り/)).toBeTruthy();
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
    expect(
      screen.getByText(/手数料は Binance 0.1%・OKX 0.1%（taker）で計算しています/),
    ).toBeTruthy();
  });

  it('タブ通知のトグルを切り替えると通知される', () => {
    const { onChange } = renderDashboard(initialized);
    fireEvent.click(screen.getByRole('checkbox', { name: 'タブのタイトルで通知' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('英語表示に切り替わる', () => {
    render(
      <LangContext.Provider value="en">
        <Dashboard state={initialized} tabNotification={false} onTabNotificationChange={vi.fn()} />
      </LangContext.Provider>,
    );
    expect(screen.getByText('No profitable opportunity right now')).toBeTruthy();
    expect(screen.getByRole('status')).toHaveTextContent('Watching (connected to Binance・OKX)');
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
