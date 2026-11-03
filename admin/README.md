# Admin lokal (uji, Sveltia CMS)

Hanya untuk pengembangan. Folder ini di luar `public/`, dilayani oleh `integrations/dev-admin.mjs` saat `npm run dev`, dan tidak pernah masuk `dist`. `npm run check:predeploy` gagal bila dist berisi folder admin atau rujukan ke CDN admin.

## Menjalankan
1. `npm run dev`
2. Buka http://localhost:4321/olyps-site/admin/ di Chrome, Edge, atau Brave (butuh File System Access API).
3. Klik "Work with Local Repository" dan pilih folder root proyek. Tanpa token, tanpa OAuth, tanpa proxy.
4. Simpan entri di formulir, lalu tinjau dengan `git diff` dan commit sendiri.

## Foto
- Unggahan masuk `src/assets/people/` (diproses Astro menjadi webp), bukan `public/`.
- Batas 1.500.000 byte per berkas (`max_file_size`), sama dengan `maxFileBytes` di `scripts/predeploy.config.json`. Admin juga mengecilkan gambar ke webp maksimum 1024 px.
- Isi foto hanya dengan izin orang yang bersangkutan.

## Sumber kebenaran
Skema ada di `src/content.config.ts`. Bila skema People berubah, ubah `admin/config.yml` agar sejalan. Build menolak data yang tidak valid, termasuk relasi ke translationKey yang tidak ada.
