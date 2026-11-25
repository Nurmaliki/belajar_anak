# UAT — User Acceptance Test: Dunia Pintar 3D

Dokumen skenario penerimaan untuk rilis produksi. Setiap skenario bisa dijalankan
dengan Playwright **visible** (`node scripts/uat-run.mjs`) sehingga orang tua /
pengembang dapat **menonton** alurnya sambil melihat bukti otomatis.

> Prinsip produk (AGENTS.md): **tidak ada hukuman** — tidak ada nyawa, timer,
> leaderboard, atau area terkunci. Jawaban salah selalu bisa dicoba ulang.
> Semua skenario di bawah menguji sifat itu.

---

## Lingkup & Pengaturan

- **Perangkat target**: tablet / HP Android modern (chrome), laptop desktop.
- **Browser uji**: Chromium (Playwright), window terlihat, viewport desktop 1280×800.
- **Aplikasi**: build dev server `http://localhost:5175`.
- **Data**: setiap skenario dimulai dari kondisi bersih / dapat diulang.

---

## Skenario UAT

### UAT-1 — Boot & menu utama
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 1.1 | Buka halaman `/` | Kanvas 3D muncul, menu lima area tampil |
| 1.2 | Perhatikan tampilan | Langit gradien, awan melayang, Bubu terlihat di dunia |
| 1.3 | Klik tombol **Main** | Dunia masuk, misi berhitung pertama (3 apel) mulai |
| **Kriteria** | — | Tidak ada error konsol; WebGL aktif |

### UAT-2 — Berhitung: mengumpulkan apel
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 2.1 | Kumpulkan 3 apel | Hitungan bertambah 1 per apel, tidak dobel saat tap ulang |
| 2.2 | Semua terkumpul | Tombol jawaban muncul (hanya setelah semua apel diambil) |

### UAT-3 — Jawaban salah TANPA hukuman
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 3.1 | Pilih jawaban salah | Tetap dalam misi, bisa coba lagi, tidak berkurang apa pun |
| 3.2 | Pilih jawaban benar | Bintang diberikan, misi selesai, panel menutup |

### UAT-4 — Menyusun kata (suku kata)
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 4.1 | Coba suku kata salah | Slot tidak terisi, misi lanjut |
| 4.2 | Susun semua suku kata benar | Kata tersusun, misi menang |

### UAT-5 — Penjumlahan (kelompok)
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 5.1 | Lihat 2 kelompok objek + tanda plus | 5 objek total (3+2) |
| 5.2 | Jawab salah | Tetap dalam misi, retry |
| 5.3 | Jawab benar (5) | Menang, bintang |

### UAT-6 — Membandingkan kelompok
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 6.1 | Pilih kelompok salah (lebih kecil) | Tetap dalam misi |
| 6.2 | Pilih kelompok lebih besar | Menang |

### UAT-7 — Mengurutkan kelompok
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 7.1 | Pilih tumpukan salah (terbesar dulu) | Tidak terisi, retry |
| 7.2 | Susun dari paling sedikit → paling banyak | Semua slot terisi, menang |

### UAT-8 — Pengurangan
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 8.1 | Lihat apel: 3 sisa + 2 dicoret | Butang 3 angka |
| 8.2 | Jawab angka yang dicoret (salah) | Retry tanpa hukuman |
| 8.3 | Jawab sisa benar | Menang |

### UAT-9 — Huruf: suara dulu, tanpa menulis di layar
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 9.1 | Misi huruf | Prompt berupa **gambar** + narasi suara, contoh kata **tidak dicetak** |
| 9.2 | Jawab huruf benar | Menang |

### UAT-10 — Bimo, pemandu ramah
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 10.1 | Berjalan mendekat | Bimo menoleh mengikuti Bubu |
| 10.2 | Tap Bimo | Bimo melompat, kembali tenang |
| 10.3 | Menang misi | Bimo bersorak |

### UAT-11 — Lemari aksesori: semuanya terbuka
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 11.1 | Buka lemari dari HUD | Semua aksesori + "tanpa", **tidak ada yang terkunci/disabled** |
| 11.2 | Pilih mahkota | Bubu memakai mahkota (geometry nyata) |
| 11.3 | Tutup, reload | Mahkota masih terpasang (tersimpan) |

### UAT-12 — Dashboard orang tua: data tersimpan
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 12.1 | Buka `/parent`, jawab kunci aritmatika | Halaman terbuka |
| 12.2 | Cek kartu | Bintang, misi selesai, menit bermain, huruf dikenal |
| 12.3 | Cek per area | Satu baris per area; area selesai; area belum dicoba |
| 12.4 | Cek **Coba berikutnya** | Rekomendasi misi dari area paling tertinggal |
| 12.5 | Status suara | Info suara perangkat ditampilkan |

### UAT-13 — PWA: installable & offline
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 13.1 | Audit installability (manifest + sw) | Manifest valid, service worker terdaftar, icon ada |
| 13.2 | Muat ulang dengan SW aktif | Aset audio disajikan dari cache |

### UAT-14 — Ketahanan: penyimpanan gagal bukan akhir dunia
| Langkah | Langkah user | Hasil diharapkan |
|---|---|---|
| 14.1 | Simulasi IndexedDB tidak tersedia | Game tetap berjalan (memori), dan **banner peringatan muncul** |

---

## Hasil & Bukti

Setiap skenario runner mencetak `PASS`/`FAIL`. Screenshot tersimpan di
`uat-artifacts/`. Ringkasan akhir: `ALL PASSED` atau daftar `FAILED`.

## Catatan

- Uji dengan suara: pastikan perangkat punya audio → narasi Gadis terdengar.
- Uji offline sungguhan: buka PWA, aktifkan modus pesawat, dan buka ulang.
- Uji di HP: gunakan viewport sempit → muncul saran "putar layar".
