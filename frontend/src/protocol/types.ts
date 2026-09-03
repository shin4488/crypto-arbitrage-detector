/**
 * バックエンド（backend/internal/wire）が送る JSON メッセージの型。
 * 金額・数量は浮動小数点の誤差を避けるため文字列のまま扱う。時刻は UTC の ISO 8601 文字列。
 */

/** "65433.79" のような10進文字列 */
export type DecimalString = string;

export interface Level {
  price: DecimalString;
  quantity: DecimalString;
}

export interface ExchangeInfo {
  id: string;
  name: string;
  takerFeeRate: DecimalString;
  connected: boolean;
  since: string;
}

export interface Quote {
  bid: Level;
  ask: Level;
  bidLevels: number;
  askLevels: number;
  updatedAt: string;
}

/** 「buyExchange で買って sellExchange で売る」方向の評価結果 */
export interface Direction {
  buyExchange: string;
  sellExchange: string;
  bestAsk: Level;
  bestBid: Level;
  /** 最良気配ベースの1単位あたり価格差（手数料前）。負もあり得る */
  grossSpread: DecimalString;
  grossSpreadRatio: DecimalString;
  /** 最良気配ベースの1単位あたり手数料込み損益。負もあり得る */
  netSpread: DecimalString;
  profitable: boolean;
  quantity: DecimalString;
  buyCost: DecimalString;
  sellProceeds: DecimalString;
  buyFee: DecimalString;
  sellFee: DecimalString;
  grossProfit: DecimalString;
  netProfit: DecimalString;
  avgBuyPrice: DecimalString;
  avgSellPrice: DecimalString;
  /** 受信した板を使い切った（実際の機会はさらに大きい可能性がある） */
  depthExhausted: boolean;
}

export interface PairSnapshot {
  pair: string;
  base: string;
  quote: string;
  quotes: Record<string, Quote>;
  directions: Direction[];
  updatedAt: string;
}

export interface Episode {
  id: number;
  pair: string;
  buyExchange: string;
  sellExchange: string;
  startedAt: string;
  /** null なら継続中 */
  endedAt: string | null;
  maxNetProfit: DecimalString;
  maxNetProfitAt: string;
  quantityAtMax: DecimalString;
  avgBuyPriceAtMax: DecimalString;
  avgSellPriceAtMax: DecimalString;
}

export interface InitMessage {
  type: 'init';
  seq: number;
  exchanges: ExchangeInfo[];
  pairs: PairSnapshot[];
  history: Episode[];
}

export interface PairMessage {
  type: 'pair';
  seq: number;
  pair: PairSnapshot;
}

export interface EpisodeMessage {
  type: 'episode';
  seq: number;
  episode: Episode;
}

export interface ExchangeStatusMessage {
  type: 'exchange';
  seq: number;
  exchange: { id: string; connected: boolean; since: string };
}

export type ServerMessage = InitMessage | PairMessage | EpisodeMessage | ExchangeStatusMessage;
