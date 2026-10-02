import type { Theme } from './hooks/useStoredTheme';
import type { Lang } from './i18n';

// 測定IDは認証情報ではなく公開識別子。本番の専用ストリーム以外へ送らない。
const MEASUREMENT_ID = 'G-MJ4RNF1W2M';
const PRODUCTION_ORIGIN = 'https://crypto-arbitrage-detector-bk6u.onrender.com';

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

type EventName =
  | 'dashboard_ready'
  | 'language_changed'
  | 'theme_changed'
  | 'pair_visibility_changed'
  | 'pairs_reset'
  | 'pair_reordered'
  | 'amount_changed'
  | 'fee_info_opened';

interface EventParameters {
  ui_language?: Lang;
  ui_theme?: Theme;
  pair_symbol?: string;
  visible?: boolean;
  interaction_method?: 'keyboard' | 'drag';
}

let initialized = false;

/** クエリや断片には入力値が含まれ得るため、解析用URLには残さない。 */
function pageUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? `${url.origin}${url.pathname}`
      : '';
  } catch {
    return '';
  }
}

/** タグの読み込み失敗やブロックが、監視画面の操作に影響しないようにする。 */
function send(...args: unknown[]): void {
  if (!initialized) {
    return;
  }
  try {
    window.gtag?.(...args);
  } catch {
    // 解析は任意の付加機能なので、通信先の障害を画面へ伝播させない。
  }
}

export function initializeAnalytics(): void {
  if (initialized || !import.meta.env.PROD || location.origin !== PRODUCTION_ORIGIN) {
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // biome-ignore lint/complexity/noArguments: Google公式スニペットのコマンド形式を維持する。
    window.dataLayer?.push(arguments);
  };
  initialized = true;
  send('js', new Date());
  send('config', MEASUREMENT_ID, {
    page_location: pageUrl(location.href),
    page_referrer: pageUrl(document.referrer),
    // 利益通知で変わるタブタイトルを集計上のページ名や取引データとして送らない。
    page_title: 'Crypto Arbitrage Detector',
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  script.dataset.analytics = '';
  document.head.append(script);
}

export function trackEvent(name: EventName, parameters: EventParameters = {}): void {
  send('event', name, { ...parameters, send_to: MEASUREMENT_ID });
}

export function updateUserPreferences(lang: Lang, theme: Theme): void {
  send('set', 'user_properties', { ui_language: lang, ui_theme: theme });
}
