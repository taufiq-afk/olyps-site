// Merapikan unggahan gambar di src/assets/<jenis>/ yang dirujuk entri konten.
// - Nama berkas menjadi slug entri (mis. taufiq.webp), bukan nama berkas asli. Rujukan di Markdown ikut diperbarui.
// - Gambar diputar sesuai EXIF, dikonversi ke webp, dibatasi 1024 px dan ukuran maksimum pemeriksa, tanpa metadata (EXIF, GPS, XMP).
// - Idempoten: berkas yang sudah memenuhi syarat hanya diganti nama bila perlu, tidak dikompres ulang.
// Dipanggil otomatis oleh integrations/dev-admin.mjs saat berkas konten atau aset berubah, atau manual: npm run tidy:assets
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const KINDS = ['people', 'research', 'projects'];
const MAX_DIM = 1024;

export async function tidyAssets({ root = process.cwd(), log = console.log } = {}) {
  const maxBytes = JSON.parse(readFileSync(path.join(root, 'scripts/predeploy.config.json'), 'utf8')).maxFileBytes;
  const changes = [];

  for (const kind of KINDS) {
    const contentDir = path.join(root, 'src/content', kind);
    if (!existsSync(contentDir)) continue;
    const refRe = new RegExp(`/src/assets/${kind}/[^\\s"'#)]+`, 'g');

    // slug -> berkas md di semua bahasa
    const bySlug = new Map();
    for (const lang of readdirSync(contentDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      for (const f of readdirSync(path.join(contentDir, lang.name)).filter((n) => n.endsWith('.md'))) {
        const slug = f.slice(0, -3);
        bySlug.set(slug, [...(bySlug.get(slug) ?? []), path.join(contentDir, lang.name, f)]);
      }
    }

    for (const [slug, files] of bySlug) {
      const texts = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
      // Satu gambar per entri. Bila bahasa merujuk gambar berbeda (mis. hanya satu yang diperbarui), yang terbaru menang
      // dan rujukan lain diarahkan ke sana. Berkas lama yang tidak dipakai dibiarkan, tidak dihapus.
      const found = [...new Set([...texts.values()].flatMap((t) => t.match(refRe) ?? []))]
        .map((r) => ({ r, mtime: existsSync(path.join(root, r)) ? statSync(path.join(root, r)).mtimeMs : 0 }))
        .sort((a, b) => b.mtime - a.mtime);
      const refs = found.slice(0, 1).map((x) => x.r);
      for (const { r } of found.slice(1)) {
        for (const [f, t] of texts) if (t.includes(r)) { texts.set(f, t.split(r).join(refs[0])); writeFileSync(f, texts.get(f)); }
        changes.push(`${r} -> mengikuti ${refs[0]} (rujukan bahasa lain)`);
      }
      for (const ref of refs) {
        const wanted = `${slug}.webp`;
        const target = `/src/assets/${kind}/${wanted}`;
        const from = path.join(root, ref);
        if (!existsSync(from)) { log(`[tidy] ${ref}: berkas tidak ada, dilewati`); continue; }

        const input = await readFile(from);
        const meta = await sharp(input).metadata();
        const needsEncode = meta.format !== 'webp' || !!(meta.exif || meta.xmp || meta.iptc)
          || meta.width > MAX_DIM || meta.height > MAX_DIM || input.length > maxBytes;
        if (!needsEncode && ref === target) continue;

        const to = path.join(root, target);
        if (needsEncode) {
          let out;
          for (let q = 85; q >= 45; q -= 10) {
            // Tanpa withMetadata, sharp membuang EXIF, GPS, dan XMP. rotate() menerapkan orientasi EXIF lebih dulu.
            out = await sharp(input).rotate().resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true }).webp({ quality: q }).toBuffer();
            if (out.length <= maxBytes) break;
          }
          await writeFile(`${to}.tmp`, out);
          await rename(`${to}.tmp`, to);
          if (from !== to) await rm(from, { force: true });
        } else {
          await rename(from, to);
        }
        for (const [f, t] of texts) if (t.includes(ref)) { texts.set(f, t.split(ref).join(target)); writeFileSync(f, texts.get(f)); }
        changes.push(`${ref} -> ${target}${needsEncode ? ' (dioptimasi)' : ''}`);
      }
    }
  }
  for (const c of changes) log(`[tidy] ${c}`);
  return changes;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const changes = await tidyAssets();
  if (!changes.length) console.log('[tidy] tidak ada yang perlu dirapikan');
}
