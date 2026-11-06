// Melayani folder admin/ (di luar public/) hanya saat `astro dev`.
// Hook astro:server:setup tidak dijalankan oleh `astro build`, dan admin/ tidak berada di public/,
// sehingga berkas admin tidak pernah masuk dist. Alamat mengikuti base situs (mis. /olyps-site/admin/).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { tidyAssets } from '../scripts/tidy-assets.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.yml': 'text/yaml; charset=utf-8' };

export default function devAdmin() {
  const dir = path.resolve('admin');
  let base = '';
  return {
    name: 'olyps-dev-admin',
    hooks: {
      'astro:config:setup': ({ config }) => {
        base = (config.base ?? '/').replace(/\/$/, '');
      },
      'astro:server:setup': ({ server, logger }) => {
        const prefix = `${base}/admin`;
        server.middlewares.use(async (req, res, next) => {
          // Vite bisa sudah melepas base dari req.url, jadi baca URL asli.
          const { pathname } = new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost');
          if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return next();
          // config.yml dimuat relatif terhadap halaman, jadi alamat tanpa garis miring diarahkan ke yang bergaris miring.
          if (pathname === prefix) { res.statusCode = 301; res.setHeader('Location', `${prefix}/`); return res.end(); }
          const file = pathname.slice(prefix.length + 1) || 'index.html';
          if (file !== 'index.html' && file !== 'config.yml') return next();
          try {
            res.setHeader('Content-Type', TYPES[path.extname(file)]);
            res.setHeader('Cache-Control', 'no-store');
            res.end(await readFile(path.join(dir, file)));
          } catch {
            next();
          }
        });
        // Rapikan unggahan (nama dari slug, webp, tanpa metadata) setelah admin menyimpan konten atau gambar.
        const relevant = /[\\/]src[\\/](content[\\/](people|research|projects)[\\/].+\.md|assets[\\/](people|research|projects)[\\/][^.].*)$/;
        let timer;
        let running = false;
        const schedule = (file) => {
          if (!relevant.test(file) || file.endsWith('.tmp')) return;
          clearTimeout(timer);
          timer = setTimeout(async () => {
            if (running) return;
            running = true;
            try { await tidyAssets({ log: (m) => logger.info(m) }); } catch (e) { logger.warn(`tidy gagal: ${e.message}`); } finally { running = false; }
          }, 1500);
        };
        server.watcher.on('add', schedule).on('change', schedule);
        logger.info(`Admin (hanya dev): ${prefix}/`);
      },
    },
  };
}
