# Admin lokal (uji, Sveltia CMS)

Hanya untuk pengembangan. Folder ini di luar `public/`, dilayani oleh `integrations/dev-admin.mjs` saat `npm run dev`, dan tidak pernah masuk `dist`. `npm run check:predeploy` gagal bila dist berisi folder admin atau rujukan ke CDN admin.

## Menjalankan
1. `npm run dev`
2. Buka http://localhost:4321/olyps-site/admin/ di Chrome, Edge, atau Brave (butuh File System Access API).
3. Klik "Work with Local Repository" dan pilih folder root proyek. Tanpa token, tanpa OAuth, tanpa proxy.
4. Simpan entri di formulir, lalu tinjau dengan `git diff` dan commit sendiri.

## Menu admin
Home (teks Home dan daftar unggulan), Page intros (judul, pengantar, keadaan kosong keempat halaman indeks), Footer and site info (footer, nama situs, label menu, deskripsi meta), garis pemisah, Projects, Research, Publications, People, garis pemisah, Contact, lalu tab Assets bawaan Sveltia. Pemisah Sveltia hanya garis tanpa judul. Urutan field di tiap koleksi mengikuti urutan tampil di halaman, field penerbitan (order, draft, translationKey) di bawah. Setiap field punya petunjuk singkat. Entri baru langsung membuka semua bahasa (`initial_locales: all`).

## Relasi yang putus
Di dev, kunci relasi yang menunjuk entri yang tidak ada dilewati, dengan peringatan di konsol server dan banner kuning di halaman terkait (menyebut berkas dan kuncinya). Di build produksi dan `npm run check:predeploy` hal yang sama menjadi kesalahan, lengkap dengan petunjuk perbaikan.

## Teks situs
Bila teks salah satu bahasa belum ada, dev menampilkan versi bahasa lain dengan banner yang menyebut path berkas yang kurang. Build produksi dan `check:predeploy` menolaknya. Menghapus berkas teks saat server dev berjalan bisa membuat penyimpanan konten Astro tidak sinkron sampai server dimulai ulang (perilaku loader Astro).
Teks konten ada di `src/content/{site,home,pages,footer,contact}/<lang>/`. Teks wajib yang dikosongkan membuat build gagal dengan pesan yang menyebut field dan berkasnya. Hasil build tetap disaring pemeriksa kata terlarang.

## Gambar
- Unggahan masuk `src/assets/<jenis>/` (people, research, projects), diproses Astro, bukan `public/`. Folder umum untuk koleksi lain adalah `src/assets/shared`, tidak menimpa folder People.
- Batas 1.500.000 byte per berkas (`max_file_size`), sama dengan `maxFileBytes` di `scripts/predeploy.config.json`. Admin mengecilkan ke webp maksimum 1920 px.
- Setelah Anda menyimpan, `scripts/tidy-assets.mjs` berjalan otomatis di server dev (atau manual: `npm run tidy:assets`). Nama berkas menjadi slug entri (mis. `taufiq.webp`), foto people dibatasi 1024 px, research dan projects 1920 px, dan EXIF, GPS, XMP dibuang. Unggahan baru untuk entri yang sama menggantikan berkas bernama slug itu.
- `npm run check:predeploy` gagal bila gambar publik masih memuat metadata atau bernama bawaan perangkat atau aplikasi (mis. whatsapp, IMG_, tanggal dan jam).
- Isi foto hanya dengan izin orang yang bersangkutan.

## Batas admin yang perlu diketahui
- Sveltia tidak bisa mewajibkan endDate hanya saat status completed atau melarang tanggal akhir sebelum tanggal mulai. Aturan itu ditegakkan skema saat build.
- Relation widget hanya menunjuk satu koleksi, jadi `leadsTo` (project, research, atau publication) berupa daftar teks translationKey yang divalidasi build.
- Daftar unggulan bisa diurutkan dengan menyeret (mouse) atau tombol Move Up dan Move Down, tetapi tidak bisa menolak key ganda. Build yang menolaknya.
- Admin tidak bisa menamai unggahan dari slug. Itu dikerjakan skrip tidy setelah simpan.
- Satu koleksi Sveltia hanya bisa berisi entri (folder) atau berkas tetap, tidak keduanya. Karena itu judul dan pengantar halaman indeks ada di menu sendiri (Page intros), bukan di dalam Projects, Research, Publications, dan People.
- Sveltia tidak bisa mewajibkan field hanya saat field lain menyala (mis. URL kode sumber saat tautannya dinyalakan). Skema yang menolaknya saat build.
- Sveltia menulis string kosong untuk field opsional yang dikosongkan. Skema memperlakukannya sebagai tidak diisi.

## Sumber kebenaran
Skema ada di `src/content.config.ts`. Bila skema People berubah, ubah `admin/config.yml` agar sejalan. Build menolak data yang tidak valid, termasuk relasi ke translationKey yang tidak ada.
