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
  perUnit: (base: string, quote: string) => `${quote} / 1 ${base}`,
  quantity: '数量',
  netProfit: '純利益',
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
  historyHelp: '利益が出ていた期間を1件として記録します（サーバーを再起動すると消えます）',
  colTime: '時刻',
  colPair: '通貨ペア',
  colTrade: '取引',
  colMaxNetProfit: '最大純利益',
  colDuration: '継続時間',
  ongoing: '継続中',

  feeNote: (fees: string) => `手数料: ${fees}（taker）`,
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
