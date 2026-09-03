/**
 * 取引所ごとの公表手数料の情報（画面の説明用）。
 * 計算に使う手数料率はサーバーの設定から届くので、ここは「その根拠」を示すための静的な情報。
 * 手数料表が変わったらここを更新する（2026年9月時点）。
 */
export interface ExchangeFeeInfo {
  /** 公式の手数料ページ */
  url: string;
  /** 公表されている最下位ランクの maker / taker 手数料（現物） */
  maker: string;
  taker: string;
  /** 最下位ランクの呼び名（i18n のキー） */
  tier: 'regular' | 'lv1';
}

export const EXCHANGE_FEE_INFO: Record<string, ExchangeFeeInfo> = {
  binance: {
    url: 'https://www.binance.com/en/fee/trading',
    maker: '0.1%',
    taker: '0.1%',
    tier: 'regular',
  },
  okx: { url: 'https://www.okx.com/fees', maker: '0.08%', taker: '0.1%', tier: 'lv1' },
};
