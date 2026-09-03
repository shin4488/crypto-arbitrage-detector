/** 日本語の文言。キーの一覧はこのファイルが基準で、ほかの言語も同じ形にする */
export const ja = {
  appTitle: 'Crypto Arbitrage Detector',
  appDescription: '取引所間の価格差から、手数料を引いても利益が出る取引を見つけます',
  language: '言語',

  tabTitleNotification: 'タブに通知',
  tabTitleNotificationHelp: '利益が出ている間、ブラウザのタブのタイトルにも表示します',

  // 接続状態（画面上部の1行）
  statusConnecting: 'サーバーに接続中…',
  statusServerDisconnected: 'サーバーとの接続が切れました。再接続中…',
  statusExchangeDisconnected: (names: string) => `${names}との接続が切れました。再接続中…`,
  statusWatching: (names: string) => `${names}に接続中`,

  // 通貨ペアごとの枠
  waitingForData: '取引所からのデータを待っています…',
  notEvaluable: '両取引所のデータがそろい次第、判定します',
  badgeProfitable: '利益あり',
  badgeNone: '利益なし',
  badgeWaiting: 'データ待ち',
  rowSpread: '価格差',
  rowFees: '手数料',
  rowNet: '差引',
  tradeAmount: '取引金額',
  tradeAmountHelp: 'この金額ぶんの売買として、下の価格差・手数料・差引を計算します',
  forAmount: (quantity: string, base: string, cost: string, quote: string) =>
    `${quantity} ${base} ≈ ${cost} ${quote}`,
  capped: (quantity: string, base: string, cost: string, quote: string) =>
    `板で利益が出るのは ${quantity} ${base}（約 ${cost} ${quote}）まで`,
  depthExhausted: '取得済みの板の範囲での値です（実際はもっと多い可能性があります）',

  colExchange: '取引所',
  colSellPrice: '売値 (bid)',
  colBuyPrice: '買値 (ask)',
  colUpdated: '更新',

  direction: (buy: string, sell: string) => `${buy}で買い → ${sell}で売り`,
  buyOn: (exchange: string) => `${exchange}で買い`,
  sellOn: (exchange: string) => `${exchange}で売り`,
  pickBuy: '買',
  pickSell: '売',

  // 履歴
  historyTitle: '検知履歴',
  historyCount: (n: number) => `${n}件`,
  historyEmpty: '検知はまだありません',
  historyHelp: '利益が出ていた期間を1件として記録します',
  colTime: '時刻',
  colPair: '通貨ペア',
  colTrade: '取引',
  colMaxNetProfit: '最大純利益',
  colDuration: '継続時間',
  ongoing: '継続中',

  feeNote: (fees: string) => `手数料: ${fees}（taker）`,
  feeInfoLabel: '手数料について',
  feeInfoTitle: '手数料について',
  feeInfoIntro:
    '計算に使っている手数料は、各取引所が公表している最下位ランクの現物 taker 手数料です。',
  feeTier: { regular: '一般ユーザー', lv1: 'Lv1' },
  feeInfoRate: (exchange: string, tier: string, maker: string, taker: string) =>
    `${exchange}: ${tier} maker ${maker} / taker ${taker}`,
  feeInfoLink: '公式の手数料ページ',
  feeInfoTier:
    '手数料はランク（30日間の取引量や BNB・OKB などの保有）で変わります。ご自身の手数料に合わせるには、設定ファイルの takerFeeRate を変更してください。',
  feeInfoTaker:
    'taker を使うのは、裁定は板にある注文をすぐ取る取引で、板に注文を置いて待つ maker の手数料は使えないためです。',
  theoreticalNote: '表示している値は板の情報から計算した理論値です',

  ago: (ms: number) => `${formatDurationJa(ms)}前`,
  duration: (ms: number) => formatDurationJa(ms),
};

function formatDurationJa(ms: number): string {
  if (ms < 0) {
    ms = 0;
  }
  const sec = ms / 1000;
  if (sec < 10) {
    return `${sec.toFixed(1)}秒`;
  }
  if (sec < 60) {
    return `${Math.floor(sec)}秒`;
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}分${Math.floor(sec % 60)}秒`;
  }
  const hour = Math.floor(min / 60);
  return `${hour}時間${min % 60}分`;
}
