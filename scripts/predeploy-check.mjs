// Pemeriksa sebelum deploy. Jalankan: npm run check:predeploy (build dulu, lalu pemeriksaan atas dist/ dan sumber).
// Opsi: --skip-words (lewati kata terlarang, hanya untuk lingkungan tanpa berkas lokal), --skip-git, --allow-index.
// Daftar kata terlarang dibaca dari scripts/forbidden.local.json (di-ignore git, tidak ada di repo).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { siteConfig } from '../src/site.config.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const args = new Set(process.argv.slice(2));
const config = JSON.parse(readFileSync(path.join(root, 'scripts/predeploy.config.json'), 'utf8'));

let failures = 0;
const section = (title) => console.log(`\n== ${title}`);
const pass = (msg) => console.log(`   OK    ${msg}`);
const fail = (msg) => { failures++; console.log(`   GAGAL ${msg}`); };
const warn = (msg) => console.log(`   INFO  ${msg}`);
const report = (label, items, limit = 8) => {
  if (!items.length) return pass(label);
  fail(`${label}: ${items.length} temuan`);
  items.slice(0, limit).forEach((i) => console.log(`         - ${i}`));
  if (items.length > limit) console.log(`         ... dan ${items.length - limit} lainnya`);
};

if (!existsSync(dist)) {
  console.error('dist/ tidak ada. Jalankan `npm run build` dulu (atau `npm run check:predeploy`).');
  process.exit(2);
}

// ---------- Berkas
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const distFiles = walk(dist);
const TEXT_EXT = /\.(html|css|js|mjs|json|svg|txt|xml|vtt|webmanifest|map|md)$/i;
const htmlFiles = distFiles.filter((f) => f.endsWith('.html'));
const rel = (f) => path.relative(root, f);

// Berkas sumber yang akan masuk repo: dilacak atau belum dilacak tetapi tidak diabaikan.
const sourceFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(Boolean).filter((f) => existsSync(path.join(root, f)));
const isTextSource = (f) => {
  const full = path.join(root, f);
  if (statSync(full).size > 1_000_000) return false;
  if (/\.(png|jpe?g|webp|gif|ico|mp4|webm|woff2?|ttf|otf|pdf)$/i.test(f)) return false;
  return !readFileSync(full).includes(0);
};
const sources = sourceFiles.filter(isTextSource).map((f) => ({ file: f, text: readFileSync(path.join(root, f), 'utf8') }));
const distTexts = distFiles.filter((f) => TEXT_EXT.test(f)).map((f) => ({ file: rel(f), text: readFileSync(f, 'utf8') }));

// Teks yang terlihat di halaman, ditambah atribut aksesibilitas.
const visibleText = (html) => {
  const attrs = [...html.matchAll(/\b(?:aria-label|alt|title)="([^"]*)"/g)].map((m) => m[1]).join(' ');
  const body = html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  return `${body} ${attrs}`.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
};
const withoutAffiliations = (html) => html.replace(/<(\w+)[^>]*\bdata-affiliations\b[^>]*>[\s\S]*?<\/\1>/g, ' ');
const withoutAffiliationsSource = (file, text) => {
  if (!file.startsWith('src/content/people/')) return text;
  const out = [];
  let skipping = false;
  for (const line of text.split('\n')) {
    if (/^affiliations:/.test(line)) { skipping = true; continue; }
    if (skipping && /^(\s+|-)/.test(line)) continue;
    skipping = false;
    out.push(line);
  }
  return out.join('\n');
};
const wordRe = (w) => new RegExp(`(?<![A-Za-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`, 'i');

// ---------- 1. noindex
section('noindex');
if (args.has('--allow-index')) warn('dilewati (--allow-index)');
else report('semua halaman memiliki meta robots noindex', htmlFiles.filter((f) => !/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(readFileSync(f, 'utf8'))).map(rel));
if (!siteConfig.noindex && !args.has('--allow-index')) fail('siteConfig.noindex bernilai false');

// ---------- 1b. judul tab
section('judul tab (<title>) tidak kosong');
report('semua halaman memiliki <title> yang berisi teks', htmlFiles.filter((f) => {
  const m = readFileSync(f, 'utf8').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return !m || !m[1].trim();
}).map(rel));

// ---------- 2. placeholder
section('teks placeholder di halaman produksi');
{
  const patterns = config.placeholderPatterns.map((p) => new RegExp(p, 'i'));
  const findings = [];
  for (const f of htmlFiles) {
    let text = visibleText(readFileSync(f, 'utf8'));
    for (const allowed of config.allowlist) text = text.split(allowed).join(' ');
    const hit = new Set();
    for (const re of patterns) {
      for (const m of text.matchAll(new RegExp(re.source, 'gi'))) hit.add(text.slice(Math.max(0, m.index - 25), m.index + 45).trim());
    }
    if (hit.size) findings.push(`${rel(f)}: ${hit.size} potongan, mis. "${[...hit][0]}"`);
  }
  for (const f of distFiles.filter((x) => x.endsWith('.svg'))) {
    if (/placeholder/i.test(readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, ''))) findings.push(`${rel(f)}: teks placeholder di dalam gambar`);
  }
  report('tidak ada teks placeholder (di luar allowlist judul)', findings, 12);
}

// ---------- 3. kata terlarang
section('kata terlarang');
{
  const listPath = path.join(root, 'scripts/forbidden.local.json');
  if (args.has('--skip-words')) warn('dilewati (--skip-words)');
  else if (!existsSync(listPath)) fail('scripts/forbidden.local.json tidak ditemukan (berkas lokal). Salin dari forbidden.example.json atau pakai --skip-words.');
  else {
    const list = JSON.parse(readFileSync(listPath, 'utf8'));
    const everywhere = [...(list.everywhere ?? []), ...(list.claims ?? []), ...(list.emails ?? [])];
    const institutions = list.institutionsOutsideAffiliations ?? [];
    const findings = [];
    for (const { file, text } of distTexts) {
      const html = file.endsWith('.html') ? withoutAffiliations(text) : text;
      for (const w of everywhere) if (wordRe(w).test(text)) findings.push(`${file}: "${w}"`);
      for (const w of institutions) if (wordRe(w).test(html)) findings.push(`${file}: "${w}" di luar affiliations`);
    }
    for (const { file, text } of sources) {
      if (file === 'scripts/forbidden.example.json') continue;
      const scoped = withoutAffiliationsSource(file, text);
      for (const w of everywhere) if (wordRe(w).test(text)) findings.push(`${file}: "${w}"`);
      for (const w of institutions) if (wordRe(w).test(scoped)) findings.push(`${file}: "${w}" di luar affiliations`);
    }
    report(`hasil build dan sumber bersih dari ${everywhere.length + institutions.length} kata terlarang`, findings, 12);
  }
}

// ---------- 4. email
section('pola email');
{
  const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:com|net|org|io|id|ac\.id|co|edu|dev|app|me|invalid)\b/gi;
  const findings = [];
  for (const { file, text } of [...distTexts, ...sources]) {
    if (file === 'package-lock.json' || file === 'scripts/forbidden.example.json') continue;
    const m = text.match(re);
    if (m) findings.push(`${file}: ${m[0].replace(/^[^@]{2}/, '**')}`);
  }
  report('tidak ada alamat email', findings);
}

// ---------- 5. rahasia
section('berkas dan kunci rahasia');
{
  const fileRes = config.secretFiles.map((p) => new RegExp(p, 'i'));
  const contentRes = config.secretContent.map((p) => new RegExp(p, 'i'));
  const findings = [];
  for (const f of [...sourceFiles, ...distFiles.map(rel)]) if (fileRes.some((re) => re.test(path.basename(f)) || re.test(f))) findings.push(`${f}: nama berkas rahasia`);
  for (const { file, text } of [...distTexts, ...sources]) {
    if (file === 'package-lock.json' || file === 'scripts/predeploy.config.json') continue;
    for (const re of contentRes) if (re.test(text)) { findings.push(`${file}: pola kunci/rahasia (${re.source.slice(0, 18)}...)`); break; }
  }
  report('tidak ada .env, kunci, atau token', findings);
}

// ---------- 6. ukuran aset
section('ukuran aset publik');
{
  const total = distFiles.reduce((n, f) => n + statSync(f).size, 0);
  const big = distFiles.filter((f) => statSync(f).size > config.maxFileBytes).map((f) => `${rel(f)} ${(statSync(f).size / 1e6).toFixed(2)} MB`);
  report(`tiap berkas <= ${(config.maxFileBytes / 1e6).toFixed(1)} MB`, big);
  if (total > config.maxTotalBytes) fail(`total dist ${(total / 1e6).toFixed(2)} MB melebihi ${(config.maxTotalBytes / 1e6).toFixed(0)} MB`);
  else pass(`total dist ${(total / 1e6).toFixed(2)} MB (batas ${(config.maxTotalBytes / 1e6).toFixed(0)} MB)`);
}

// ---------- 7. base path dan URL
section('base path dan URL absolut');
{
  const base = siteConfig.base.replace(/\/$/, '');
  const findings = [];
  for (const f of htmlFiles) {
    const html = readFileSync(f, 'utf8');
    if (base) {
      for (const m of html.matchAll(/\b(?:href|src|poster|action)="(\/(?!\/)[^"]*)"/g)) {
        if (m[1] !== base && !m[1].startsWith(`${base}/`)) findings.push(`${rel(f)}: ${m[1]} tanpa base ${base}`);
      }
      for (const m of html.matchAll(/url\((?:&quot;|"|')?(\/(?!\/)[^)"']*)/g)) {
        if (!m[1].startsWith(`${base}/`)) findings.push(`${rel(f)}: url(${m[1]}) tanpa base`);
      }
    }
    if (/localhost|127\.0\.0\.1/.test(html)) findings.push(`${rel(f)}: memuat localhost`);
  }
  report(`semua tautan dan aset internal memakai base "${base || '/'}", tanpa localhost`, findings);
  if (siteConfig.site) pass(`site = ${siteConfig.site}`); else fail('site belum diisi');
}

// ---------- 8. simbol
section('simbol TM dan R');
report('tanpa simbol TM atau R', [...distTexts, ...sources].filter(({ text, file }) => /[™®]/.test(text) && !file.endsWith('predeploy-check.mjs')).map((x) => x.file));

// ---------- 9. git
section('git');
if (args.has('--skip-git')) warn('dilewati (--skip-git)');
else {
  const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
  try {
    const email = git('config', '--local', 'user.email');
    const name = git('config', '--local', 'user.name');
    if (/@users\.noreply\.github\.com$/.test(email)) pass('user.email lokal memakai alamat noreply GitHub'); else fail('user.email lokal bukan alamat noreply GitHub');
    if (name) pass(`user.name lokal terisi (${name})`); else fail('user.name lokal kosong');
    const authors = new Set(git('log', 'HEAD', '--format=%ae%n%ce').split('\n').filter(Boolean));
    const foreign = [...authors].filter((a) => a !== email && !/noreply@(github|anthropic)\.com$/.test(a));
    report('semua commit di HEAD memakai email noreply', foreign.map((a) => a.replace(/^[^@]{2}/, '**')));
    const listPath = path.join(root, 'scripts/forbidden.local.json');
    if (existsSync(listPath) && !args.has('--skip-words')) {
      const list = JSON.parse(readFileSync(listPath, 'utf8'));
      const hist = [];
      for (const w of [...(list.emails ?? []), ...(list.everywhere ?? [])]) {
        const inDiffs = git('log', 'HEAD', '--format=%h', '-i', '-G', w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const inMsgs = git('log', 'HEAD', '--format=%h', '-i', '--fixed-strings', `--grep=${w}`);
        if (inDiffs || inMsgs) hist.push(`"${w}" di commit ${(inDiffs + '\n' + inMsgs).trim().split('\n').filter(Boolean).slice(0, 3).join(', ')}`);
      }
      report('riwayat commit (isi dan pesan) bebas dari email pribadi dan kata terlarang', hist);
    }
    const tracked = git('ls-files').split('\n');
    const leaked = tracked.filter((f) => /^CLAUDE\.local\.md$|^scripts\/forbidden\.local\.json$|^\.env(\.|$)/.test(f) && f !== '.env.example');
    report('berkas lokal tidak dilacak git', leaked);
  } catch (e) {
    fail(`pemeriksaan git gagal: ${String(e.message).split('\n')[0]}`);
  }
}

// ---------- 10. admin hanya untuk dev
section('admin tidak ikut produksi');
{
  const findings = [];
  for (const f of distFiles) if (rel(f).split(path.sep).includes('admin')) findings.push(`${rel(f)}: folder admin ada di dist`);
  for (const { file, text } of distTexts) {
    if (/sveltia|unpkg\.com\/@sveltia|netlify-cms|decap-cms/i.test(text)) findings.push(`${file}: rujukan ke CDN atau skrip admin`);
  }
  report('dist tidak berisi folder admin atau rujukan ke CDN admin', findings);
}

// ---------- 11. metadata gambar (EXIF, XMP, IPTC, GPS)
const imageExt = /\.(jpe?g|png|webp|avif|tiff?|heic)$/i;
const assetDirs = ['src/assets', 'public'].map((d) => path.join(root, d)).filter((d) => existsSync(d));
const imageFiles = [...distFiles, ...assetDirs.flatMap(walk)].filter((f) => imageExt.test(f));
// Cari tag GPSInfo (0x8825) di IFD0 pada blok EXIF.
const hasGps = (exif) => {
  try {
    const t = exif.subarray(exif.indexOf('Exif\0\0') === 0 ? 6 : 0);
    const le = t.toString('ascii', 0, 2) === 'II';
    const u16 = (o) => (le ? t.readUInt16LE(o) : t.readUInt16BE(o));
    const u32 = (o) => (le ? t.readUInt32LE(o) : t.readUInt32BE(o));
    const ifd = u32(4);
    for (let i = 0, n = u16(ifd); i < n; i++) if (u16(ifd + 2 + i * 12) === 0x8825) return true;
  } catch { /* blok tidak terbaca: anggap tanpa GPS, metadata tetap dilaporkan */ }
  return false;
};
section('metadata gambar');
{
  const findings = [];
  for (const f of imageFiles) {
    const m = await sharp(f).metadata().catch(() => null);
    if (!m) continue;
    const kinds = [m.exif && (hasGps(m.exif) ? 'EXIF dengan GPS' : 'EXIF'), m.xmp && 'XMP', m.iptc && 'IPTC'].filter(Boolean);
    if (kinds.length) findings.push(`${rel(f)}: ${kinds.join(', ')}`);
  }
  report(`${imageFiles.length} gambar (dist, src/assets, public) tanpa EXIF, XMP, IPTC, atau GPS`, findings, 12);
}

// ---------- 12. nama berkas aset
section('nama berkas aset');
{
  // Pola nama bawaan perangkat atau aplikasi, serta tanggal dan jam di nama.
  const deviceNames = [
    /whatsapp|telegram|signal-\d|^wa\d{4}/i,
    /^(img|dsc[nf]?|pxl|mvimg|vid|dcim)[-_ ]?\d/i,
    /^(screenshot|screen ?shot|cleanshot|simulator screen)/i,
    /\d{4}[-_.]?\d{2}[-_.]?\d{2}[-_. ]*(at |t)?\d{2}[.:_-]?\d{2}([.:_-]?\d{2})?/i,
    /\bat \d{1,2}[.:]\d{2}/i,
    /\(\d+\)\.\w+$/,
  ];
  const mediaExt = /\.(jpe?g|png|webp|avif|gif|svg|tiff?|heic|mp4|webm|mov|m4v|vtt)$/i;
  const names = [...distFiles, ...assetDirs.flatMap(walk)].filter((f) => mediaExt.test(f));
  const findings = names.filter((f) => deviceNames.some((re) => re.test(path.basename(f)))).map(rel);
  report(`${names.length} berkas aset publik tanpa pola nama bawaan perangkat atau aplikasi`, findings, 12);
}

console.log(failures ? `\nHASIL: GAGAL (${failures} pemeriksaan tidak lolos). Jangan deploy.` : '\nHASIL: LOLOS. Aman untuk deploy.');
process.exit(failures ? 1 : 0);
