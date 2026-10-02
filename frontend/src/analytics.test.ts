import { afterEach, describe, expect, it, vi } from 'vitest';

const production = 'https://crypto-arbitrage-detector-bk6u.onrender.com';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
  document.querySelectorAll('script[data-analytics]').forEach((script) => {
    script.remove();
  });
  delete window.gtag;
  delete window.dataLayer;
});

async function load(url: string) {
  vi.stubGlobal('location', new URL(url));
  vi.stubEnv('PROD', true);
  return import('./analytics');
}

describe('アクセス解析', () => {
  it('開発ビルドは本番URLでも計測しない', async () => {
    const analytics = await load(production);
    vi.stubEnv('PROD', false);
    analytics.initializeAnalytics();
    expect(window.dataLayer).toBeUndefined();
  });
  it.each([
    'http://localhost:3000',
    'https://preview.example.com',
    `http://${new URL(production).host}`,
  ])('本番以外ではタグの読み込みとイベント送信を行わない: %s', async (url) => {
    const analytics = await load(url);
    analytics.initializeAnalytics();
    analytics.trackEvent('dashboard_ready');
    expect(document.querySelector('script[data-analytics]')).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });

  it('本番では専用タグを一度だけ読み込み、ページビューを一度設定する', async () => {
    const analytics = await load(production);
    analytics.initializeAnalytics();
    analytics.initializeAnalytics();
    const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-analytics]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toMatch(/^https:\/\/www.googletagmanager.com\/gtag\/js\?id=G-/);
    const commands = window.dataLayer?.map((command) => Array.from(command));
    expect(commands?.filter((command) => command[0] === 'config')).toHaveLength(1);
    expect(commands?.find((command) => command[0] === 'config')?.[2]).toMatchObject({
      page_location: `${production}/`,
      page_title: 'Crypto Arbitrage Detector',
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  });

  it('URLと参照元のクエリ・断片を送信せず、流入元のサイトは保持する', async () => {
    vi.spyOn(document, 'referrer', 'get').mockReturnValue(
      'https://example.com/article?email=private#token',
    );
    const analytics = await load(`${production}/?email=private#token`);
    analytics.initializeAnalytics();
    const config = window.dataLayer
      ?.map((command) => Array.from(command))
      .find((command) => command[0] === 'config')?.[2];
    expect(config).toMatchObject({
      page_location: `${production}/`,
      page_referrer: 'https://example.com/article',
    });
    expect(JSON.stringify(config)).not.toContain('private');
    expect(JSON.stringify(config)).not.toContain('token');
  });

  it('ユーザーの操作を専用ストリームへ送り、解析タグの失敗は画面操作を妨げない', async () => {
    const analytics = await load(production);
    analytics.initializeAnalytics();
    analytics.trackEvent('language_changed', { ui_language: 'en' });
    expect(Array.from(window.dataLayer?.at(-1) ?? [])).toEqual([
      'event',
      'language_changed',
      expect.objectContaining({ ui_language: 'en', send_to: expect.stringMatching(/^G-/) }),
    ]);
    window.gtag = () => {
      throw new Error('blocked');
    };
    expect(() => analytics.trackEvent('dashboard_ready')).not.toThrow();
  });
});
