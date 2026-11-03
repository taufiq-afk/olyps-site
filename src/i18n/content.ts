import { getCollection } from 'astro:content';
import { featured, FEATURED_MAX } from '../data/featured';
import { siteLangs, type Lang } from '../site.config';

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

let validation: Promise<void> | undefined;

/** Validasi konten saat build: relasi, penulis publikasi, kelengkapan bahasa, dan daftar unggulan. */
export function assertContentValid(): Promise<void> {
  validation ??= (async () => {
    const all = (await loadAll()) as unknown as Record<Kind, Any[]>;
    const errors: string[] = [];
    const keysOf = (kind: Kind) => new Set(all[kind].map((e) => e.data.translationKey as string));

    for (const kind of KINDS) {
      for (const entry of all[kind]) {
        for (const [target, field] of Object.entries(REL_FIELDS[kind]) as [Kind, string][]) {
          for (const key of (entry.data[field] ?? []) as string[]) {
            if (!keysOf(target).has(key)) errors.push(`${kind}/${entry.id}: ${field} merujuk "${key}" yang tidak ada di koleksi ${target}`);
          }
        }
        if (kind === 'publications') {
          for (const author of entry.data.authors as { name: string; personKey?: string }[]) {
            if (author.personKey && !keysOf('people').has(author.personKey)) {
              errors.push(`publications/${entry.id}: penulis "${author.name}" memakai personKey "${author.personKey}" yang tidak ada di people`);
            }
          }
        }
      }
      // Setiap translationKey harus ada di semua bahasa.
      for (const key of keysOf(kind)) {
        for (const lang of siteLangs) {
          if (!all[kind].some((e) => e.data.translationKey === key && e.data.lang === lang)) {
            errors.push(`${kind}: translationKey "${key}" tidak punya versi ${lang}`);
          }
        }
      }
    }

    if (featured.length > FEATURED_MAX) errors.push(`featured: ${featured.length} butir, maksimum ${FEATURED_MAX}`);
    if (new Set(featured).size !== featured.length) errors.push('featured: ada key ganda');
    for (const key of featured) {
      if (!keysOf('projects').has(key)) errors.push(`featured: key "${key}" tidak ada di koleksi projects`);
    }

    if (errors.length) throw new Error(`Konten tidak valid:\n- ${errors.join('\n- ')}`);
  })();
  return validation;
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
  const entries = await getCollection(kind, (entry) => entry.data.lang === lang && isPublished(entry.data));
  return entries.sort((a, b) => {
    const da = a.data as { order: number; year?: number };
    const db = b.data as { order: number; year?: number };
    if (kind === 'publications' && da.year !== db.year) return (db.year ?? 0) - (da.year ?? 0);
    return da.order - db.order;
  });
}

/** Proyek unggulan sesuai urutan di src/data/featured.ts. */
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
    const localized = all[k].filter((e) => e.data.lang === lang && isPublished(e.data as { draft: boolean; placeholder: boolean })).sort((a, b) => a.data.order - b.data.order);
    for (const entry of localized) {
      if (!linked.has(`${k}:${entry.data.translationKey}`)) continue;
      items.push({ kind: k, key: entry.data.translationKey, title: entry.data.title ?? entry.data.name, href: hrefFor(k, entrySlug(entry.id), lang) });
    }
  }
  return items;
}
