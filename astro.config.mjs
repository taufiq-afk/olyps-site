import { defineConfig } from 'astro/config';
import { siteConfig, siteLangs, defaultLang } from './src/site.config.ts';

export default defineConfig({
  output: 'static',
  site: siteConfig.site,
  base: siteConfig.base,
  devToolbar: { enabled: false },
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
