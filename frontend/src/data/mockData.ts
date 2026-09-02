export interface ArbitrageData {
  pair: string;
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number;
  sell_price: number;
  amount: number;
  spread: number;
  spread_ratio: number;
  currency: string; // Quote currency (USDT, USDC, etc.)
  _updateTime?: number; // タイムスタンプ（オプショナル）
  no_chance?: boolean; // Indicates no profitable arbitrage opportunity
}

export const initialData: Record<string, ArbitrageData> = {
  'BTC/USDC': {
    pair: 'BTC/USDC',
    buy_exchange: 'Binance',
    sell_exchange: 'OKX',
    buy_price: 65433.79,
    sell_price: 65436.84,
    amount: 0.168,
    spread: 3.05,
    spread_ratio: 0.0,
    currency: 'USDC',
  },
  'BTC/USDT': {
    pair: 'BTC/USDT',
    buy_exchange: 'OKX',
    sell_exchange: 'Coinbase',
    buy_price: 65295.8,
    sell_price: 65303.62,
    amount: 0.321,
    spread: 7.82,
    spread_ratio: 0.0001,
    currency: 'USDT',
  },
  'ETH/USDC': {
    pair: 'ETH/USDC',
    buy_exchange: 'Kraken',
    sell_exchange: 'Binance',
    buy_price: 3431.63,
    sell_price: 3435.01,
    amount: 0.7,
    spread: 3.38,
    spread_ratio: 0.001,
    currency: 'USDC',
  },
  'ETH/USDT': {
    pair: 'ETH/USDT',
    buy_exchange: 'OKX',
    sell_exchange: 'Coinbase',
    buy_price: 3432.79,
    sell_price: 3435.42,
    amount: 0.46,
    spread: 2.63,
    spread_ratio: 0.0008,
    currency: 'USDT',
  },
};

export const updatedData: Record<string, ArbitrageData> = {
  'BTC/USDC': {
    pair: 'BTC/USDC',
    buy_exchange: 'Binance',
    sell_exchange: 'OKX',
    buy_price: 65425.5, // 価格変更
    sell_price: 65440.2, // 価格変更
    amount: 0.168,
    spread: 14.7, // スプレッド変更
    spread_ratio: 0.0002,
    currency: 'USDC',
  },
  'BTC/USDT': {
    pair: 'BTC/USDT',
    buy_exchange: 'OKX',
    sell_exchange: 'Coinbase',
    buy_price: 65310.15, // 価格変更
    sell_price: 65303.62, // 変更なし
    amount: 0.321,
    spread: -6.53, // スプレッド変更（負の値）
    spread_ratio: -0.0001,
    currency: 'USDT',
  },
  'ETH/USDC': {
    pair: 'ETH/USDC',
    buy_exchange: 'Kraken',
    sell_exchange: 'Binance',
    buy_price: 3431.63, // 変更なし
    sell_price: 3441.88, // 価格変更
    amount: 0.7,
    spread: 10.25, // スプレッド変更
    spread_ratio: 0.003,
    currency: 'USDC',
  },
  'ETH/USDT': {
    pair: 'ETH/USDT',
    buy_exchange: 'OKX',
    sell_exchange: 'Coinbase',
    buy_price: 3428.95, // 価格変更
    sell_price: 3438.77, // 価格変更
    amount: 0.46,
    spread: 9.82, // スプレッド変更
    spread_ratio: 0.0029,
    currency: 'USDT',
  },
};

// 後方互換性のためのエイリアス
export const demoData = initialData;

// Mock data for development and testing
export const mockArbitrageData: Record<string, ArbitrageData> = {
  'BTC/USDT': {
    pair: 'BTC/USDT',
    buy_exchange: 'Binance',
    sell_exchange: 'OKX',
    buy_price: 43250.0,
    sell_price: 43285.5,
    amount: 0.5,
    spread: 17.75,
    spread_ratio: 0.00041,
    currency: 'USDT',
  },
  'ETH/USDT': {
    pair: 'ETH/USDT',
    buy_exchange: 'OKX',
    sell_exchange: 'Binance',
    buy_price: 2680.25,
    sell_price: 2685.8,
    amount: 2.0,
    spread: 11.1,
    spread_ratio: 0.00041,
    currency: 'USDT',
  },
};
