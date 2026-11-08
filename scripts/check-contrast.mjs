// Cek kontras WCAG AA untuk dua tema, kandidat aksen, teks hero di atas scrim, dan teks di atas kedua varian
// kaca (tema dan on-media) terhadap bagian paling terang DAN paling gelap dari poster tiap tema
// (kondisi terburuk di belakang kapsul). Jalankan: npm run check:contrast
import sharp from 'sharp';
import { siteConfig } from '../src/site.config.ts';

const THRESHOLD = 4.5;
let failed = 0;
let total = 0;

const toRgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const luminance = ([r, g, b]) => {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const mix = (top, bottom, alpha) => top.map((v, i) => v * alpha + bottom[i] * (1 - alpha));

const check = (label, fg, bg) => {
  const r = ratio(fg, bg);
  const ok = r >= THRESHOLD;
  total++;
  if (!ok) failed++;
  console.log(`${ok ? 'OK   ' : 'GAGAL'} ${label} ${r.toFixed(2)}`);
};

// Lebar kolom teks hero di layar lebar (grid 1.3fr : 1fr di container 86rem), sebagai bagian dari lebar poster.
const TEXT_ZONE = 0.56;

// Sel paling terang dan paling gelap pada poster (grid 32x18, dirata-ratakan sehingga mendekati efek blur).
async function extremes(posterPath, maxX = 1) {
  const { data, info } = await sharp(new URL(`../public/${posterPath}`, import.meta.url).pathname)
    .resize(32, 18, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let brightest = [255, 255, 255];
  let darkest = [0, 0, 0];
  let hi = -1;
  let lo = 2;
  for (let i = 0; i < info.width * info.height; i++) {
    // maxX membatasi ke bagian kiri poster (kolom teks hero di layar lebar).
    if ((i % info.width) / info.width >= maxX) continue;
    const px = [data[i * info.channels], data[i * info.channels + 1], data[i * info.channels + 2]];
    const l = luminance(px);
    if (l > hi) { hi = l; brightest = px; }
    if (l < lo) { lo = l; darkest = px; }
  }
  return { brightest, darkest };
}

for (const [name, s] of Object.entries(siteConfig.themes)) {
  const hero = siteConfig.hero[name];
  const { brightest, darkest } = await extremes(hero.poster);
  console.log(`\n== Tema ${name}: poster paling terang rgb(${brightest.map(Math.round)}), paling gelap rgb(${darkest.map(Math.round)})`);

  for (const sf of ['bg', 'raised', 'sunken']) {
    check(`${name} text/${sf}`, toRgb(s.text), toRgb(s[sf]));
    check(`${name} textMuted/${sf}`, toRgb(s.textMuted), toRgb(s[sf]));
  }
  for (const [key, acc] of Object.entries(siteConfig.accents)) {
    const a = acc[name];
    for (const sf of ['bg', 'raised']) {
      check(`${name} aksen ${key} accent/${sf}`, toRgb(a.accent), toRgb(s[sf]));
      check(`${name} aksen ${key} companion/${sf}`, toRgb(a.companion), toRgb(s[sf]));
    }
    check(`${name} aksen ${key} onAccent/accent`, toRgb(a.onAccent), toRgb(a.accent));
    check(`${name} aksen ${key} onCompanion/companion`, toRgb(a.onCompanion), toRgb(a.companion));
  }

  for (const [label, bg] of [['terang', brightest], ['gelap', darkest]]) {
    // Kaca varian tema: raised translusen di atas poster.
    const glass = mix(toRgb(s.raised), bg, siteConfig.glass[name] / 100);
    check(`${name} kaca-tema text/glass di atas poster ${label}`, toRgb(s.text), glass);
    check(`${name} kaca-tema textMuted/glass di atas poster ${label}`, toRgb(s.textMuted), glass);
    for (const [key, acc] of Object.entries(siteConfig.accents)) {
      check(`${name} kaca-tema aksen ${key}/glass di atas poster ${label}`, toRgb(acc[name].accent), glass);
    }

    // Kaca varian on-media: warna kaca tema ini dengan teks hero tema ini.
    const gm = siteConfig.glassMedia[name];
    const mg = mix(toRgb(gm.color), bg, gm.pct / 100);
    check(`${name} kaca-media text/glass di atas poster ${label}`, toRgb(hero.text), mg);
    check(`${name} kaca-media textMuted/glass di atas poster ${label}`, toRgb(hero.textMuted), mg);
    for (const [key, acc] of Object.entries(siteConfig.accents)) {
      check(`${name} kaca-media aksen ${key}/glass di atas poster ${label}`, toRgb(acc[name].accent), mg);
    }

    // Hero, layar sempit (<64rem): teks menutupi seluruh poster, hanya scrim minimum sempit yang dihitung (gradasi diabaikan).
    const narrow = mix(toRgb(hero.scrimColor), bg, hero.scrimNarrow);
    check(`${name} hero sempit text/poster+scrim ${label}`, toRgb(hero.text), narrow);
    check(`${name} hero sempit textMuted/poster+scrim ${label}`, toRgb(hero.textMuted), narrow);
  }

  // Hero, layar lebar: teks hanya di kolom kiri (sampai ${TEXT_ZONE * 100}% lebar), di atas scrim minimum ditambah gradasi kiri
  // (0% = scrimLeft[0], 42% = scrimLeft[1], 80% = 0). Dihitung di tepi kanan kolom teks, tempat gradasi paling tipis.
  const zone = await extremes(hero.poster, TEXT_ZONE);
  const g = hero.scrimLeft[1] * Math.max(0, (0.8 - TEXT_ZONE) / (0.8 - 0.42));
  const alpha = g + hero.scrim * (1 - g);
  for (const [label, bg] of [['terang', zone.brightest], ['gelap', zone.darkest]]) {
    const scrimmed = mix(toRgb(hero.scrimColor), bg, alpha);
    check(`${name} hero lebar text/poster kiri+scrim ${label}`, toRgb(hero.text), scrimmed);
    check(`${name} hero lebar textMuted/poster kiri+scrim ${label}`, toRgb(hero.textMuted), scrimmed);
  }
}

console.log(`\n${total - failed} dari ${total} pasangan lolos (batas ${THRESHOLD}:1).`);
if (failed) {
  console.error(`${failed} pasangan gagal.`);
  process.exit(1);
}
