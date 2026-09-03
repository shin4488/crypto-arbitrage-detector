import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeWebSocket, FakeWebSocketImpl } from '../test/fakeWebSocket';
import { initFixture, pairFixture } from '../test/fixtures';
import { useArbitrageFeed } from './useArbitrageFeed';

describe('useArbitrageFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.reset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function render() {
    return renderHook(() => useArbitrageFeed('ws://test/ws', { WebSocketImpl: FakeWebSocketImpl }));
  }

  function flushFrame() {
    act(() => {
      vi.advanceTimersByTime(100);
    });
  }

  it('init を受信すると状態が初期化される', () => {
    const { result } = render();
    expect(result.current.connection).toBe('connecting');
    expect(result.current.initialized).toBe(false);

    act(() => FakeWebSocket.latest().simulateOpen());
    expect(result.current.connection).toBe('connected');

    act(() => FakeWebSocket.latest().simulateMessage(JSON.stringify(initFixture())));
    flushFrame();
    expect(result.current.initialized).toBe(true);
    expect(result.current.pairs).toHaveLength(2);
  });

  it('同じフレームに届いた複数の更新をまとめて反映する', () => {
    const { result } = render();
    const init = initFixture();
    act(() => {
      const ws = FakeWebSocket.latest();
      ws.simulateOpen();
      ws.simulateMessage(JSON.stringify(init));
      ws.simulateMessage(
        JSON.stringify({
          type: 'pair',
          seq: init.seq + 1,
          pair: pairFixture({ pair: 'BTC/USDT', updatedAt: '2026-09-02T12:00:01.000Z' }),
        }),
      );
      ws.simulateMessage(
        JSON.stringify({
          type: 'pair',
          seq: init.seq + 2,
          pair: pairFixture({ pair: 'BTC/USDT', updatedAt: '2026-09-02T12:00:02.000Z' }),
        }),
      );
    });
    expect(result.current.initialized).toBe(false); // まだフレームが来ていない
    flushFrame();
    expect(result.current.seq).toBe(init.seq + 2);
    expect(result.current.pairs[0]?.updatedAt).toBe('2026-09-02T12:00:02.000Z');
  });

  it('壊れたメッセージは無視して続行する', () => {
    const { result } = render();
    act(() => {
      const ws = FakeWebSocket.latest();
      ws.simulateOpen();
      ws.simulateMessage('not json');
      ws.simulateMessage(JSON.stringify(initFixture()));
    });
    flushFrame();
    expect(result.current.initialized).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });

  it('切断されると接続状態が変わり、データは保持される', () => {
    const { result } = render();
    act(() => {
      FakeWebSocket.latest().simulateOpen();
      FakeWebSocket.latest().simulateMessage(JSON.stringify(initFixture()));
    });
    flushFrame();
    act(() => FakeWebSocket.latest().simulateClose());
    expect(result.current.connection).toBe('disconnected');
    expect(result.current.pairs).toHaveLength(2);
  });

  it('アンマウントで接続を閉じる', () => {
    const { unmount } = render();
    const ws = FakeWebSocket.latest();
    unmount();
    expect(ws.closeCalled).toBe(true);
  });
});
