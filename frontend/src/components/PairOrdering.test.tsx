import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePairLayout } from '../hooks/usePairLayout';
import { type Lang, LangContext } from '../i18n';
import { initialState, reducer } from '../state/reducer';
import { initFixture } from '../test/fixtures';
import { Dashboard } from './Dashboard';

const state = reducer(initialState, { type: 'messages', messages: [initFixture()] });

/** 保存を含む実際の操作を、通信に依存せず確認する。 */
function StoredDashboard({ lang = 'ja' }: { lang?: Lang }) {
  const [layout, onLayoutAction] = usePairLayout(state.pairs);
  return (
    <LangContext.Provider value={lang}>
      <Dashboard
        state={state}
        lang={lang}
        onLangChange={vi.fn()}
        theme="light"
        onThemeChange={vi.fn()}
        amountInput="100"
        amount="100"
        onAmountChange={vi.fn()}
        layout={layout}
        onLayoutAction={onLayoutAction}
      />
    </LangContext.Provider>
  );
}

function chipOrder() {
  return within(screen.getByRole('group', { name: /表示するペア/ }))
    .getAllByRole('button')
    .filter((button) => button.hasAttribute('aria-pressed'))
    .map((button) => button.textContent);
}

function cardOrder() {
  return within(screen.getByRole('main'))
    .getAllByRole('region')
    .map((card) => card.getAttribute('aria-label'));
}

afterEach(() => localStorage.clear());

describe('通貨ペアの並べ替え', () => {
  it('チップをドラッグ＆ドロップするとカードも同じ順番になり、開き直しても保存した順番になる', () => {
    const view = render(<StoredDashboard />);
    const filter = screen.getByRole('group', { name: /表示するペア/ });
    expect(within(filter).getByText('ドラッグ＆ドロップで並べ替え')).toBeTruthy();
    const btc = within(filter).getByRole('button', { name: 'BTC/USDT' });
    const eth = within(filter).getByRole('button', { name: 'ETH/USDT' });
    fireEvent.dragStart(eth);
    fireEvent.dragOver(btc);
    fireEvent.drop(btc);
    expect(chipOrder()).toEqual(['ETH/USDT', 'BTC/USDT']);
    expect(cardOrder()).toEqual(['ETH/USDT', 'BTC/USDT']);
    view.unmount();
    render(<StoredDashboard />);
    expect(chipOrder()).toEqual(['ETH/USDT', 'BTC/USDT']);
    expect(cardOrder()).toEqual(['ETH/USDT', 'BTC/USDT']);
  });

  it('隠したペアも並べ替えられ、表示に戻すと指定した位置にカードが出る', () => {
    render(<StoredDashboard />);
    const filter = screen.getByRole('group', { name: /表示するペア/ });
    const eth = within(filter).getByRole('button', { name: 'ETH/USDT' });
    const btc = within(filter).getByRole('button', { name: 'BTC/USDT' });
    fireEvent.click(eth);
    fireEvent.dragStart(eth);
    fireEvent.dragOver(btc);
    fireEvent.drop(btc);
    expect(chipOrder()).toEqual(['ETH/USDT', 'BTC/USDT']);
    expect(cardOrder()).toEqual(['BTC/USDT']);
    expect(
      within(filter).getByRole('button', { name: 'ETH/USDT' }).getAttribute('aria-pressed'),
    ).toBe('false');
    fireEvent.click(within(filter).getByRole('button', { name: 'ETH/USDT' }));
    expect(cardOrder()).toEqual(['ETH/USDT', 'BTC/USDT']);
  });

  it('ドラッグを取り消した場合は順番も表示対象も変わらない', () => {
    render(<StoredDashboard lang="en" />);
    const filter = screen.getByRole('group', { name: /Show pairs/ });
    expect(within(filter).getByText('Drag and drop pairs to reorder')).toBeTruthy();
    const eth = within(filter).getByRole('button', { name: 'ETH/USDT' });
    const btc = within(filter).getByRole('button', { name: 'BTC/USDT' });
    fireEvent.dragStart(eth);
    fireEvent.dragOver(btc);
    fireEvent.dragEnd(eth);
    expect(cardOrder()).toEqual(['BTC/USDT', 'ETH/USDT']);
    expect(eth.getAttribute('aria-pressed')).toBe('true');
    expect(btc.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('arb.pairLayout')).toBeNull();
  });
});
