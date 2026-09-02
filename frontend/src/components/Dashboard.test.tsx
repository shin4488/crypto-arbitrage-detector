import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LangContext } from '../i18n';
import { type FeedState, initialState, reducer } from '../state/reducer';
import {
  episodeFixture,
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

describe('Dashboard', () => {
  it('接続前は接続中と表示する', () => {
    renderDashboard(initialState);
    expect(screen.getByRole('status')).toHaveTextContent('接続中');
  });

  it('接続後 init 待ちはデータ待ちと表示する', () => {
    renderDashboard({ ...initialState, connection: 'connected' });
    expect(screen.getByRole('status')).toHaveTextContent('取引所からのデータを待っています');
  });

  it('取引所の名前・接続状態・手数料を表示する', () => {
    renderDashboard(initialized);
    const status = screen.getByLabelText('status');
    expect(status).toHaveTextContent('Binance');
    expect(status).toHaveTextContent('OKX');
    expect(status).toHaveTextContent('接続中');
    expect(status).toHaveTextContent('taker手数料 0.1%');
  });

  it('各ペアの両取引所の気配と両方向の評価を表示する', () => {
    renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(within(btc).getByText('65,433.79')).toBeTruthy();
    expect(within(btc).getByText('65,436.85')).toBeTruthy();
    expect(within(btc).getByText('Binance で買い → OKX で売り')).toBeTruthy();
    expect(within(btc).getByText('OKX で買い → Binance で売り')).toBeTruthy();
    expect(within(btc).getByText('+3.04')).toBeTruthy();
    expect(within(btc).getByText('-3.06')).toBeTruthy();
    expect(within(btc).getByText('機会なし')).toBeTruthy();

    // 板が無いペアは待機表示
    const eth = screen.getByRole('region', { name: 'ETH/USDT' });
    expect(within(eth).getByText('取引所からのデータを待っています…')).toBeTruthy();
    expect(within(eth).getByText('両取引所の板が揃うと評価します')).toBeTruthy();
  });

  it('利益が出る方向は強調し、数量・純利益・詳細を表示する', () => {
    const state: FeedState = {
      ...initialized,
      pairs: [pairFixture({ directions: [profitableDirectionFixture()] })],
    };
    renderDashboard(state);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(btc.className).toContain('board--profitable');
    expect(within(btc).getAllByText('利益あり').length).toBeGreaterThan(0);
    expect(within(btc).getByText('0.3 BTC')).toBeTruthy();
    expect(within(btc).getAllByText('+0.2397 USDT').length).toBeGreaterThan(0);
    expect(within(btc).getByText(/平均買値 100/)).toBeTruthy();
    expect(within(btc).getByText(/受信した板を使い切っている/)).toBeTruthy();
    const row = within(btc).getByText('OKX で買い → Binance で売り').closest('tr');
    expect(row?.className).toContain('is-profitable');
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
    expect(rows[1]).toHaveTextContent('0.3 BTC');
  });

  it('履歴が無ければその旨を表示する', () => {
    renderDashboard({ ...initialized, history: [] });
    expect(screen.getByText('まだ機会は検知されていません')).toBeTruthy();
  });

  it('サーバー切断中はバナーを出し、データは表示し続ける', () => {
    renderDashboard({ ...initialized, connection: 'disconnected' });
    expect(screen.getByRole('status')).toHaveTextContent('切断（再接続中）');
    expect(screen.getByRole('region', { name: 'BTC/USDT' })).toBeTruthy();
  });

  it('タブ通知のトグルを切り替えると通知される', () => {
    const { onChange } = renderDashboard(initialized);
    const checkbox = screen.getByRole('checkbox', { name: 'タブのタイトルで通知' });
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('英語表示に切り替わる', () => {
    render(
      <LangContext.Provider value="en">
        <Dashboard state={initialized} tabNotification={false} onTabNotificationChange={vi.fn()} />
      </LangContext.Provider>,
    );
    expect(screen.getByText('Buy on Binance → sell on OKX')).toBeTruthy();
    expect(screen.getByText('Opportunity history', { exact: false })).toBeTruthy();
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
