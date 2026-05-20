# FEATURE BACKLOG — Hajar Aswad Clinic

Catatan rencana fitur untuk aplikasi klinik. Berbeda dari `QUALITY_AUDIT.md`
(technical debt & quality) dan `PATTERNS.md` (konvensi code) — file ini fokus
pada **fitur baru yang belum diimplementasi**.

Untuk roadmap technical, lihat `QUALITY_AUDIT.md` Section 3.

---

## Konvensi

- **ID**: `F{nomor}` (F1, F2, dst) — stabil, jangan re-number setelah implementasi
- **Status**: `Backlog` → `Diskusi` → `Approved` → `In Progress` → `Done` → `Released`
- **Prioritas**: 🔴 High / 🟡 Medium / 🟢 Low
- **Effort**: estimasi kasar (jam atau hari)
- Setiap entri singkat di tabel + detail di section bawahnya kalau perlu

---

## Daftar Backlog

| ID | Fitur | Modul | Effort | Prioritas | Status |
|---|---|---|---|---|---|
| [F1](#f1-google-review-cta-rating-high) | Google Review CTA untuk rating tinggi | billing-feedback | 1-2 jam | 🟡 | Approved |

---

## F1 — Google Review CTA (rating high)

**Status**: Approved 2026-05-20

### Latar Belakang

Fitur feedback pasien saat ini hanya tampil di dalam aplikasi (`billing-feedback.html`).
Owner ingin pasien yang puas (rating tinggi) di-arahkan untuk meninggalkan
review di Google Maps — boost rating publik klinik di Google Search & Maps.

Google **tidak menyediakan API** untuk post review otomatis (kebijakan anti-fake-review).
Solusi: setelah pasien submit rating, kalau rating ≥ threshold, tampilkan
CTA dengan link langsung ke form review Google (`writereview?placeid=...`).
Pasien yang sudah happy tinggal klik & submit di Google langsung.

### Justifikasi Pola "rating ≥ N"

- **Filter sumber rating buruk**: pasien yang rating rendah dialihkan ke
  channel internal (komplain/saran), TIDAK didorong ke Google.
- **Konversi tinggi**: pasien yang sudah klik 5 bintang di app punya intent
  positif — 1 klik tambahan ke Google jauh lebih ringan dari memulai dari nol.
- **Legal & etis**: tidak palsukan review, tidak insentif uang/diskon, tidak
  block pasien rating rendah dari Google (cuma tidak diundang).

### Scope Implementasi

**Backend**:
- Tambah kolom `google_place_id` di `clinic_info` (atau table `clinics` kalau
  multi-klinik) — sekali setup per klinik.
- Endpoint `getClinicInfo` (atau bootstrap response feedback page) include
  `google_place_id`.

**Frontend** (`billing-feedback.html`):
- Setelah submit rating berhasil, kalau `rating >= GOOGLE_REVIEW_MIN_RATING`
  (konstanta, default 4) → tampilkan CTA card.
- CTA: judul + 1 kalimat ajakan + tombol "Tinggalkan review di Google"
  yang membuka URL di tab baru:
  `https://search.google.com/local/writereview?placeid={GOOGLE_PLACE_ID}`
- Kalau `rating < threshold` → tampilkan ucapan terima kasih biasa
  (tidak tampilkan CTA Google).

**Settings**:
- Field input `Google Place ID` di halaman Settings Klinik supaya owner bisa
  update sendiri tanpa migration.

### Pertimbangan UX

- **Copy text**: hangat & tidak memaksa. Contoh: *"Terima kasih atas
  rating-nya! Kalau berkenan, mohon bantu kami dengan satu review singkat di
  Google supaya pasien lain bisa menemukan klinik kami."*
- **Tombol tertutup di "x"**: pasien bisa skip tanpa stigma.
- **Threshold 4 atau 5?**: default 4 supaya cukup pool pasien yang happy.
  Rating 4 = "puas tapi ada catatan" — masih layak ke Google.
- **Pasien yang sudah review**: tidak bisa di-track (Google tidak expose ini).
  Acceptable — sekali pasien klik & submit, mereka tidak akan submit dobel
  di Google (system Google block).

### Buka Pertanyaan (sebelum implementasi)

- Q: Default threshold 4 atau 5? (rekomendasi: 4)
- Q: Tombol CTA appear sekali (kalau pasien close, hilang) atau persist
  sampai pasien klik? (rekomendasi: appear sekali per submit)
- Q: Place ID disimpan per klinik di `clinic_info` table atau di
  `script properties` (multi-klinik = berbeda per `clinic_id`)?

### Dependency

- Place ID Google Maps klinik (owner perlu lookup di Google Business Profile)
- Mungkin perlu konsultasi: pasien yang submit feedback via email (bukan
  in-app) — apakah email reply juga include CTA link?

### Acceptance Criteria

- [ ] Schema `clinic_info.google_place_id` text nullable
- [ ] UI Settings Klinik untuk update Place ID
- [ ] CTA card muncul di feedback page kalau rating ≥ threshold & place_id
      tersedia
- [ ] Link buka tab baru ke Google writereview
- [ ] Tombol close optional, atau auto-hide setelah klik
- [ ] Threshold dibuat konstanta supaya bisa di-tune

### Effort

1-2 jam: 30 menit backend, 30 menit Settings UI, 30 menit feedback CTA, 30 menit testing.

---

## Cara Menambah Entri Baru

1. Naikkan nomor ID berikutnya (F2, F3, dst) — stabil, jangan re-use yang sudah dipakai.
2. Tambah 1 baris di tabel "Daftar Backlog".
3. Tambah section detail di bawah dengan format yang sama seperti F1.
4. Update memory `MEMORY.md` index kalau fitur signifikan.
