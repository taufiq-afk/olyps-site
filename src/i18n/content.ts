import { getCollection } from 'astro:content';
import featuredData from '../data/featured.json';
import { siteLangs, type Lang } from '../site.config';

// Daftar unggulan: translationKey di koleksi projects, berurutan, maksimum 3. Sumber: src/data/featured.json.
const featured = featuredData as string[];
const FEATURED_MAX = 3;

export type Kind = 'research' | 'projects' | 'publications' | 'people';
const KINDS: Kind[] = ['research', 'projects', 'publications', 'people'];

// Field relasi di frontmatter per koleksi. Relasi dua arah: cukup dideklarasikan di salah satu sisi.
const REL_FIELDS: Record<Kind, Partial<Record<Kind, string>>> = {
  research: { projects: 'relatedProjects', publications: 'relatedPublications', people: 'relatedPeople' },
  projects: { research: 'relatedResearch', publications: 'relatedPublications', people: 'relatedPeople' },
  publications: { research: 'relatedResearch', projects: 'relatedProjects', people: 'relatedPeople' },
  people: { research: 'relatedResearch', projects: 'relatedProjects', publications: 'relatedPublications' },
};

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Id entri berbentuk "en/nama-file". Slug URL adalah bagian terakhirnya. */
export const entrySlug = (id: string) => id.split('/').pop() as string;

const loadAll = async () => ({
  research: await getCollection('research'),
  projects: await getCollection('projects'),
  publications: await getCollection('publications'),
  people: await getCollection('people'),
});

type Any = { id: string; data: Record<string, any> };

export interface BrokenRelation {
  /** Jenis halaman terkait: koleksi pemilik berkas, atau home untuk daftar unggulan. */
  scope: Kind | 'home';
  file: string;
  field: string;
  key: string;
  /** Pesan lengkap dengan petunjuk perbaikan. */
  message: string;
}

/** Teks atau entri yang belum ada di salah satu bahasa. Di dev ditampilkan dalam bahasa lain dengan banner. */
export interface MissingLang {
  scope: Kind | 'all';
  /** Path berkas yang kurang. */
  file: string;
  lang: Lang;
  /** Path berkas pasangan di bahasa lain, dipakai sebagai pengganti di dev. */
  fallback: string;
  message: string;
}

interface Validation { errors: string[]; broken: BrokenRelation[]; missing: MissingLang[] }

const TEXT_COLLECTIONS = ['site', 'home', 'pages', 'footer', 'contact'] as const;

let validation: Promise<Validation> | undefined;
const warned = new Set<string>();

const TARGET_LABEL: Record<Kind, string> = { research: 'research', projects: 'projects', publications: 'publications', people: 'people' };

async function computeValidation(): Promise<Validation> {
  const all = (await loadAll()) as unknown as Record<Kind, Any[]>;
  const errors: string[] = [];
  const broken: BrokenRelation[] = [];
  const missing: MissingLang[] = [];
  const keysOf = (kind: Kind) => new Set(all[kind].map((e) => e.data.translationKey as string));
  const fileOf = (kind: Kind, entry: Any) => `src/content/${kind}/${entry.id}.md`;
  const addBroken = (scope: BrokenRelation['scope'], file: string, field: string, key: string, where: string, fix: string) =>
    broken.push({ scope, file, field, key, message: `${file}: field "${field}" menunjuk "${key}" yang tidak ada di ${where}. Perbaikan: ${fix}` });

  for (const kind of KINDS) {
    for (const entry of all[kind]) {
      for (const [target, field] of Object.entries(REL_FIELDS[kind]) as [Kind, string][]) {
        for (const key of (entry.data[field] ?? []) as string[]) {
          if (!keysOf(target).has(key)) {
            addBroken(kind, fileOf(kind, entry), field, key, `koleksi ${TARGET_LABEL[target]}`,
              `hapus "${key}" dari daftar ${field} di berkas itu, atau buat entri ${TARGET_LABEL[target]} dengan translationKey "${key}" (di admin: buka entri tersebut, lalu hapus butir "${key}" dari field relasinya).`);
          }
        }
      }
      if (kind === 'publications') {
        for (const author of entry.data.authors as { name: string; personKey?: string }[]) {
          if (author.personKey && !keysOf('people').has(author.personKey)) {
            addBroken(kind, fileOf(kind, entry), `authors (${author.name}).personKey`, author.personKey, 'koleksi people',
              `kosongkan Member pada penulis "${author.name}" (nama tetap tampil sebagai teks biasa), atau buat entri people dengan translationKey "${author.personKey}".`);
          }
        }
      }
    }
    // Setiap translationKey harus ada di semua bahasa. Path berkas yang kurang mengikuti nama berkas pasangannya.
    for (const key of keysOf(kind)) {
      for (const lang of siteLangs) {
        if (!all[kind].some((e) => e.data.translationKey === key && e.data.lang === lang)) {
          const other = all[kind].find((e) => e.data.translationKey === key)!;
          const name = entrySlug(other.id);
          missing.push({ scope: kind, lang, file: `src/content/${kind}/${lang}/${name}.md`, fallback: fileOf(kind, other),
            message: `src/content/${kind}/${lang}/${name}.md tidak ada (translationKey "${key}" hanya punya versi ${other.data.lang}). Perbaikan: buat berkas itu sebagai terjemahan dari ${fileOf(kind, other)}.` });
        }
      }
    }
  }
  // Teks situs (site, home, pages, footer, contact) wajib ada di semua bahasa.
  for (const coll of TEXT_COLLECTIONS) {
    const entries = (await getCollection(coll)) as unknown as Any[];
    for (const key of new Set(entries.map((e) => e.data.translationKey as string))) {
      for (const lang of siteLangs) {
        if (entries.some((e) => e.data.translationKey === key && e.data.lang === lang)) continue;
        const other = entries.find((e) => e.data.translationKey === key)!;
        const name = entrySlug(other.id);
        missing.push({ scope: 'all', lang, file: `src/content/${coll}/${lang}/${name}.md`, fallback: `src/content/${coll}/${other.data.lang}/${name}.md`,
          message: `src/content/${coll}/${lang}/${name}.md tidak ada (hanya ada versi ${other.data.lang}). Perbaikan: buat berkas itu sebagai terjemahan dari src/content/${coll}/${other.data.lang}/${name}.md.` });
      }
    }
  }

  // leadsTo menunjuk entri project, research, atau publication: key harus ada dan tidak ambigu antar koleksi.
  const leadsKinds: Kind[] = ['projects', 'research', 'publications'];
  const leadsKeys = new Set<string>();
  for (const kind of leadsKinds) {
    for (const key of keysOf(kind)) {
      if (leadsKeys.has(key)) errors.push(`translationKey "${key}" dipakai di lebih dari satu koleksi (project, research, publication), leadsTo menjadi ambigu. Perbaikan: ganti translationKey salah satunya.`);
      leadsKeys.add(key);
    }
  }
  for (const kind of ['projects', 'research'] as Kind[]) {
    for (const entry of all[kind]) {
      for (const key of (entry.data.leadsTo ?? []) as string[]) {
        if (!leadsKeys.has(key)) {
          addBroken(kind, fileOf(kind, entry), 'leadsTo', key, 'project, research, atau publication',
            `hapus "${key}" dari daftar leadsTo di berkas itu, atau buat entri dengan translationKey "${key}".`);
        }
      }
    }
  }

  if (featured.length > FEATURED_MAX) errors.push(`src/data/featured.json: ${featured.length} butir, maksimum ${FEATURED_MAX}. Perbaikan: hapus butir hingga tersisa ${FEATURED_MAX}.`);
  if (new Set(featured).size !== featured.length) errors.push('src/data/featured.json: ada key ganda. Perbaikan: hapus butir yang sama.');
  for (const key of featured) {
    if (!keysOf('projects').has(key)) {
      addBroken('home', 'src/data/featured.json', 'featured', key, 'koleksi projects',
        `hapus "${key}" dari daftar di berkas itu (di admin: Home, Featured projects), atau buat proyek dengan translationKey "${key}".`);
    }
  }
  return { errors, broken, missing };
}

/**
 * Validasi konten. Daftar unggulan terlalu panjang atau ganda selalu menggagalkan build.
 * Versi bahasa yang hilang: di dev ditampilkan dalam bahasa lain dengan banner (getMissingLang), di build produksi menjadi kesalahan.
 * Relasi yang putus: di dev dilewati dengan peringatan di konsol dan banner halaman (getBrokenRelations), di build produksi
 * (dan npm run check:predeploy) tetap menjadi kesalahan dengan petunjuk perbaikan.
 */
export async function assertContentValid(): Promise<void> {
  // Di dev hitung ulang setiap kali agar perbaikan di admin langsung terbaca.
  if (import.meta.env.DEV || !validation) validation = computeValidation();
  const { errors, broken, missing } = await validation;
  const all = [...errors];
  if (import.meta.env.DEV) {
    for (const b of broken) {
      if (!warned.has(b.message)) { warned.add(b.message); console.warn(`[konten] relasi putus dilewati: ${b.message}`); }
    }
    for (const m of missing) {
      if (!warned.has(m.message)) { warned.add(m.message); console.warn(`[konten] versi bahasa hilang, memakai ${m.fallback}: ${m.message}`); }
    }
  } else {
    all.push(...broken.map((b) => b.message), ...missing.map((m) => m.message));
  }
  if (all.length) throw new Error(`Konten tidak valid (${all.length} masalah):\n- ${all.join('\n- ')}`);
}

/** Teks atau entri yang belum ada di bahasa halaman, untuk banner dev. Kosong di build produksi. */
export async function getMissingLang(scope: Kind | 'all', lang: Lang): Promise<MissingLang[]> {
  if (!import.meta.env.DEV) return [];
  await assertContentValid();
  return (await validation!).missing.filter((m) => (m.scope === scope || m.scope === 'all') && m.lang === lang);
}

/** Relasi putus untuk banner dev pada halaman terkait. Kosong di build produksi (di sana semuanya sudah menjadi kesalahan). */
export async function getBrokenRelations(scope: BrokenRelation['scope']): Promise<BrokenRelation[]> {
  if (!import.meta.env.DEV) return [];
  await assertContentValid();
  return (await validation!).broken.filter((b) => b.scope === scope);
}

/**
 * Entri satu bahasa. Di dev, entri yang belum punya versi bahasa ini diganti dengan versi bahasa lain (banner menyebut berkasnya).
 * Di build produksi tidak ada pengganti: validasi sudah menggagalkan build.
 */
function entriesIn(entries: Any[], lang: Lang): Any[] {
  const own = entries.filter((e) => e.data.lang === lang);
  if (!import.meta.env.DEV) return own;
  const have = new Set(own.map((e) => e.data.translationKey));
  const extra = entries.filter((e) => e.data.lang !== lang && !have.has(e.data.translationKey));
  return [...own, ...extra.filter((e, i) => extra.findIndex((x) => x.data.translationKey === e.data.translationKey) === i)];
}

/**
 * Urutan tampil: order naik (kosong terakhir), lalu startDate terbaru (publikasi: tahun terbaru), lalu judul atau nama.
 * Untuk publikasi order menimpa urutan tahun.
 */
export function compareEntries(a: { data: Record<string, any> }, b: { data: Record<string, any> }): number {
  const oa = a.data.order as number | undefined;
  const ob = b.data.order as number | undefined;
  if (oa !== ob) {
    if (oa === undefined) return 1;
    if (ob === undefined) return -1;
    return oa - ob;
  }
  const ka = a.data.year !== undefined ? String(a.data.year) : (a.data.startDate as string | undefined);
  const kb = b.data.year !== undefined ? String(b.data.year) : (b.data.startDate as string | undefined);
  if (ka !== kb) {
    if (ka === undefined) return 1;
    if (kb === undefined) return -1;
    return kb.localeCompare(ka);
  }
  return String(a.data.title ?? a.data.name ?? '').localeCompare(String(b.data.title ?? b.data.name ?? ''));
}

/** Entri contoh berlabel placeholder tidak ikut tayang pada build produksi. Di dev tetap tampil. */
const isPublished = (data: { draft: boolean; placeholder: boolean }) => !data.draft && !(import.meta.env.PROD && data.placeholder);

/**
 * Entri satu bahasa yang tayang, urut menurut `order` (publikasi: tahun terbaru dulu).
 * Pada build produksi entri `placeholder: true` disaring di sini, sehingga tidak muncul di indeks, hitungan,
 * relasi, footer, dan halaman detailnya tidak dibangun (getStaticPaths memakai fungsi ini).
 */
export async function getLocalized<K extends Kind>(kind: K, lang: Lang) {
  await assertContentValid();
  const entries = entriesIn((await getCollection(kind)) as unknown as Any[], lang).filter((e) => isPublished(e.data as { draft: boolean; placeholder: boolean }));
  return (entries as unknown as Awaited<ReturnType<typeof getCollection<K>>>).sort(compareEntries);
}

/** Proyek unggulan sesuai urutan di src/data/featured.json. */
export async function getFeatured(lang: Lang) {
  const projects = await getLocalized('projects', lang);
  const ordered = featured.map((key) => projects.find((p) => p.data.translationKey === key)).filter((p): p is NonNullable<typeof p> => !!p);
  return ordered;
}

export function hrefFor(kind: Kind, slug: string, lang: Lang): string {
  const root = `${base}/${lang}/${kind}/`;
  return kind === 'publications' ? `${root}#${slug}` : `${root}${slug}/`;
}

export interface RelatedItem { kind: Kind; key: string; title: string; href: string }

/** Entri terkait (dua arah) untuk satu entri, sudah dalam bahasa yang diminta. */
export async function getRelated(kind: Kind, key: string, lang: Lang): Promise<RelatedItem[]> {
  await assertContentValid();
  const all = (await loadAll()) as unknown as Record<Kind, Any[]>;
  const linked = new Set<string>();
  const connect = (ka: Kind, a: string, kb: Kind, b: string) => {
    if (ka === kind && a === key) linked.add(`${kb}:${b}`);
    if (kb === kind && b === key) linked.add(`${ka}:${a}`);
  };
  for (const ka of KINDS) {
    for (const entry of all[ka]) {
      for (const [kb, field] of Object.entries(REL_FIELDS[ka]) as [Kind, string][]) {
        for (const other of (entry.data[field] ?? []) as string[]) connect(ka, entry.data.translationKey, kb, other);
      }
      if (ka === 'publications') {
        for (const author of entry.data.authors as { personKey?: string }[]) {
          if (author.personKey) connect('publications', entry.data.translationKey, 'people', author.personKey);
        }
      }
    }
  }
  const items: RelatedItem[] = [];
  for (const k of KINDS) {
    const localized = entriesIn(all[k], lang).filter((e) => isPublished(e.data as { draft: boolean; placeholder: boolean })).sort(compareEntries);
    for (const entry of localized) {
      if (!linked.has(`${k}:${entry.data.translationKey}`)) continue;
      items.push({ kind: k, key: entry.data.translationKey, title: entry.data.title ?? entry.data.name, href: hrefFor(k, entrySlug(entry.id), lang) });
    }
  }
  return items;
}

export interface LeadsToItem { kind: Kind; title: string; href: string }

/** Tujuan kelanjutan (leadsTo) yang tayang, dalam bahasa yang diminta. Entri placeholder pada produksi dilewati. */
export async function getLeadsTo(keys: string[], lang: Lang): Promise<LeadsToItem[]> {
  await assertContentValid();
  const all = (await loadAll()) as unknown as Record<Kind, Any[]>;
  const items: LeadsToItem[] = [];
  for (const key of keys) {
    for (const kind of ['projects', 'research', 'publications'] as Kind[]) {
      const entry = entriesIn(all[kind], lang).find((e) => e.data.translationKey === key && isPublished(e.data as { draft: boolean; placeholder: boolean }));
      if (entry) items.push({ kind, title: entry.data.title, href: hrefFor(kind, entrySlug(entry.id), lang) });
    }
  }
  return items;
}

/** Data kontak satu bahasa, sumber tunggal halaman Kontak dan footer. */
export async function getContact(lang: Lang) {
  return getText('contact', lang, 'contact');
}

const MONTH_LOCALE: Record<Lang, string> = { en: 'en-US', id: 'id-ID' };

/** "2026-11" menjadi "Nov 2026" (EN) atau "Nov 2026" (ID) sesuai bahasa. */
export function formatMonth(value: string, lang: Lang): string {
  const [y, m] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(MONTH_LOCALE[lang], { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

type TextCollection = 'site' | 'home' | 'pages' | 'footer' | 'contact';

/** Satu entri teks situs (src/content/<koleksi>/<lang>/<berkas>.md). Entri yang hilang menggagalkan build, tanpa fallback. */
async function getText<C extends TextCollection>(collection: C, lang: Lang, key: string) {
  await assertContentValid();
  const entries = await getCollection(collection);
  // Di dev, teks yang belum ada diganti dengan bahasa lain (banner menyebut berkasnya). Di produksi validasi sudah gagal lebih dulu.
  const entry = entries.find((e) => e.data.lang === lang && e.data.translationKey === key)
    ?? (import.meta.env.DEV ? entries.find((e) => e.data.translationKey === key) : undefined);
  if (!entry) throw new Error(`Konten tidak valid:\n- src/content/${collection}/${lang}/${key}.md tidak ada (teks situs wajib ada di kedua bahasa)`);
  return entry.data;
}

/** Nama situs, label menu, deskripsi meta (admin: Footer and Global). */
export const getSite = (lang: Lang) => getText('site', lang, 'site');
/** Teks halaman Home (admin: Home). */
export const getHome = (lang: Lang) => getText('home', lang, 'home');
/** Judul, pengantar, dan keadaan kosong halaman indeks (admin: Page titles and intros). */
export const getPage = (key: 'projects' | 'research' | 'publications' | 'people', lang: Lang) => getText('pages', lang, key);
/** Teks footer (admin: Footer and Global). */
export const getFooter = (lang: Lang) => getText('footer', lang, 'footer');

/** Label menu untuk satu kunci navigasi. */
export async function getNavLabel(key: 'projects' | 'research' | 'publications' | 'people' | 'contact', lang: Lang): Promise<string> {
  const site = await getSite(lang);
  return { projects: site.navProjects, research: site.navResearch, publications: site.navPublications, people: site.navPeople, contact: site.navContact }[key];
}
