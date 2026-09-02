// Localization utilities for multi-language support

export type Language = 'en' | 'ja';

export interface Translations {
  // Main title
  title: string;

  // Table headers
  tradingPair: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: string;
  sellPrice: string;
  amount: string;
  profitSpread: string;

  // Status messages
  connecting: string;
  searchingOpportunities: string;
  noArbitrageChance: string;

  // Exchange names
  binance: string;
  okx: string;

  // Common terms
  buy: string;
  sell: string;
  profit: string;
  spread: string;
  amount_unit: string;
}

const translations: Record<Language, Translations> = {
  en: {
    title: 'Crypto Arbitrage Detector',
    tradingPair: 'Trading Pair',
    buyExchange: 'Buy Exchange',
    sellExchange: 'Sell Exchange',
    buyPrice: 'Buy Price',
    sellPrice: 'Sell Price',
    amount: 'Amount',
    profitSpread: 'Profit/Spread',
    connecting: 'Connecting to WebSocket...',
    searchingOpportunities: 'Searching for arbitrage opportunities',
    noArbitrageChance: 'No chance to arbitrage',
    binance: 'Binance',
    okx: 'OKX',
    buy: 'Buy',
    sell: 'Sell',
    profit: 'Profit',
    spread: 'Spread',
    amount_unit: 'Amount',
  },
  ja: {
    title: 'Crypto Arbitrage Detector',
    tradingPair: '取引ペア',
    buyExchange: '買い取引所',
    sellExchange: '売り取引所',
    buyPrice: '買い価格',
    sellPrice: '売り価格',
    amount: '数量',
    profitSpread: '利益/スプレッド',
    connecting: 'WebSocket接続中...',
    searchingOpportunities: 'アービトラージ機会を検索しています',
    noArbitrageChance: 'アービトラージ機会なし',
    binance: 'Binance',
    okx: 'OKX',
    buy: '買い',
    sell: '売り',
    profit: '利益',
    spread: 'スプレッド',
    amount_unit: '数量',
  },
};

// Detect browser language
export const detectLanguage = (): Language => {
  const browserLang = navigator.language.toLowerCase();

  if (browserLang.startsWith('ja')) {
    return 'ja';
  }

  return 'en'; // Default to English
};

// Get translations for current language
export const getTranslations = (lang?: Language): Translations => {
  const language = lang || detectLanguage();
  return translations[language];
};

// Hook for using translations in components
export const useTranslations = (lang?: Language) => {
  return getTranslations(lang);
};
