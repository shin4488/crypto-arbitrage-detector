/** 日本語の文言。キーの一覧はこのファイルが基準で、ほかの言語も同じ形にする */
export const ja = {
  appTitle: 'Crypto Arbitrage Detector',
  appDescription: '取引所間の価格差から、手数料を引いても利益が出る売買を探します',

  tabTitleNotification: 'タブのタイトルで通知',
  tabTitleNotificationHelp: '利益が出る機会がある間、ブラウザのタブのタイトルに表示します',

  // 接続状態（画面上部の1行）
  statusConnecting: 'サーバーに接続しています…',
  statusServerDisconnected: 'サーバーと切断されました。再接続しています…',
  statusExchangeDisconnected: (names: string) =>
    `${names} と切断中です。再接続しています（つながるまで、その取引所は評価に使いません）`,
  statusWatching: (names: string) => `監視中（${names} に接続）`,

  // 今の状態のまとめ
  summaryNone: '今、利益の出る機会はありません',
  summaryProfitable: (pair: string, buy: string, sell: string, profit: string) =>
    `${pair}: ${buy} で買い → ${sell} で売り で ${profit} の利益`,

  // 通貨ペアごとの枠
  waitingForData: '取引所からの板を待っています…',
  notEvaluable: '両方の取引所の板がそろうと評価します',
  badgeProfitable: '利益あり',
  badgeNone: '機会なし',
  badgeWaiting: 'データ待ち',
  leadProfitable: (buy: string, quantity: string, sell: string) =>
    `${buy} で ${quantity} を買い、${sell} で売ると`,
  leadProfit: (profit: string) => `${profit} の利益`,
  leadNone: (buy: string, sell: string) =>
    `いちばん有利なのは「${buy} で買い → ${sell} で売り」ですが、手数料を引くと赤字です`,
  perUnit: (base: string) => `1 ${base} あたり`,
  rowSpread: '価格差',
  rowFees: '手数料',
  rowNet: '手数料込み',
  shortfall: (amount: string, base: string) =>
    `あと ${amount} / ${base} 価格差が広がれば利益が出ます`,
  depthExhausted: '受信している板を使い切っているので、実際にはもっと多く取引できるかもしれません',

  colExchange: '取引所',
  colSellPrice: '売れる価格 (bid)',
  colBuyPrice: '買える価格 (ask)',
  colUpdated: '更新',

  details: '詳細（数量・板の深さ・もう一方の方向）',
  detailQuantity: (sellQty: string, buyQty: string, levels: number) =>
    `売れる数量 ${sellQty} / 買える数量 ${buyQty}（板${levels}段）`,
  otherDirection: 'もう一方の方向',
  direction: (buy: string, sell: string) => `${buy} で買い → ${sell} で売り`,

  // 履歴
  historyTitle: '機会の履歴',
  historyCount: (n: number) => `${n}件`,
  historyEmpty: 'まだ機会は検知されていません',
  historyHelp:
    '手数料を引いても利益が出ていた期間を1件として記録します（サーバーを再起動すると消えます）',
  colTime: '時刻',
  colPair: '通貨ペア',
  colTrade: '取引',
  colMaxNetProfit: '最大純利益',
  colDuration: '継続時間',
  ongoing: '継続中',

  feeNote: (fees: string) =>
    `手数料は ${fees}（taker）で計算しています。表示する利益は板のスナップショットから求めた理論値です`,

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
