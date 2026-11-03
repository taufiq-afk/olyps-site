// Mengubah token di site.config.ts menjadi CSS variables. Dipakai BaseLayout.
import { siteConfig, type ThemeName, type AccentKey, type AccentColors, type ThemeSurface } from '../site.config';

const surfaceVars = (t: ThemeSurface) =>
  `--bg:${t.bg};--raised:${t.raised};--sunken:${t.sunken};--text:${t.text};--text-muted:${t.textMuted};`;

const accentVars = (a: AccentColors) =>
  `--accent:${a.accent};--on-accent:${a.onAccent};--companion:${a.companion};--on-companion:${a.onCompanion};`;

// Token on-media per tema (--m-*), nilai literal agar tidak ada referensi melingkar saat dipetakan ke --text dst.
const mediaVars = (name: ThemeName) => {
  const hero = siteConfig.hero[name];
  const gm = siteConfig.glassMedia[name];
  return (
    `--scrim-color:${hero.scrimColor};--scrim-base:color-mix(in srgb, ${hero.scrimColor} ${hero.scrim * 100}%, transparent);` +
    `--m-text:${hero.text};--m-text-muted:${hero.textMuted};` +
    `--m-glass-bg:color-mix(in srgb, ${gm.color} ${gm.pct}%, transparent);--m-glass-border:${gm.border};` +
    `--m-border:${gm.border};--m-border-strong:${gm.borderStrong};--m-shadow:${gm.shadow};`
  );
};

export function buildThemeCss(): string {
  const themes = Object.keys(siteConfig.themes) as ThemeName[];
  const accents = Object.keys(siteConfig.accents) as AccentKey[];
  let css = '';

  for (const name of themes) {
    const defaultAccent = siteConfig.accents[siteConfig.accent][name];
    css += `[data-theme="${name}"]{${surfaceVars(siteConfig.themes[name])}${accentVars(defaultAccent)}--glass-pct:${siteConfig.glass[name]}%;${mediaVars(name)}}`;
    // Override aksen pada elemen yang sama (dipakai halaman styleguide untuk membandingkan kandidat).
    for (const key of accents) {
      css += `[data-theme="${name}"][data-accent="${key}"]{${accentVars(siteConfig.accents[key][name])}}`;
    }
  }

  return css;
}
