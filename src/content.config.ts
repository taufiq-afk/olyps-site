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
  order: z.number().default(0),
};
const keys = z.array(z.string()).default([]);

const collection = <T extends z.ZodRawShape>(name: string, shape: T) =>
  defineCollection({
    loader: glob({ base: `./src/content/${name}`, pattern: '**/*.md' }),
    schema: z.object({ ...common, ...shape }),
  });

// Research: pertanyaan atau hipotesis, metode, temuan yang bisa dikutip (ditulis di badan Markdown).
const research = collection('research', {
  title: z.string(),
  summary: z.string(),
  area: z.enum(['health', 'environment']).optional(),
  relatedProjects: keys,
  relatedPublications: keys,
  relatedPeople: keys,
});

// Project: tujuan, cakupan, roadmap, dampak (ditulis di badan Markdown).
const projects = collection('projects', {
  title: z.string(),
  summary: z.string(),
  status: z.enum(['in-progress', 'planned', 'concept']),
  caption: z.string().optional(),
  // Slot media di kolom kanan halaman detail. Poster dulu, klip menyusul.
  // mediaVideo: nama dasar tanpa ekstensi (.mp4 dan .webm di public/). mediaCaptions: berkas VTT untuk bahasa entri ini.
  mediaPoster: z.string().optional(),
  mediaVideo: z.string().optional(),
  mediaCaptions: z.string().optional(),
  relatedResearch: keys,
  relatedPublications: keys,
  relatedPeople: keys,
});

const people = collection('people', {
  name: z.string(),
  role: z.string(),
  bio: z.string(),
  skills: z.array(z.string()).default([]),
  // Institusi hanya boleh diisi di sini, dari teks resmi pemilik situs.
  affiliations: z.array(z.string()).default([]),
  // Tautan profil opsional (mis. LinkedIn, Google Scholar, GitHub pribadi). Kosong: tidak dirender.
  links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  // Foto opsional, path relatif ke public/. Hanya dengan izin orangnya. Kosong: avatar tetap inisial.
  photo: z.string().optional(),
  relatedResearch: keys,
  relatedProjects: keys,
  relatedPublications: keys,
});

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

export const collections = { research, projects, people, publications };
