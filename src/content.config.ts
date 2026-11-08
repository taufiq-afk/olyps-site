import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Frontmatter datar dan terstruktur agar siap dipakai panel admin nanti.
// translationKey menghubungkan versi en dan id, dan menjadi kunci relasi antar koleksi.
// placeholder: true menampilkan badge dan menyembunyikan entri dari Home pada build produksi.
// Relasi (relatedX) berisi daftar translationKey. Relasi bersifat dua arah dan divalidasi saat build
// (lihat src/i18n/content.ts).
// Sveltia menulis string kosong ('') atau null untuk field opsional yang dikosongkan. Keduanya dianggap tidak diisi.
const opt = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());

const common = {
  lang: z.enum(['en', 'id']),
  translationKey: z.string(),
  placeholder: z.boolean().default(true),
  draft: z.boolean().default(false),
  // Urutan tampil: angka kecil lebih dulu, kosong terakhir (lihat compareEntries di src/i18n/content.ts).
  order: opt(z.number()),
};
const keys = z.array(z.string()).default([]);


type ImageFn = Parameters<Extract<Parameters<typeof defineCollection>[0]['schema'], (...a: any[]) => any>>[0]['image'];

// Siklus hidup untuk Research dan Projects: status, rentang bulan (YYYY-MM), dan kelanjutan ke entri atau tautan lain.
// Aturan lintas field ada di checkLifecycle. Key leadsTo yang tidak ada divalidasi di assertContentValid.
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'gunakan format YYYY-MM');
export const STATUSES = ['concept', 'exploratory', 'ongoing', 'paused', 'completed'] as const;
const lifecycle = {
  status: z.enum(STATUSES),
  startDate: opt(month),
  endDate: opt(month),
  leadsTo: keys,
  leadsToUrl: opt(z.string().url()),
};
const checkLifecycle = (d: { translationKey: string; status: string; startDate?: string; endDate?: string; leadsTo: string[] }, ctx: z.RefinementCtx) => {
  if (d.status === 'completed' && !d.endDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'endDate wajib bila status completed' });
  if (d.startDate && d.endDate && d.endDate < d.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'endDate tidak boleh sebelum startDate' });
  if (d.leadsTo.includes(d.translationKey)) ctx.addIssue({ code: 'custom', path: ['leadsTo'], message: 'leadsTo tidak boleh menunjuk dirinya sendiri' });
};

const collection = <T extends z.ZodRawShape>(name: string, shape: T | ((image: ImageFn) => T), refine?: (d: any, ctx: z.RefinementCtx) => void) =>
  defineCollection({
    loader: glob({ base: `./src/content/${name}`, pattern: '**/*.md' }),
    schema: ({ image }) => {
      const object = z.object({ ...common, ...(typeof shape === 'function' ? shape(image) : shape) });
      return refine ? object.superRefine(refine) : object;
    },
  });

// Research: pertanyaan atau hipotesis, metode, temuan yang bisa dikutip (ditulis di badan Markdown).
const research = collection('research', {
  title: z.string(),
  summary: z.string(),
  area: opt(z.enum(['health', 'environment'])),
  ...lifecycle,
  relatedProjects: keys,
  relatedPublications: keys,
  relatedPeople: keys,
}, checkLifecycle);

// Project: tujuan, cakupan, roadmap, dampak (ditulis di badan Markdown).
const projects = collection('projects', (image) => ({
  title: z.string(),
  summary: z.string(),
  ...lifecycle,
  // Gambar detail proyek: unggahan ke src/assets/projects (diproses Astro). Kosong: slot media tidak ditampilkan.
  image: opt(image()),
  imageAlt: opt(z.string()),
  imageCaption: opt(z.string()),
  // Klip di public/ (nama dasar tanpa ekstensi) dan berkas VTT untuk bahasa entri ini. Belum ada unggahan video.
  mediaVideo: opt(z.string()),
  mediaCaptions: opt(z.string()),
  relatedResearch: keys,
  relatedPublications: keys,
  relatedPeople: keys,
}), checkLifecycle);

const people = collection('people', (image) => ({
  name: z.string(),
  role: z.string(),
  bio: z.string(),
  skills: z.array(z.string()).default([]),
  // Institusi hanya boleh diisi di sini, dari teks resmi pemilik situs.
  affiliations: z.array(z.string()).default([]),
  // Tautan profil opsional (mis. LinkedIn, Google Scholar, GitHub pribadi). Kosong: tidak dirender.
  links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  // Foto opsional, path relatif ke berkas ini menuju src/assets/people/ (diproses Astro: diubah ukuran dan format).
  // Hanya dengan izin orangnya. Kosong: avatar tetap inisial.
  photo: opt(image()),
  relatedResearch: keys,
  relatedProjects: keys,
  relatedPublications: keys,
}));

const publications = collection('publications', {
  title: z.string(),
  // personKey (translationKey di koleksi people) menaut penulis ke halaman profil. Tanpa personKey tampil sebagai teks biasa.
  authors: z.array(z.object({ name: z.string(), personKey: opt(z.string()) })),
  venue: z.string(),
  year: z.number(),
  pages: opt(z.string()),
  doi: opt(z.string()),
  relatedResearch: keys,
  relatedProjects: keys,
  relatedPeople: keys,
});

// Kontak: satu entri per bahasa (src/content/contact/<lang>/contact.md). Sumber tunggal halaman Kontak dan kolom Connect di footer.
// email opsional dan dibiarkan kosong: situs tidak menampilkan email kecuali diisi.
const contact = defineCollection({
  loader: glob({ base: './src/content/contact', pattern: '**/*.md' }),
  schema: z.object({
    lang: z.enum(['en', 'id']),
    translationKey: z.string(),
    lead: z.string(),
    links: z.array(z.object({
      label: z.string(),
      url: z.string().url(),
      kind: z.enum(['github', 'linkedin', 'other']).default('other'),
    })).default([]),
    email: opt(z.string().email()),
  }),
});

// Teks situs yang bisa diedit di admin, satu entri per bahasa (src/content/<koleksi>/<lang>/<berkas>.md).
// Teks wajib tidak boleh kosong: build gagal dengan pesan yang menyebut field dan berkasnya. Tidak ada fallback diam-diam.
const text = (label: string) => z.string({ error: `${label} wajib diisi` }).trim().min(1, `${label} wajib diisi dan tidak boleh kosong`);
const textFile = (name: string, shape: z.ZodRawShape, refine?: (d: any, ctx: z.RefinementCtx) => void) =>
  defineCollection({
    loader: glob({ base: `./src/content/${name}`, pattern: '**/*.md' }),
    schema: () => {
      const object = z.object({ lang: z.enum(['en', 'id']), translationKey: z.string(), ...shape });
      return refine ? object.superRefine(refine) : object;
    },
  });

// Global: nama situs, label menu, deskripsi meta.
const site = textFile('site', {
  name: text('name'),
  description: text('description'),
  navProjects: text('navProjects'),
  navResearch: text('navResearch'),
  navPublications: text('navPublications'),
  navPeople: text('navPeople'),
  navContact: text('navContact'),
});

// Home: hero, kartu Where to look next, dan bagian What we work on. Daftar unggulan ada di src/data/featured.json.
const home = textFile('home', {
  eyebrow: text('eyebrow'),
  tagline: text('tagline'),
  lead: text('lead'),
  ctaLabel: text('ctaLabel'),
  featuredLabel: text('featuredLabel'),
  exploreTitle: text('exploreTitle'),
  exploreEmpty: text('exploreEmpty'),
  exploreResearchTitle: text('exploreResearchTitle'),
  exploreResearchOne: text('exploreResearchOne'),
  exploreResearchOther: text('exploreResearchOther'),
  explorePublicationsTitle: text('explorePublicationsTitle'),
  explorePublicationsOne: text('explorePublicationsOne'),
  explorePublicationsOther: text('explorePublicationsOther'),
  explorePeopleTitle: text('explorePeopleTitle'),
  explorePeopleOne: text('explorePeopleOne'),
  explorePeopleOther: text('explorePeopleOther'),
  whatTitle: text('whatTitle'),
  whatEmpty: text('whatEmpty'),
});

// Halaman indeks Projects, Research, Publications, dan People (translationKey: projects, research, publications, people).
const pages = textFile('pages', {
  title: text('title'),
  lead: opt(z.string().trim().min(1)),
  emptyTitle: opt(z.string().trim().min(1)),
  emptyBody: opt(z.string().trim().min(1)),
}, (d, ctx) => {
  if (!d.emptyTitle && !d.emptyBody) ctx.addIssue({ code: 'custom', path: ['emptyBody'], message: 'keadaan kosong wajib diisi: isi emptyTitle atau emptyBody' });
});

// Footer: deskripsi, judul kolom, hak cipta, keterangan, tanggal pembaruan otomatis, dan tautan kode sumber (default mati).
const footer = textFile('footer', {
  description: text('description'),
  exploreTitle: text('exploreTitle'),
  projectsTitle: text('projectsTitle'),
  researchTitle: text('researchTitle'),
  connectTitle: text('connectTitle'),
  copyrightHolder: text('copyrightHolder'),
  note: text('note'),
  showUpdated: z.boolean().default(true),
  updatedLabel: text('updatedLabel'),
  showSource: z.boolean().default(false),
  sourceLabel: text('sourceLabel'),
  sourceUrl: opt(z.string().url()),
}, (d, ctx) => {
  if (d.showSource && !d.sourceUrl) ctx.addIssue({ code: 'custom', path: ['sourceUrl'], message: 'sourceUrl wajib diisi bila showSource menyala' });
});

export const collections = { research, projects, people, publications, contact, site, home, pages, footer };
