/** 日本語の文言。キーの一覧はこのファイルが基準で、他言語は同じ形にする */
export const ja = {
  appTitle: 'Crypto Arbitrage Detector',
  appDescription: '取引所間の板を比較し、手数料込みで利益が出る裁定機会を検知します',

  server: 'サーバー',
  serverConnecting: '接続中…',
  serverConnected: '接続中',
  serverDisconnected: '切断（再接続中）',
  waitingForData: '取引所からのデータを待っています…',

  exchangeConnected: '接続中',
  exchangeDisconnected: '切断中',
  takerFee: 'taker手数料',
  levels: (n: number) => `板${n}段`,

  tabTitleNotification: 'タブのタイトルで通知',
  tabTitleNotificationHelp: '利益が出る機会がある間、ブラウザのタブのタイトルに表示します',

  colExchange: '取引所',
  colBid: '買い気配 (bid)',
  colAsk: '売り気配 (ask)',
  colUpdated: '更新',
  colDirection: '方向',
  colGrossSpread: '価格差 / 1単位',
  colNetSpread: '手数料込み / 1単位',
  colQuantity: '数量',
  colNetProfit: '純利益',

  direction: (buy: string, sell: string) => `${buy} で買い → ${sell} で売り`,
  profitable: '利益あり',
  noOpportunity: '機会なし',
  notEvaluable: '両取引所の板が揃うと評価します',
  avgBuyPrice: '平均買値',
  avgSellPrice: '平均売値',
  grossProfit: '手数料前の利益',
  fees: '手数料',
  depthExhausted: '受信した板を使い切っているため、実際の機会はこれより大きい可能性があります',

  historyTitle: '機会の履歴',
  historyCount: (n: number) => `${n}件`,
  historyEmpty: 'まだ機会は検知されていません',
  historyHelp:
    '手数料込みの純利益が正になった期間を1件として記録します（サーバー再起動で消えます）',
  colStarted: '開始',
  colPair: '通貨ペア',
  colDuration: '継続時間',
  colMaxNetProfit: '最大純利益',
  colQuantityAtMax: '数量（最大時）',
  ongoing: '継続中',

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
