import type { Dict } from './index';

export const en: Dict = {
  appTitle: 'Crypto Arbitrage Detector',
  appDescription: 'Finds cross-exchange trades that are still profitable after fees',
  language: 'Language',

  tabTitleNotification: 'Tab alert',
  tabTitleNotificationHelp: 'Also shows the opportunity in the browser tab title while it lasts',

  statusConnecting: 'Connecting to the server…',
  statusServerDisconnected: 'Lost connection to the server. Reconnecting…',
  statusExchangeDisconnected: (names: string) => `Lost connection to ${names}. Reconnecting…`,
  statusWatching: (names: string) => `Connected to ${names}`,

  waitingForData: 'Waiting for exchange data…',
  notEvaluable: 'Evaluated once both exchanges have sent data',
  badgeProfitable: 'Profitable',
  badgeNone: 'Not profitable',
  badgeWaiting: 'Waiting for data',
  bestDirection: 'Better direction',
  rowSpread: 'Price gap',
  rowFees: 'Fees',
  rowNet: 'Net',
  perUnit: (base: string, quote: string) => `${quote} / 1 ${base}`,
  quantity: 'Quantity',
  netProfit: 'Net profit',
  depthExhausted: 'Based on the received order book depth (could be more in reality)',

  colExchange: 'Exchange',
  colSellPrice: 'Sell (bid)',
  colBuyPrice: 'Buy (ask)',
  colUpdated: 'Updated',

  direction: (buy: string, sell: string) => `Buy on ${buy} → sell on ${sell}`,
  buyOn: (exchange: string) => `Buy on ${exchange}`,
  sellOn: (exchange: string) => `Sell on ${exchange}`,
  pickBuy: 'Buy',
  pickSell: 'Sell',

  historyTitle: 'Detections',
  historyCount: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
  historyEmpty: 'Nothing detected yet',
  historyHelp: 'One entry per profitable period (cleared when the server restarts)',
  colTime: 'Time',
  colPair: 'Pair',
  colTrade: 'Trade',
  colMaxNetProfit: 'Max net profit',
  colDuration: 'Duration',
  ongoing: 'Ongoing',

  feeNote: (fees: string) => `Fees: ${fees} (taker)`,
  theoreticalNote: 'Values are theoretical, calculated from order book data',

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
