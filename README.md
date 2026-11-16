# SIPADU Desa Tundagan
**Sistem Informasi Pelayanan Publik & Pengaduan Warga Desa Tundagan, Kecamatan Hantara, Kabupaten Kuningan**

Aplikasi web full-stack untuk digitalisasi layanan pengaduan masyarakat lintas lima dusun (Manis, Pahing, Pon, Wage, Kliwon) dan pengajuan surat keterangan desa, dibangun dengan penerapan standar keamanan web (*Secure Coding*).

- **URL Aplikasi Aktif (HTTPS)**: https://sipadu-desa-tundagan.vercel.app
- **URL Repository GitHub**: https://github.com/nursyamsialverazt/sipadu-desa-tundagan-
- **Penulis**: Muhamad Hafizt Nursyamsi Alverazt (`20240810086` — TINFC-2024-01, Fakultas Ilmu Komputer, Universitas Kuningan)
- **Mata Kuliah**: Keamanan Cyber (*Cyber Security*) — Dosen Pengampu: Fitra Nugraha, S.Kom., M.Kom.

---

## Fitur Utama
1. **Autentikasi & Registrasi Pengguna Aman**
   - Registrasi warga baru dengan validasi NIK 16 digit dan kebijakan password kuat (minimal 8 karakter, huruf besar, huruf kecil, angka, dan simbol).
   - Login berbasis sesi JWT yang disimpan di cookie `HttpOnly` dan `Secure` (saat HTTPS) dengan perlindungan CSRF bertanda tangan HMAC-SHA256.
   - Pembatasan peran (*Role-Based Access Control*): `warga` dan `admin` (Perangkat Desa).
2. **Pengelolaan Data (CRUD) Terdatabase**
   - **Pengaduan Warga**: Tambah, lihat, filter (status, dusun, pencarian), ubah, dan hapus pengaduan. Warga hanya dapat mengelola miliknya sendiri; admin dapat memperbarui status dan menulis tanggapan resmi.
   - **Permohonan Surat Keterangan**: Pengajuan Surat Domisili, SKU, SKTM, Pengantar SKCK, dan Kependudukan dengan *masking* NIK (`320815******0003`) dan penomoran surat oleh admin serta cetak tanda terima PDF.
3. **Laporan, Analitik & Ekspor**
   - Dashboard rekapitulasi berdasarkan status, dusun, dan kategori pengaduan.
   - Ekspor data ke CSV (dengan sanitasi *CSV Formula Injection*) dan cetak laporan PDF berkop Pemerintah Desa Tundagan.
4. **Audit Keamanan (Admin Desa)**
   - Pencatatan log aktivitas keamanan (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `RATE_LIMIT_LOGIN`, `IDOR_ATTEMPT_BLOCKED`, `RBAC_FORBIDDEN`, `EXPORT_CSV`, `LOGOUT`).

---

## Teknologi yang Digunakan
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React
- **Backend**: Node.js v22, Express, TypeScript (`tsx` / Vercel Serverless `api/index.ts`)
- **Database**: SQLite (`node:sqlite` dengan *Parameterized Prepared Statements*)
- **Keamanan**: `bcryptjs` (cost 12), `jsonwebtoken`, `cookie-parser`, `helmet` (CSP, HSTS, `nosniff`), `express-rate-limit`, `zod`, CSRF HMAC-SHA256
- **Hosting & TLS**: Vercel (HTTPS aktif dengan sertifikat Google Trust Services)

---

## Konfigurasi Environment Variable
Salin `.env.example` menjadi `.env` dan isi nilai rahasia secara lokal (jangan pernah *commit* `.env` ke repository):

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=<generate-random-48-byte-hex-secret>
SEED_ADMIN_PASSWORD=<opsional-password-awal-admin>
APP_URL=https://sipadu-desa-tundagan.vercel.app
```

---

## Cara Instalasi & Menjalankan Secara Lokal
```bash
# 1. Instal dependensi
npm install

# 2. Jalankan mode pengembangan (Express + Vite middleware di port 3000)
npm run dev

# 3. Build produksi dan jalankan server
npm run build
NODE_ENV=production npm start
```

---

## Akun Uji Coba (Demo)
- **Admin Desa (Sekretaris Desa)**: `admin_tundagan` / `AdminTundagan#2026`
- **Warga 1 (Dusun Pahing)**: `warga_asep` / `WargaTundagan#2026`
- **Warga 2 (Dusun Manis)**: `warga_siti` / `WargaSiti#2026`

---

## Ringkasan Penggunaan AI Agent
- **Alat AI yang Dipakai**: Gemini (ekstensi Gemini Code Assist di Visual Studio Code / VS Code).
- **Bagian Pekerjaan yang Dibantu**: Perancangan arsitektur full-stack (Express + React + TypeScript + SQLite), penyusunan kerangka middleware keamanan (`bcryptjs`, JWT `HttpOnly`, proteksi CSRF HMAC-SHA256, `helmet`, `express-rate-limit`, validasi `zod`, dan otorisasi RBAC/IDOR), debugging konfigurasi deployment Vercel (`api/index.ts`, `vercel.json`, pembaruan `esbuild`), serta penyusunan skenario *self-testing* keamanan.
- **Contoh Prompt Utama (Tanpa Secret atau Data Pribadi)**:
  1. *Perancangan Backend & Kontrol Keamanan*: `"Saya sedang membangun aplikasi web layanan publik dan pengaduan warga studi kasus Desa Tundagan (SIPADU) dengan React, Express, TypeScript, dan SQLite. Buatkan struktur REST API yang menerapkan prepared statements untuk seluruh query, hashing bcryptjs (cost 12), sesi JWT cookie HttpOnly + Secure dengan CSRF HMAC-SHA256, validasi Zod anti-XSS, proteksi RBAC dan anti-IDOR, rate limiting login, audit log, dan ekspor CSV aman. Gunakan placeholder environment variable (process.env.JWT_SECRET) tanpa secret nyata."`
  2. *Review Keamanan & Self-Testing*: `"Lakukan audit keamanan statis pada rute autentikasi, CRUD pengaduan, permohonan surat, dan ekspor CSV untuk memeriksa potensi SQL Injection, XSS, IDOR, CSRF, dan CSV Formula Injection, lalu susun skenario uji verifikasinya."`
- **Cara Meninjau & Memverifikasi**: Seluruh kode pada `server/security.ts` dan `server.ts` ditinjau langsung (memastikan kueri berparameter `?`, bebas *hardcoded secret*, dan validasi kepemilikan `row.user_id === req.user.id` aktif), lalu diuji dengan pengujian input langsung, `npm run build`, `npm audit` (`0 vulnerabilities`), dan pemindaian `securityheaders.com` (skor **Grade A+**).

---

## Ringkasan Keamanan & Self-Testing
| No | Skenario Uji | Metode Uji | Hasil | Mitigasi / Verifikasi |
| :- | :--- | :--- | :--- | :--- |
| 1 | SQL Injection pada Form & Parameter URL | Payload `' OR '1'='1` di form login & `GET /api/pengaduan/1'%20OR%20'1'='1` | **Lolos** | *Prepared statements* (`?`) & `parsePositiveId()` menolak input non-angka (`400`/`401`). |
| 2 | Cross-Site Scripting (XSS) | Input `<script>alert(1)</script>` pada judul/deskripsi pengaduan | **Lolos** | `sanitizeText()` menghapus tag berbahaya, JSX *auto-escaping*, dan Helmet CSP aktif. |
| 3 | Kontrol Akses (RBAC) | Akun warga (`warga_asep`) mengakses `GET /api/admin/audit-logs` | **Lolos** | Ditolak `403 Forbidden` oleh `requireRole('admin')` & tercatat sebagai `RBAC_FORBIDDEN`. |
| 4 | IDOR (Akses Data Warga Lain) | `warga_asep` mengakses `GET /api/pengaduan/3` milik `warga_siti` | **Lolos** | Ditolak `403 Forbidden` & tercatat sebagai `IDOR_ATTEMPT_BLOCKED`. |
| 5 | Kebijakan Password Lemah | Registrasi dengan password lemah `"password123"` | **Lolos** | Ditolak `400 Bad Request` oleh `strongPasswordSchema` (Zod). |
| 6 | Brute-Force & Rate Limiting | 6 kali percobaan login gagal beruntun pada `/api/auth/login` | **Lolos** | Percobaan ke-6 diblokir `429 Too Many Requests` & tercatat `RATE_LIMIT_LOGIN`. |
| 7 | Proteksi CSRF pada Mutasi Data | Permintaan `POST/PUT/DELETE` tanpa `X-CSRF-Token` / beda Origin | **Lolos** | Ditolak `403 Forbidden`; validasi HMAC-SHA256 + verifikasi Origin/Host. |
| 8 | HTTPS, Security Headers & Audit Dependency | Pemindaian `securityheaders.com` pada `/api/health` & `npm audit` | **Lolos** | **Grade A+** (6/6 header aktif), SSL valid Google Trust Services, `npm audit`: **0 vulnerabilities**. |

