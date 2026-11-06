import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Frontmatter datar dan terstruktur agar siap dipakai panel admin nanti.
// translationKey menghubungkan versi en dan id, dan menjadi kunci relasi antar koleksi.
// placeholder: true menampilkan badge dan menyembunyikan entri dari Home pada build produksi.
// Relasi (relatedX) berisi daftar translationKey. Relasi bersifat dua arah dan divalidasi saat build
// (lihat src/i18n/content.ts).
const common = {
  lang: z.enum(['en', 'id']),
  translationKey: z.string(),
  placeholder: z.boolean().default(true),
  draft: z.boolean().default(false),
  // Urutan tampil: angka kecil lebih dulu, kosong terakhir (lihat compareEntries di src/i18n/content.ts).
  order: z.number().optional(),
};
const keys = z.array(z.string()).default([]);

type ImageFn = Parameters<Extract<Parameters<typeof defineCollection>[0]['schema'], (...a: any[]) => any>>[0]['image'];

// Siklus hidup untuk Research dan Projects: status, rentang bulan (YYYY-MM), dan kelanjutan ke entri atau tautan lain.
// Aturan lintas field ada di checkLifecycle. Key leadsTo yang tidak ada divalidasi di assertContentValid.
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'gunakan format YYYY-MM');
export const STATUSES = ['concept', 'exploratory', 'ongoing', 'paused', 'completed'] as const;
const lifecycle = {
  status: z.enum(STATUSES),
  startDate: month.optional(),
  endDate: month.optional(),
  leadsTo: keys,
  leadsToUrl: z.string().url().optional(),
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
  area: z.enum(['health', 'environment']).optional(),
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
  image: image().optional(),
  imageAlt: z.string().optional(),
  imageCaption: z.string().optional(),
  // Klip di public/ (nama dasar tanpa ekstensi) dan berkas VTT untuk bahasa entri ini. Belum ada unggahan video.
  mediaVideo: z.string().optional(),
  mediaCaptions: z.string().optional(),
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
  photo: image().optional(),
  relatedResearch: keys,
  relatedProjects: keys,
  relatedPublications: keys,
}));

const publications = collection('publications', {
  title: z.string(),
  // personKey (translationKey di koleksi people) menaut penulis ke halaman profil. Tanpa personKey tampil sebagai teks biasa.
  authors: z.array(z.object({ name: z.string(), personKey: z.string().optional() })),
  venue: z.string(),
  year: z.number(),
  pages: z.string().optional(),
  doi: z.string().optional(),
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
    email: z.string().email().optional(),
  }),
});

export const collections = { research, projects, people, publications, contact };
