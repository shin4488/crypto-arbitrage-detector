import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeWebSocket, FakeWebSocketImpl } from '../test/fakeWebSocket';
import { createWsClient } from './client';

describe('createWsClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.reset();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // ジッタを固定（×1.0）
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const onMessage = vi.fn();
    const onStatus = vi.fn();
    const client = createWsClient({
      url: 'ws://example/ws',
      onMessage,
      onStatus,
      minBackoffMs: 100,
      maxBackoffMs: 400,
      WebSocketImpl: FakeWebSocketImpl,
    });
    return { client, onMessage, onStatus };
  }

  it('接続して受信したメッセージを渡す', () => {
    const { onMessage, onStatus } = setup();
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.latest().url).toBe('ws://example/ws');
    expect(onStatus).toHaveBeenLastCalledWith('connecting');

    FakeWebSocket.latest().simulateOpen();
    expect(onStatus).toHaveBeenLastCalledWith('connected');

    FakeWebSocket.latest().simulateMessage('{"type":"init"}');
    expect(onMessage).toHaveBeenCalledWith('{"type":"init"}');
  });

  it('切断されたら待ち時間を倍にしながら再接続する', () => {
    const { onStatus } = setup();
    FakeWebSocket.latest().simulateOpen();
    FakeWebSocket.latest().simulateClose();
    expect(onStatus).toHaveBeenLastCalledWith('disconnected');

    vi.advanceTimersByTime(99);
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2);

    // 接続に失敗（open せず close）→ 200ms 後に再試行
    FakeWebSocket.latest().simulateClose();
    vi.advanceTimersByTime(199);
    expect(FakeWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(3);

    // 400ms（上限）→ 以降も 400ms
    FakeWebSocket.latest().simulateClose();
    vi.advanceTimersByTime(400);
    expect(FakeWebSocket.instances).toHaveLength(4);
    FakeWebSocket.latest().simulateClose();
    vi.advanceTimersByTime(400);
    expect(FakeWebSocket.instances).toHaveLength(5);
  });

  it('接続に成功したら待ち時間は最小に戻る', () => {
    setup();
    FakeWebSocket.latest().simulateClose();
    vi.advanceTimersByTime(100);
    FakeWebSocket.latest().simulateClose();
    vi.advanceTimersByTime(200);
    FakeWebSocket.latest().simulateOpen(); // 成功
    FakeWebSocket.latest().simulateClose();
    vi.advanceTimersByTime(100);
    expect(FakeWebSocket.instances).toHaveLength(4);
  });

  it('close すると接続を閉じ、再接続しない', () => {
    const { client, onStatus } = setup();
    const ws = FakeWebSocket.latest();
    ws.simulateOpen();
    client.close();
    expect(ws.closeCalled).toBe(true);

    vi.advanceTimersByTime(10_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    // close 後に状態通知は増えない
    expect(onStatus).toHaveBeenLastCalledWith('connected');
  });

  it('再接続待ちの間に close すると再接続を取り消す', () => {
    const { client } = setup();
    FakeWebSocket.latest().simulateClose();
    client.close();
    vi.advanceTimersByTime(10_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
