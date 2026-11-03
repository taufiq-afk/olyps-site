# OLYPS Lab Website

## Konteks
Situs lab OLYPS, sebuah independent research initiative yang didirikan oleh dua orang pendiri yang diperlakukan setara dalam konten. Audiens gabungan: kolaborator riset dan perekrut. Jangan mengklaim status institusi resmi. Afiliasi institusi hanya muncul di field `affiliations` pada profil individu, bukan di identitas OLYPS. Jangan pakai logo institusi. Aturan sensitif (kata terlarang, klaim, aset yang tidak boleh di-commit) ada di CLAUDE.local.md yang tidak di-commit, dan daftar katanya di scripts/forbidden.local.json.

## Teknis
- Framework Astro, output static, deploy ke GitHub Pages lewat GitHub Actions (`.github/workflows/deploy.yml`, Node dibaca dari `.nvmrc`). `site` dan `base` ada di site.config.ts dan bisa ditimpa lewat variabel lingkungan `OLYPS_SITE` dan `OLYPS_BASE` (kosongkan `OLYPS_BASE` untuk domain kustom). Semua tautan dan aset internal memakai `import.meta.env.BASE_URL`.
- Sebelum tayang jalankan `npm run check:predeploy` (build lalu pemeriksa). Pemeriksa gagal bila ada teks placeholder, kata terlarang, noindex hilang, aset terlalu besar, pola email, berkas rahasia, atau tautan internal tanpa base.
- Konten (research, projects, people, publications) berupa file Markdown di content collections, dengan placeholder yang jelas ditandai.
- Dua bahasa: en (utama) dan id, dengan routing terpisah /en dan /id.
- Dua tema: terang dan gelap (tema siang, sore, malam dan logika jam lokal sudah dihapus). Mode: auto (mengikuti prefers-color-scheme, default), terang, gelap. Pilihan manual disimpan di localStorage dengan try/catch, skrip inline di head mencegah kilatan tema. Kehangatan tema sore dipindahkan menjadi nuansa hangat di tema terang.
- Identitas situs (nama, tagline, logo, favicon, warna) disatukan dalam satu file konfigurasi agar mudah diganti.
- Panel admin ditunda. Struktur konten harus dibuat siap untuk ditambah panel admin nanti.

## Struktur konten
- Daftar unggulan ada di `src/data/featured.ts` (translationKey proyek, berurutan, maksimum 3). Sumber kartu hero (butir pertama) dan bagian "What we work on". Divalidasi saat build.
- Relasi antar koleksi (research, projects, publications, people) memakai daftar translationKey di frontmatter (`relatedResearch`, `relatedProjects`, `relatedPublications`, `relatedPeople`), dua arah dan many-to-many. Penulis publikasi menaut ke people lewat `personKey`. Key yang tidak ada, versi bahasa yang hilang, atau daftar unggulan yang salah akan menggagalkan build (`assertContentValid` di `src/i18n/content.ts`). Halaman menampilkan bagian "Related" otomatis.
- Research = pertanyaan atau hipotesis, metode, temuan yang bisa dikutip. Project = tujuan, cakupan, roadmap, dampak. Satu kalimat definisi tampil di halaman indeks masing-masing.
- Token ukuran kartu: sm (anggota tim), md (daftar riset dan proyek, widget), lg (unggulan). Kartu sejenis berukuran sama.
- Setiap halaman konten punya slot banner pixel (poster diam). Hanya satu video autoplay per halaman. Detail proyek punya slot media di kolom kanan (poster dulu, klip diputar saat diklik, muted, takarir VTT per bahasa).
- People: satu grid kompak auto-fill (5 sampai 6 kolom), kartu sama untuk semua, halaman profil per orang.

## Keputusan desain
- Palet: netral hangat dengan permukaan berlapis (bg, raised, sunken), garis tepi tipis semi-transparan, bayangan lembut, satu aksen utama dan satu aksen pendamping, serta gradasi cahaya halus. Tema gelap berupa abu arang hangat dengan teks putih tulang. Gaya mengacu pada Claude Desktop, tetapi tanpa oranye-terakota. Kandidat aksen A (teal dan violet) dan B (indigo dan hijau laut), dipilih lewat `accent` di site.config.ts. Semua warna adalah token di site.config.ts.
- Bentuk: radius pill (999px) untuk navbar dan tombol, 24px untuk kartu, 14px untuk elemen kecil.
- Layout: container maksimum 86rem dengan gutter fluid (clamp). Wordmark navbar sejajar dengan tepi konten. Hero dua kolom di layar lebar.
- Navbar hibrida: lapisan atas tanpa latar berisi tiga kapsul kaca (wordmark dengan ikon logo placeholder, tautan tengah dengan penanda aktif yang bergeser dan `aria-current`, tombol tema dan bahasa). Lima tautan sudah aktif. Di ponsel menjadi tombol menu, dan tanpa JavaScript menu tampil terbuka. Target sentuh minimal 44px.
- Navigasi memakai View Transitions bawaan Astro (`ClientRouter`). Navbar persisten per bahasa lewat `transition:persist`. Setiap skrip komponen harus idempoten dan dijalankan ulang pada `astro:page-load`. Tema dan kelas `js` disalin ke dokumen baru pada `astro:before-swap`. Semua gerak mati di prefers-reduced-motion.
- Tombol tema berupa lingkaran dengan ikon SVG (monitor untuk auto, matahari, bulan), tanpa emoji. Tombol bahasa berupa kontrol segmen EN | ID berlebar tetap.
- Ikon: Lucide lewat paket `@lucide/astro` (lisensi ISC).
- Efek kaca: backdrop-filter blur 22px dan saturate 150%, latar translusen lewat color-mix, garis tepi 1px seragam (tanpa sorotan asimetris), fallback solid lewat @supports dan prefers-reduced-transparency. Dua varian: tema (di atas permukaan biasa) dan on-media (mengikuti tema, dipasang lewat atribut `data-glass="media"`). Navbar beralih varian lewat IntersectionObserver saat keluar dari panggung wallpaper. Jumlah elemen kaca dibatasi.
- Dev toolbar Astro dimatikan (`devToolbar.enabled: false`). Tidak ada UI admin di situs publik.
- Konten: collections research, projects, people, publications dengan folder per bahasa dan `translationKey`. Semua konten dummy bertanda `placeholder: true`. Jangan merekayasa publikasi atau data lain.
- Wallpaper hero per tema: tema terang memakai klip dan poster terang, tema gelap memakai yang malam (public/media/: olyps-hero-loop.mp4/.webm dan olyps-hero-poster.webp/.jpg untuk gelap, akhiran -light untuk terang). Hanya sumber tema aktif yang dimuat. Saat tema berganti, poster crossfade lalu video diganti. Scrim tipis mengikuti tema (gelap di tema gelap, terang di tema terang). Hanya poster bila prefers-reduced-motion atau Save-Data. Video dijeda saat tertutup penuh oleh lembar, saat tab tidak aktif, dan lewat tombol jeda (status di localStorage). image-rendering: pixelated, posisi lewat variabel CSS `--media-position`. Karena visualnya ilustrasi pixel, keterangan "eksplorasi konsep" wajib tampil di dekat hero dan di footer.
- Panggung dan lembar (Home): wallpaper `position: fixed` diam di belakang hero dan bagian eksplorasi. Lembar solid bersudut atas melengkung 32px naik menutupinya, dan semua konten sesudahnya serta footer berada di lembar itu. Tidak ada gradasi pudar antara panggung dan lembar.
- Kaca on-media mengikuti tema: tema terang memakai kaca terang translusen dengan teks gelap, tema gelap memakai kaca gelap dengan teks terang. Token ada di `glassMedia` dan `hero` per tema di site.config.ts.
- Bahasa gerak kartu tautan (widget dan kartu What we work on): hover mengangkat, kilau mengikuti kursor (`data-glow`), panah bergeser, animasi masuk bergantian (`data-reveal`). Semua mati di reduced motion.
- Footer: wordmark dengan deskripsi placeholder, kolom Explore, Research, Connect (tautan GitHub), baris bawah dengan "© 2026 OLYPS", kontrol bahasa dan tema, tombol kembali ke atas, dan satu baris keterangan konsep. Tanpa simbol TM atau R, tanpa halaman Privacy atau Terms. Tampil di semua halaman.
- Open Graph memakai poster gelap, dengan meta per bahasa dan hreflang. `site` di site.config.ts wajib diisi sebelum deploy agar URL absolutnya benar. Situs tetap noindex.
- Cek kontras WCAG AA lewat `npm run check:contrast` (dua tema, kandidat aksen, kedua varian kaca dan teks hero terhadap sel poster paling terang dan paling gelap tiap tema). Jalankan setiap mengubah warna, scrim, atau opasitas kaca.
- Halaman /en/styleguide hanya ada saat `npm run dev` dan tidak ikut di build.

## Urutan langkah
0. Repo, gitignore, aturan konten. 1. Scaffold Astro. 2. Konfigurasi identitas dan layout. 3. Routing i18n. 4. Tema terang dan gelap dengan cek kontras. 5. Home (navbar, hero video, widget kaca) dan styleguide untuk tinjauan gaya. 6. Revisi desain: kaca dua varian, wordmark, panggung wallpaper, collections, lima halaman, View Transitions.
7. Revisi: panggung diam dan lembar melengkung, wallpaper terang dan gelap, footer, Open Graph.
8. Persiapan GitHub Pages: base path, workflow deploy, pemeriksa predeploy, riwayat git bersih.
Berikutnya, setelah penilaian: 404, perapian tata letak ponsel, aksesibilitas. Panel admin ditunda.

## Halaman
Home (panggung wallpaper lalu lembar, ringkas dan to the point seperti gaya Apple), Research, Projects, Publications, People, Contact (urutan navigasi, menu ponsel, dan footer). Proyek jangka panjang tampil dengan judul placeholder dan status "in progress".

## Aturan keamanan dan aset
- Detail aturan sensitif ada di CLAUDE.local.md (tidak di-commit). Prinsipnya: jangan commit .env, API key, data mentah atau dataset, video asli berukuran besar, materi program pihak ketiga, atau foto orang tanpa izin.
- Hanya aset yang sengaja dipublikasikan yang dikecualikan secara eksplisit di .gitignore (video di public/media/ dikecualikan per nama berkas, bukan per ekstensi).
- Pakai placeholder untuk foto, logo, dan teks yang belum final.
- Video pixel dipasang sebagai "eksplorasi konsep" dengan keterangan bahwa visual adalah ilustrasi dan semua angka rupiah adalah asumsi tanpa data lapangan.

## Aturan konten
- Jangan menulis klaim tentang proyek klinis, mitra, hasil, atau angka performa. Jangan menulis klaim status institusi.
- Proyek jangka panjang memakai judul placeholder "Project title to be decided" / "Judul proyek akan ditentukan", dan entri risetnya juga berjudul placeholder. Deskripsi bidang dan proyek tetap placeholder bertanda (dan tidak tayang di produksi) sampai pemilik situs memberi teksnya.
- Jangan tampilkan email apa pun di situs. Satu-satunya jalur kontak adalah tautan ke https://github.com/taufiq-afk (`contact.github` di site.config.ts).
- Institusi hanya boleh muncul di field `affiliations` pada profil individu (people), dan hanya dari teks resmi pemilik situs. Saat ini kosong.
- Data people dan publications berasal dari teks yang diberikan pemilik situs (placeholder: false). Judul dan urutan penulis publikasi harus dicek manual terhadap halaman IEEE Xplore sebelum rilis (ada komentar TODO lokal di frontmatter, tidak tampil di situs).
- Pada build produksi semua entri `placeholder: true` disaring dari seluruh situs di `getLocalized` (indeks Research dan Projects, relasi, hitungan, kartu Home, kolom Research di footer), dan halaman detailnya tidak dibangun. Indeks yang kosong menampilkan keadaan kosong yang sudah diterjemahkan. Di dev entri placeholder tetap tampil dengan badge. Tidak ada sitemap yang dibuat otomatis. Avatar tanpa foto menampilkan inisial dengan aria-label hanya nama orangnya. `public/placeholder/poster.svg` hanya untuk dev dan dihapus dari dist lewat integrasi di astro.config.mjs.
- Tanpa simbol TM atau R. Situs memakai noindex secara default (opsi di site.config.ts) sampai konten final.

## Alur kerja
- Selalu ajukan rencana dan beberapa opsi dengan satu rekomendasi sebelum menulis atau mengubah banyak file, lalu tunggu persetujuan.
- Kerjakan dalam langkah kecil. Jelaskan dalam Bahasa Indonesia, istilah teknis tetap Bahasa Inggris.
- Setelah satu langkah selesai dan situs berhasil dibangun tanpa error, buat commit lokal dengan pesan Bahasa Indonesia yang ringkas.
- Jangan push kecuali saya menulis "push sekarang". Jangan force push. Riwayat commit tidak diubah kecuali saya memintanya secara eksplisit (dan selalu dengan branch cadangan lokal yang tidak ikut dipush).
- Akui secara jujur jika ada solusi sebelumnya yang kurang tepat.

## Gaya tulisan
Tanpa emoji. Tanpa em dash. Gunakan kalimat sambung.