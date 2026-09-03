import type { Theme } from '../hooks/useStoredTheme';
import { type Lang, useT } from '../i18n';
import type { ExchangeInfo } from '../protocol/types';
import type { ConnectionStatus } from '../state/reducer';

interface HeaderProps {
  connection: ConnectionStatus;
  exchanges: ExchangeInfo[];
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

/** タイトルと、右側に接続状態・配色（ライト／ダーク）と言語の切り替え */
export function Header({
  connection,
  exchanges,
  lang,
  onLangChange,
  theme,
  onThemeChange,
}: HeaderProps) {
  const t = useT();
  const status = connectionSentence(connection, exchanges, t);
  const themes: SegmentedOption<Theme>[] = [
    { value: 'light', label: t.themeLight },
    { value: 'dark', label: t.themeDark },
  ];

  return (
    <header className="header">
      <div className="brand">
        <img src="/favicon.svg" alt="" width="36" height="36" />
        <div>
          <h1>{t.appTitle}</h1>
          <p className="muted">{t.appDescription}</p>
        </div>
      </div>
      <div className="controls">
        <span className={`status ${status.ok ? 'status--ok' : 'status--down'}`} role="status">
          {status.text}
        </span>
        <Segmented value={theme} options={themes} onChange={onThemeChange} label={t.theme} />
        <Segmented value={lang} options={LANGS} onChange={onLangChange} label={t.language} />
      </div>
    </header>
  );
}

/** 接続の状態を「今どうなっているか」が分かる1文にまとめる */
function connectionSentence(
  connection: ConnectionStatus,
  exchanges: ExchangeInfo[],
  t: ReturnType<typeof useT>,
): { ok: boolean; text: string } {
  if (connection === 'connecting') {
    return { ok: false, text: t.statusConnecting };
  }
  if (connection === 'disconnected') {
    return { ok: false, text: t.statusServerDisconnected };
  }
  const down = exchanges.filter((ex) => !ex.connected).map((ex) => ex.name);
  if (down.length > 0) {
    return { ok: false, text: t.statusExchangeDisconnected(down.join('・')) };
  }
  return { ok: true, text: t.statusWatching(exchanges.map((ex) => ex.name).join('・')) };
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** 表示名がその言語で書かれているとき（「日本語」「English」）、読み上げのために付ける */
  lang?: string;
}

/** 言語名はその言語で書く（切り替えたい人が自分の言語を見つけられるように） */
const LANGS: SegmentedOption<Lang>[] = [
  { value: 'ja', label: '日本語', lang: 'ja' },
  { value: 'en', label: 'English', lang: 'en' },
];

/** 選択肢を並べて選択中を反転させる切り替え（セグメントコントロール）。配色と言語で使う */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <fieldset className="segmented" aria-label={label}>
      {options.map((item) => (
        <button
          key={item.value}
          type="button"
          lang={item.lang}
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </fieldset>
  );
}
