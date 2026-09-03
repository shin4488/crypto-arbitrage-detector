import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type Lang, LangContext } from '../i18n';
import { emptyLayout, type PairLayout } from '../state/layout';
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
  {
    lang = 'ja' as Lang,
    amount = '100',
    onLangChange = vi.fn(),
    onAmountChange = vi.fn(),
    layout = emptyLayout as PairLayout,
    onLayoutAction = vi.fn(),
  } = {},
) {
  render(
    <LangContext.Provider value={lang}>
      <Dashboard
        state={state}
        lang={lang}
        onLangChange={onLangChange}
        amountInput={amount}
        amount={amount}
        onAmountChange={onAmountChange}
        layout={layout}
        onLayoutAction={onLayoutAction}
      />
    </LangContext.Provider>,
  );
  return { onLangChange, onAmountChange, onLayoutAction };
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

  it('利益が出ないときは、まとめの帯を出さない（各ペアの「利益なし」で足りる）', () => {
    renderDashboard(initialized);
    expect(document.querySelector('section.summary')).toBeNull();
  });

  it('機会があれば最初にペア・方向・利益を並べる', () => {
    renderDashboard(withOpportunity);
    const summary = document.querySelector('section.summary');
    expect(summary?.className).toContain('summary--profitable');
    expect(summary).toHaveTextContent('BTC/USDT');
    expect(summary).toHaveTextContent('OKXで買い → Binanceで売り');
    expect(summary).toHaveTextContent('+0.2397 USDT');
  });

  it('利益が出ないペアは、取引金額ぶんの「価格差 − 手数料 ＝ 差引」を式で示す', () => {
    renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(within(btc).getByText('利益なし')).toBeTruthy();
    expect(within(btc).getByText('Binanceで買い').closest('strong')).toHaveTextContent(
      'Binanceで買い → OKXで売り',
    );
    // 100 USDT ÷ 買値 65433.8 = 0.00152826 BTC。価格差 +3.04 × 数量 = +0.0046、手数料 0.2、差引 −0.1954
    expect(within(btc).getByText('+0.0046')).toBeTruthy();
    expect(within(btc).getByText('0.2')).toBeTruthy();
    expect(within(btc).getByText('-0.1954')).toBeTruthy();
    expect(within(btc).getByText('0.00152826 BTC ≈ 100 USDT')).toBeTruthy();
    expect(within(btc).queryByText(/板で利益が出るのは/)).toBeNull();
  });

  it('利益が出るペアは、板で利益が出る量までで計算し、その旨を添える', () => {
    renderDashboard(withOpportunity);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(btc.className).toContain('card--profitable');
    expect(within(btc).getByText('利益あり')).toBeTruthy();
    expect(within(btc).getByText('OKXで買い').closest('strong')).toHaveTextContent(
      'OKXで買い → Binanceで売り',
    );
    // 100 USDT は 1 BTC ぶんだが、板で利益が出るのは 0.3 BTC まで → サーバーの計算値
    expect(within(btc).getByText('+0.3')).toBeTruthy();
    expect(within(btc).getByText('0.0603')).toBeTruthy();
    expect(within(btc).getByText('+0.2397')).toBeTruthy();
    expect(within(btc).getByText('0.3 BTC ≈ 30 USDT')).toBeTruthy();
    expect(within(btc).getByText(/板で利益が出るのは 0.3 BTC（約 30 USDT）まで/)).toBeTruthy();
    expect(within(btc).getByText(/取得済みの板の範囲での値/)).toBeTruthy();
  });

  it('取引金額を小さくすると、その金額ぶんの数量で計算する', () => {
    renderDashboard(withOpportunity, { amount: '20' });
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    // 20 USDT ÷ 買値 100 = 0.2 BTC。差引 0.799 × 0.2 = 0.1598
    expect(within(btc).getByText('0.2 BTC ≈ 20 USDT')).toBeTruthy();
    expect(within(btc).getByText('+0.1598')).toBeTruthy();
    expect(within(btc).queryByText(/板で利益が出るのは/)).toBeNull();
  });

  it('取引金額の入力を変えると通知される', () => {
    const { onAmountChange } = renderDashboard(initialized);
    const input = screen.getByRole('spinbutton', { name: /取引金額/ });
    fireEvent.change(input, { target: { value: '500' } });
    expect(onAmountChange).toHaveBeenCalledWith('500');
  });

  it('各取引所の買値・売値を「買って売る」の順に並べ、有利な方向で使う価格に色を付ける', () => {
    renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    const headers = within(btc)
      .getAllByRole('columnheader')
      .map((th) => th.textContent);
    expect(headers).toEqual(['取引所', '買値 (ask)', '売値 (bid)', '更新']);
    // より有利なのは Binance で買い → OKX で売り: Binance の買値と OKX の売値に色が付く
    const buyCell = within(btc).getByText('65,433.8').closest('td');
    const sellCell = within(btc).getByText('65,436.84').closest('td');
    expect(buyCell?.className).toContain('pick--buy');
    expect(within(buyCell as HTMLElement).getByText('買')).toBeTruthy();
    expect(sellCell?.className).toContain('pick--sell');
    expect(within(sellCell as HTMLElement).getByText('売')).toBeTruthy();
    // 使わない価格には色を付けない
    expect(within(btc).getByText('65,433.79').closest('td')?.className).not.toContain('pick');
    expect(within(btc).getByText('65,436.85').closest('td')?.className).not.toContain('pick');
  });

  it('板に並ぶ数量や逆方向の値は出さない（判断に使わないため）', () => {
    renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(btc.querySelector('details')).toBeNull();
    expect(within(btc).queryByText('0.52 BTC')).toBeNull();
    expect(within(btc).queryByText('OKXで買い')).toBeNull();
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
    // 最大純利益 1.5（0.3 BTC、平均買値 100）。100 USDT ぶんは 0.3 BTC で頭打ちなので +1.5 のまま
    expect(rows[0]).toHaveTextContent('+1.5 USDT');
    expect(rows[0]).toHaveTextContent('2.5秒');
    expect(rows[1]).toHaveTextContent('継続中');
    expect(rows[1]).toHaveTextContent('OKXで買い → Binanceで売り (0.3 BTC)');
  });

  it('履歴が無ければその旨を表示する', () => {
    renderDashboard({ ...initialized, history: [] });
    expect(screen.getByText('検知はまだありません')).toBeTruthy();
  });

  it('手数料の設定を最後に添え、ⓘ で根拠と公式ページへのリンクを出す', () => {
    renderDashboard(initialized);
    expect(screen.getByText(/手数料: Binance 0.1%・OKX 0.1%（taker）/)).toBeTruthy();
    const button = screen.getByRole('button', { name: '手数料について' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const popover = screen.getByRole('tooltip');
    expect(popover).toHaveTextContent('Binance: 一般ユーザー maker 0.1% / taker 0.1%');
    expect(popover).toHaveTextContent('OKX: Lv1 maker 0.08% / taker 0.1%');
    expect(popover).toHaveTextContent('手数料はランク');
    const links = within(popover).getAllByRole('link', { name: '公式の手数料ページ' });
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://www.binance.com/en/fee/trading',
      'https://www.okx.com/fees',
    ]);
    expect(links[0]?.getAttribute('rel')).toBe('noopener noreferrer');
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
    expect(screen.getByRole('status')).toHaveTextContent('Connected to Binance・OKX');
    expect(screen.getByRole('group', { name: 'Language' })).toBeTruthy();
  });
  it('カードの並び替え・折りたたみのボタンで操作を通知する', () => {
    const { onLayoutAction } = renderDashboard(initialized);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    const eth = screen.getByRole('region', { name: 'ETH/USDT' });
    // 先頭は上へ動かせず、末尾は下へ動かせない
    expect((within(btc).getByRole('button', { name: '上へ' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((within(eth).getByRole('button', { name: '下へ' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(within(btc).getByRole('button', { name: '下へ' }));
    expect(onLayoutAction).toHaveBeenCalledWith('BTC/USDT', 'moveDown');
    fireEvent.click(within(btc).getByRole('button', { name: '折りたたむ' }));
    expect(onLayoutAction).toHaveBeenCalledWith('BTC/USDT', 'toggleCollapsed');
  });

  it('保存した並び順で表示し、折りたたんだカードは見出しだけにする', () => {
    renderDashboard(initialized, {
      layout: { order: ['ETH/USDT', 'BTC/USDT'], collapsed: ['BTC/USDT'] },
    });
    const regions = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(regions.slice(0, 2)).toEqual(['ETH/USDT', 'BTC/USDT']);
    const btc = screen.getByRole('region', { name: 'BTC/USDT' });
    expect(within(btc).getByText('利益なし')).toBeTruthy();
    expect(within(btc).queryByRole('table')).toBeNull();
    expect(within(btc).getByRole('button', { name: '展開する' })).toBeTruthy();
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
