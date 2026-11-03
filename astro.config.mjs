import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { siteConfig, siteLangs, defaultLang } from './src/site.config.ts';

// Aset placeholder yang hanya dipakai di dev. Dihapus dari dist pada build produksi.
const devOnlyAssets = ['placeholder/poster.svg'];
const excludeDevOnlyAssets = {
  name: 'exclude-dev-only-assets',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      for (const asset of devOnlyAssets) await rm(fileURLToPath(new URL(asset, dir)), { force: true });
    },
  },
};

export default defineConfig({
  output: 'static',
  site: siteConfig.site,
  base: siteConfig.base,
  devToolbar: { enabled: false },
  integrations: [excludeDevOnlyAssets],
  i18n: {
    locales: siteLangs,
    defaultLocale: defaultLang,
    routing: {
      prefixDefaultLocale: true,
      // Halaman root dikelola sendiri (src/pages/index.astro) agar bisa membaca bahasa browser.
      redirectToDefaultLocale: false,
    },
  },
});
