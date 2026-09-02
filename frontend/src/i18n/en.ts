import type { Dict } from './index';

export const en: Dict = {
  appTitle: 'Crypto Arbitrage Detector',
  appDescription:
    'Finds trades that stay profitable after fees, based on price gaps between exchanges',

  tabTitleNotification: 'Notify in tab title',
  tabTitleNotificationHelp: 'Shows the opportunity in the browser tab title while it is profitable',

  statusConnecting: 'Connecting to the server…',
  statusServerDisconnected: 'Disconnected from the server. Reconnecting…',
  statusExchangeDisconnected: (names: string) =>
    `Disconnected from ${names}. Reconnecting (that exchange is left out until it is back)`,
  statusWatching: (names: string) => `Watching (connected to ${names})`,

  summaryNone: 'No profitable opportunity right now',
  summaryProfitable: (pair: string, buy: string, sell: string, profit: string) =>
    `${pair}: buy on ${buy} → sell on ${sell} for ${profit} profit`,

  waitingForData: 'Waiting for order books from the exchanges…',
  notEvaluable: 'Evaluated once both order books are available',
  badgeProfitable: 'Profitable',
  badgeNone: 'No opportunity',
  badgeWaiting: 'Waiting for data',
  leadProfitable: (buy: string, quantity: string, sell: string) =>
    `Buy ${quantity} on ${buy} and sell on ${sell} for`,
  leadProfit: (profit: string) => `${profit} profit`,
  leadNone: (buy: string, sell: string) =>
    `The best pairing is "buy on ${buy} → sell on ${sell}", but it loses money after fees`,
  perUnit: (base: string) => `per 1 ${base}`,
  rowSpread: 'Price gap',
  rowFees: 'Fees',
  rowNet: 'After fees',
  shortfall: (amount: string, base: string) =>
    `Profitable once the gap widens by another ${amount} / ${base}`,
  depthExhausted: 'The received order book depth was fully used, so more could probably be traded',

  colExchange: 'Exchange',
  colSellPrice: 'Sell at (bid)',
  colBuyPrice: 'Buy at (ask)',
  colUpdated: 'Updated',

  details: 'Details (quantities, depth, the other direction)',
  detailQuantity: (sellQty: string, buyQty: string, levels: number) =>
    `can sell ${sellQty} / can buy ${buyQty} (${levels} levels)`,
  otherDirection: 'The other direction',
  direction: (buy: string, sell: string) => `Buy on ${buy} → sell on ${sell}`,

  historyTitle: 'Opportunity history',
  historyCount: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
  historyEmpty: 'No opportunities detected yet',
  historyHelp:
    'Each entry is a period that stayed profitable after fees (cleared when the server restarts)',
  colTime: 'Time',
  colPair: 'Pair',
  colTrade: 'Trade',
  colMaxNetProfit: 'Max net profit',
  colDuration: 'Duration',
  ongoing: 'Ongoing',

  feeNote: (fees: string) =>
    `Fees are calculated as ${fees} (taker). Profits are theoretical values from order book snapshots`,

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
