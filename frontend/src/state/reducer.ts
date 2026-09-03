import type { Episode, ExchangeInfo, PairSnapshot, ServerMessage } from '../protocol/types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface FeedState {
  /** バックエンドとの WebSocket 接続状態 */
  connection: ConnectionStatus;
  /** init を受信済みか（未受信なら表示するデータが無い） */
  initialized: boolean;
  /** 最後に適用したメッセージの通し番号 */
  seq: number;
  exchanges: ExchangeInfo[];
  pairs: PairSnapshot[];
  /** 機会の履歴（新しい順） */
  history: Episode[];
}

export type Action =
  | { type: 'connection'; status: ConnectionStatus }
  | { type: 'messages'; messages: ServerMessage[] };

/** 画面に保持する履歴の上限。バックエンド側の上限と揃えている */
export const HISTORY_LIMIT = 200;

export const initialState: FeedState = {
  connection: 'connecting',
  initialized: false,
  seq: 0,
  exchanges: [],
  pairs: [],
  history: [],
};

export function reducer(state: FeedState, action: Action): FeedState {
  switch (action.type) {
    case 'connection':
      return state.connection === action.status ? state : { ...state, connection: action.status };
    case 'messages':
      return action.messages.reduce(applyMessage, state);
  }
}

function applyMessage(state: FeedState, msg: ServerMessage): FeedState {
  if (msg.type === 'init') {
    return {
      ...state,
      initialized: true,
      seq: msg.seq,
      exchanges: msg.exchanges,
      pairs: msg.pairs,
      history: sortHistory(msg.history).slice(0, HISTORY_LIMIT),
    };
  }
  // 再接続時など、既に反映済みの古いメッセージは無視する（サーバー側でも除外しているが二重に守る）
  if (msg.seq <= state.seq) {
    return state;
  }
  switch (msg.type) {
    case 'pair':
      return { ...state, seq: msg.seq, pairs: replacePair(state.pairs, msg.pair) };
    case 'episode':
      return { ...state, seq: msg.seq, history: upsertEpisode(state.history, msg.episode) };
    case 'exchange':
      return {
        ...state,
        seq: msg.seq,
        exchanges: state.exchanges.map((ex) =>
          ex.id === msg.exchange.id
            ? { ...ex, connected: msg.exchange.connected, since: msg.exchange.since }
            : ex,
        ),
      };
  }
}

/** 更新されたペアだけ差し替える（他のペアはオブジェクトを保ち、React の再描画を最小限にする） */
function replacePair(pairs: PairSnapshot[], updated: PairSnapshot): PairSnapshot[] {
  const index = pairs.findIndex((p) => p.pair === updated.pair);
  if (index === -1) {
    return [...pairs, updated];
  }
  const next = pairs.slice();
  next[index] = updated;
  return next;
}

function upsertEpisode(history: Episode[], episode: Episode): Episode[] {
  const index = history.findIndex((e) => e.id === episode.id);
  if (index !== -1) {
    const next = history.slice();
    next[index] = episode;
    return next;
  }
  return sortHistory([episode, ...history]).slice(0, HISTORY_LIMIT);
}

/** 開始が新しい順（同時なら id が大きい順） */
function sortHistory(history: Episode[]): Episode[] {
  return history.slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id - a.id);
}
