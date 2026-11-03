// Daftar proyek unggulan: translationKey di koleksi `projects`, berurutan, maksimum 3.
// Sumber untuk kartu di hero (butir pertama) dan bagian "What we work on" di Home.
// Divalidasi saat build: lebih dari 3 atau key yang tidak ada akan menggagalkan build.
// Entri berlabel placeholder disembunyikan dari Home pada build produksi.
export const featured: string[] = ['featured-project'];
export const FEATURED_MAX = 3;
