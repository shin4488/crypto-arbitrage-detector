import type { Dict } from './index';

export const en: Dict = {
  appTitle: 'Crypto Arbitrage Detector',
  appDescription: 'Detects cross-exchange trades that are profitable after fees',
  language: 'Language',

  tabTitleNotification: 'Notify in tab title',
  tabTitleNotificationHelp: 'Shows the opportunity in the browser tab title while it is profitable',

  statusConnecting: 'Connecting to the server…',
  statusServerDisconnected: 'Disconnected from the server. Reconnecting…',
  statusExchangeDisconnected: (names: string) =>
    `Disconnected from ${names}. Reconnecting (that exchange is left out until it is back)`,
  statusWatching: (names: string) => `Watching (connected to ${names})`,

  summaryNone: 'No profitable opportunity right now',

  waitingForData: 'Waiting for order books from the exchanges…',
  notEvaluable: 'Evaluated once both order books are available',
  badgeProfitable: 'Profitable',
  badgeNone: 'No opportunity',
  badgeWaiting: 'Waiting for data',
  tagBest: 'Best pairing',
  rowSpread: 'Price gap',
  rowFees: 'Fees',
  rowNet: 'After fees',
  perUnit: (base: string, quote: string) => `${quote} / 1 ${base}`,
  quantity: 'Quantity',
  netProfit: 'Net profit',
  gapToProfit: 'Gap to profit',
  gapValue: (amount: string) => `${amount} more`,
  depthExhausted: 'Limited by the received depth (could be more)',

  colExchange: 'Exchange',
  colSellPrice: 'Sell at (bid)',
  colBuyPrice: 'Buy at (ask)',
  colUpdated: 'Updated',

  details: 'Quantities & reverse direction',
  colSellQty: 'Can sell',
  colBuyQty: 'Can buy',
  colLevels: 'Depth',
  levels: (n: number) => `${n} levels`,
  reverse: 'Reverse',
  direction: (buy: string, sell: string) => `Buy on ${buy} → sell on ${sell}`,

  historyTitle: 'Opportunity history',
  historyCount: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
  historyEmpty: 'No opportunities detected yet',
  historyHelp: 'One entry per profitable period. Cleared on restart',
  colTime: 'Time',
  colPair: 'Pair',
  colTrade: 'Trade',
  colMaxNetProfit: 'Max net profit',
  colDuration: 'Duration',
  ongoing: 'Ongoing',

  feeNote: (fees: string) => `Fees: ${fees} (taker)`,
  theoreticalNote: 'Theoretical values from order book snapshots',

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
