import type {
  Direction,
  Episode,
  ExchangeInfo,
  InitMessage,
  PairSnapshot,
  Quote,
} from '../protocol/types';

/** テストで使う代表的なデータ。必要な部分だけ上書きして使う。 */

export function exchangeFixture(overrides: Partial<ExchangeInfo> = {}): ExchangeInfo {
  return {
    id: 'binance',
    name: 'Binance',
    takerFeeRate: '0.001',
    connected: true,
    since: '2026-09-02T12:00:00.000Z',
    ...overrides,
  };
}

export function quoteFixture(overrides: Partial<Quote> = {}): Quote {
  return {
    bid: { price: '65433.79', quantity: '0.52' },
    ask: { price: '65433.8', quantity: '1.2' },
    bidLevels: 20,
    askLevels: 20,
    updatedAt: '2026-09-02T12:00:00.000Z',
    ...overrides,
  };
}

export function directionFixture(overrides: Partial<Direction> = {}): Direction {
  return {
    buyExchange: 'binance',
    sellExchange: 'okx',
    bestAsk: { price: '65433.8', quantity: '1.2' },
    bestBid: { price: '65436.84', quantity: '0.3' },
    grossSpread: '3.04',
    grossSpreadRatio: '0.0000464592',
    netSpread: '-127.83',
    profitable: false,
    quantity: '0',
    buyCost: '0',
    sellProceeds: '0',
    buyFee: '0',
    sellFee: '0',
    grossProfit: '0',
    netProfit: '0',
    avgBuyPrice: '0',
    avgSellPrice: '0',
    depthExhausted: false,
    ...overrides,
  };
}

export function profitableDirectionFixture(overrides: Partial<Direction> = {}): Direction {
  return directionFixture({
    buyExchange: 'okx',
    sellExchange: 'binance',
    bestAsk: { price: '100', quantity: '1' },
    bestBid: { price: '101', quantity: '1' },
    grossSpread: '1',
    grossSpreadRatio: '0.01',
    netSpread: '0.799',
    profitable: true,
    quantity: '0.3',
    buyCost: '30',
    sellProceeds: '30.3',
    buyFee: '0.03',
    sellFee: '0.0303',
    grossProfit: '0.3',
    netProfit: '0.2397',
    avgBuyPrice: '100',
    avgSellPrice: '101',
    depthExhausted: true,
    ...overrides,
  });
}

export function pairFixture(overrides: Partial<PairSnapshot> = {}): PairSnapshot {
  return {
    pair: 'BTC/USDT',
    base: 'BTC',
    quote: 'USDT',
    quotes: {
      binance: quoteFixture(),
      okx: quoteFixture({
        bid: { price: '65436.84', quantity: '0.3' },
        ask: { price: '65436.85', quantity: '0.8' },
        bidLevels: 5,
        askLevels: 5,
      }),
    },
    directions: [
      directionFixture(),
      directionFixture({
        buyExchange: 'okx',
        sellExchange: 'binance',
        bestAsk: { price: '65436.85', quantity: '0.8' },
        bestBid: { price: '65433.79', quantity: '0.52' },
        grossSpread: '-3.06',
        grossSpreadRatio: '-0.0000467',
        netSpread: '-133.93',
      }),
    ],
    updatedAt: '2026-09-02T12:00:00.000Z',
    ...overrides,
  };
}

export function episodeFixture(overrides: Partial<Episode> = {}): Episode {
  return {
    id: 1,
    pair: 'BTC/USDT',
    buyExchange: 'okx',
    sellExchange: 'binance',
    startedAt: '2026-09-02T12:00:00.000Z',
    endedAt: null,
    maxNetProfit: '0.2397',
    maxNetProfitAt: '2026-09-02T12:00:00.500Z',
    quantityAtMax: '0.3',
    avgBuyPriceAtMax: '100',
    avgSellPriceAtMax: '101',
    ...overrides,
  };
}

export function initFixture(overrides: Partial<InitMessage> = {}): InitMessage {
  return {
    type: 'init',
    seq: 10,
    exchanges: [exchangeFixture(), exchangeFixture({ id: 'okx', name: 'OKX' })],
    pairs: [
      pairFixture(),
      pairFixture({
        pair: 'ETH/USDT',
        base: 'ETH',
        quotes: {},
        directions: [],
      }),
    ],
    history: [episodeFixture()],
    ...overrides,
  };
}
