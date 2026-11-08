// Satu-satunya sumber identitas dan warna situs. Ganti nilai di sini, bukan di komponen.
// Nilai bertanda PLACEHOLDER belum final. Semua warna adalah token, karena logo belum final.

export type Lang = 'en' | 'id';
export type ThemeName = 'light' | 'dark';
export type ThemeMode = 'auto' | ThemeName;
export type AccentKey = 'a' | 'b';

/** Permukaan berlapis: latar, kartu terangkat, area tenggelam. */
export interface ThemeSurface {
  bg: string;
  raised: string;
  sunken: string;
  text: string;
  textMuted: string;
}

/** Satu aksen utama dan satu aksen pendamping. */
export interface AccentColors {
  accent: string;
  onAccent: string;
  companion: string;
  onCompanion: string;
}

// Alamat penayangan. Bisa ditimpa lewat variabel lingkungan: OLYPS_SITE dan OLYPS_BASE.
// Domain kustom: OLYPS_SITE=https://domain-anda OLYPS_BASE= (kosongkan base).
const env = (name: string): string | undefined => (typeof process !== 'undefined' ? process.env[name] : undefined);
const SITE = env('OLYPS_SITE') ?? 'https://taufiq-afk.github.io';
const BASE = env('OLYPS_BASE') ?? '/olyps-site';

export const siteConfig = {
  // Nama situs, tagline, deskripsi, dan label menu ada di konten (admin: Footer and Global dan Home), per bahasa.

  // GitHub Pages (project site). Dibaca oleh astro.config.mjs. URL absolut Open Graph dan hreflang memakai `site`.
  site: SITE || undefined,
  base: BASE || '/',

  // Aktif sampai konten final. Menambahkan <meta name="robots" content="noindex, nofollow">.
  noindex: true,

  // Ikon logo di kiri teks wordmark. PLACEHOLDER: ganti dengan logo final. Teks wordmark memakai `name`.
  logo: { mark: 'placeholder/logo-mark.svg', alt: 'OLYPS' },
  favicon: 'favicon.svg', // PLACEHOLDER

  // auto mengikuti prefers-color-scheme. Pilihan manual disimpan di localStorage.
  defaultThemeMode: 'auto' as ThemeMode,

  themes: {
    // Terang: netral hangat, kehangatan sore dipindahkan ke sini.
    light: {
      bg: '#F5F1EA',
      raised: '#FFFDF9',
      sunken: '#ECE6DC',
      text: '#25221E',
      textMuted: '#5C554C',
    },
    // Gelap: abu arang hangat, teks putih tulang.
    dark: {
      bg: '#1E1C1A',
      raised: '#292623',
      sunken: '#151412',
      text: '#EDE7DC',
      textMuted: '#C6BFB3',
    },
  } satisfies Record<ThemeName, ThemeSurface>,

  // Dua kandidat aksen, dipilih lewat `accent`. Tidak ada oranye-terakota.
  accents: {
    a: {
      name: 'Teal dan violet',
      light: { accent: '#17695C', onAccent: '#FFFFFF', companion: '#5E4FA8', onCompanion: '#FFFFFF' },
      dark: { accent: '#6AD3BB', onAccent: '#10201C', companion: '#B8ABF2', onCompanion: '#1E1736' },
    },
    b: {
      name: 'Indigo dan hijau laut',
      light: { accent: '#4350C0', onAccent: '#FFFFFF', companion: '#1D7A63', onCompanion: '#FFFFFF' },
      dark: { accent: '#A9B1FF', onAccent: '#14183A', companion: '#79D6B4', onCompanion: '#0F2A22' },
    },
  } satisfies Record<AccentKey, { name: string; light: AccentColors; dark: AccentColors }>,
  accent: 'a' as AccentKey,

  // Kaca varian tema: persentase warna "raised", sisanya translusen.
  glass: { light: 76, dark: 74 } satisfies Record<ThemeName, number>,
  // Kaca varian on-media mengikuti tema. Terang: kaca terang translusen, teks gelap. Gelap: kaca gelap translusen, teks terang.
  // Selalu garis tepi 1px seragam semi-transparan, tanpa sorotan asimetris.
  glassMedia: {
    light: {
      color: '#FFFDF9',
      pct: 76,
      border: 'rgb(31 27 23 / 0.14)',
      borderStrong: 'rgb(31 27 23 / 0.26)',
      shadow: '0 2px 4px rgb(30 25 15 / 0.08), 0 14px 32px rgb(30 25 15 / 0.16)',
    },
    dark: {
      color: '#14110F',
      pct: 62,
      border: 'rgb(255 255 255 / 0.2)',
      borderStrong: 'rgb(255 255 255 / 0.32)',
      shadow: '0 2px 4px rgb(0 0 0 / 0.3), 0 14px 36px rgb(0 0 0 / 0.4)',
    },
  },

  // Wallpaper hero per tema. Scrim tipis dan warna teks di atasnya mengikuti tema.
  // poster: jpg (webp bernama sama). video: nama dasar tanpa ekstensi (.mp4 dan .webm).
  hero: {
    light: {
      scrimColor: '#F7F3EB',
      scrim: 0.34, // opasitas minimum di seluruh hero, gradasi kiri hanya menambah
      text: '#1F1B17',
      textMuted: '#2E2924',
      poster: 'media/olyps-hero-poster-light.jpg',
      video: 'media/olyps-hero-loop-light',
    },
    dark: {
      scrimColor: '#0C0A09',
      scrim: 0.5,
      text: '#F6F1E7',
      textMuted: '#DDD6CA',
      poster: 'media/olyps-hero-poster.jpg',
      video: 'media/olyps-hero-loop',
    },
  },

  // Urutan navigasi, dipakai navbar, menu ponsel, dan footer.
  nav: ['projects', 'research', 'publications', 'people', 'contact'] as ('research' | 'projects' | 'publications' | 'people' | 'contact')[],

  disclaimers: {
    placeholder: {
      en: 'Placeholder text, not final.',
      id: 'Teks placeholder, belum final.',
    },
  },
};

export const siteLangs: Lang[] = ['en', 'id'];
export const defaultLang: Lang = 'en';
