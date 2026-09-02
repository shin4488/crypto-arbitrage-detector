import type { Dict } from './index';

export const en: Dict = {
  appTitle: 'Crypto Arbitrage Detector',
  appDescription:
    'Compares order books across exchanges and detects arbitrage opportunities that are profitable after fees',

  server: 'Server',
  serverConnecting: 'Connecting…',
  serverConnected: 'Connected',
  serverDisconnected: 'Disconnected (reconnecting)',
  waitingForData: 'Waiting for exchange data…',

  exchangeConnected: 'Connected',
  exchangeDisconnected: 'Disconnected',
  takerFee: 'taker fee',
  levels: (n: number) => `${n} levels`,

  tabTitleNotification: 'Notify in tab title',
  tabTitleNotificationHelp: 'Shows the opportunity in the browser tab title while it is profitable',

  colExchange: 'Exchange',
  colBid: 'Bid',
  colAsk: 'Ask',
  colUpdated: 'Updated',
  colDirection: 'Direction',
  colGrossSpread: 'Spread / unit',
  colNetSpread: 'After fees / unit',
  colQuantity: 'Quantity',
  colNetProfit: 'Net profit',
  priceAndQuantity: 'price (quantity)',

  direction: (buy: string, sell: string) => `Buy on ${buy} → sell on ${sell}`,
  profitable: 'Profitable',
  noOpportunity: 'No opportunity',
  notEvaluable: 'Evaluated once both order books are available',
  avgBuyPrice: 'Avg. buy price',
  avgSellPrice: 'Avg. sell price',
  grossProfit: 'Profit before fees',
  fees: 'Fees',
  depthExhausted:
    'The received order book depth was fully used, so the real opportunity may be larger',

  historyTitle: 'Opportunity history',
  historyCount: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
  historyEmpty: 'No opportunities detected yet',
  historyHelp:
    'Each entry is a period during which net profit after fees stayed positive (cleared on server restart)',
  colStarted: 'Started',
  colPair: 'Pair',
  colDuration: 'Duration',
  colMaxNetProfit: 'Max net profit',
  colQuantityAtMax: 'Quantity (at max)',
  ongoing: 'Ongoing',

  ago: (ms: number) => `${formatDurationEn(ms)} ago`,
  duration: (ms: number) => formatDurationEn(ms),
};

function formatDurationEn(ms: number): string {
  if (ms < 0) {
    ms = 0;
  }
  const sec = ms / 1000;
  if (sec < 10) {
    return `${sec.toFixed(1)}s`;
  }
  if (sec < 60) {
    return `${Math.floor(sec)}s`;
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m ${Math.floor(sec % 60)}s`;
  }
  const hour = Math.floor(min / 60);
  return `${hour}h ${min % 60}m`;
}
