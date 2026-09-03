/** 日本語の文言。キーの一覧はこのファイルが基準で、ほかの言語も同じ形にする */
export const ja = {
  appTitle: 'Crypto Arbitrage Detector',
  appDescription: '取引所間の価格差から、手数料込みで利益が出る売買を検知',
  language: '言語',

  tabTitleNotification: 'タブのタイトルで通知',
  tabTitleNotificationHelp: '利益が出る機会がある間、ブラウザのタブのタイトルに表示します',

  // 接続状態（画面上部の1行）
  statusConnecting: 'サーバーに接続しています…',
  statusServerDisconnected: 'サーバーと切断されました。再接続しています…',
  statusExchangeDisconnected: (names: string) =>
    `${names} と切断中です。再接続しています（つながるまで、その取引所は評価に使いません）`,
  statusWatching: (names: string) => `監視中（${names} に接続）`,

  // 今の状態のまとめ
  summaryNone: '今は利益の出る機会がありません',

  // 通貨ペアごとの枠
  waitingForData: '取引所からの板を待っています…',
  notEvaluable: '両方の取引所の板がそろうと評価します',
  badgeProfitable: '利益あり',
  badgeNone: '機会なし',
  badgeWaiting: 'データ待ち',
  tagBest: 'いちばん有利',
  rowSpread: '価格差',
  rowFees: '手数料',
  rowNet: '手数料込み',
  perUnit: (base: string, quote: string) => `${quote} / 1 ${base}`,
  quantity: '数量',
  netProfit: '純利益',
  gapToProfit: '利益まで',
  gapValue: (amount: string) => `あと ${amount}`,
  depthExhausted: '板の受信範囲まで計算（実際はもっと多い可能性）',

  colExchange: '取引所',
  colSellPrice: '売れる価格 (bid)',
  colBuyPrice: '買える価格 (ask)',
  colUpdated: '更新',

  details: '数量と逆方向',
  colSellQty: '売れる数量',
  colBuyQty: '買える数量',
  colLevels: '板',
  levels: (n: number) => `${n}段`,
  reverse: '逆方向',
  direction: (buy: string, sell: string) => `${buy} で買い → ${sell} で売り`,

  // 履歴
  historyTitle: '機会の履歴',
  historyCount: (n: number) => `${n}件`,
  historyEmpty: 'まだ機会は検知されていません',
  historyHelp: '手数料込みで利益が出ていた期間ごとに1件。再起動で消えます',
  colTime: '時刻',
  colPair: '通貨ペア',
  colTrade: '取引',
  colMaxNetProfit: '最大純利益',
  colDuration: '継続時間',
  ongoing: '継続中',

  feeNote: (fees: string) => `手数料: ${fees}（taker）`,
  theoreticalNote: '板のスナップショットから計算した理論値',

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
