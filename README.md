# SIPADU Desa Tundagan
**Sistem Informasi Pelayanan Publik & Pengaduan Warga Desa Tundagan, Kecamatan Hantara, Kabupaten Kuningan**

Aplikasi web full-stack untuk digitalisasi layanan pengaduan masyarakat lintas lima dusun (Manis, Pahing, Pon, Wage, Kliwon) dan pengajuan surat keterangan desa, dibangun dengan penerapan standar keamanan web (*Secure Coding*).

## Fitur Utama
1. **Autentikasi & Registrasi Pengguna Aman**
   - Registrasi warga baru dengan validasi NIK 16 digit dan kebijakan password kuat (minimal 8 karakter, huruf besar, huruf kecil, angka, dan simbol).
   - Login berbasis sesi JWT yang disimpan di cookie `HttpOnly` dan `Secure` (saat HTTPS) dengan perlindungan CSRF token.
   - Pembatasan peran (*Role-Based Access Control*): `warga` dan `admin` (Perangkat Desa).
2. **Pengelolaan Data (CRUD) Terdatabase**
   - **Pengaduan Warga**: Tambah, lihat, filter (status, dusun, pencarian), ubah, dan hapus pengaduan. Warga hanya dapat mengelola miliknya sendiri; admin dapat memperbarui status dan menulis tanggapan resmi.
   - **Permohonan Surat Keterangan**: Pengajuan Surat Domisili, SKU, SKTM, Pengantar SKCK, dan Kependudukan dengan masking NIK dan penomoran surat oleh admin serta cetak tanda terima.
3. **Laporan, Analitik & Ekspor**
   - Dashboard rekapitulasi berdasarkan status, dusun, dan kategori pengaduan.
   - Ekspor data ke CSV (dengan sanitasi *CSV Formula Injection*) dan cetak laporan PDF berkop Pemerintah Desa Tundagan.
4. **Audit Keamanan (Admin Desa)**
   - Pencatatan log aktivitas keamanan (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `RATE_LIMIT_LOGIN`, `IDOR_ATTEMPT_BLOCKED`, `RBAC_FORBIDDEN`, `EXPORT_CSV`, `LOGOUT`).

## Teknologi yang Digunakan
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React
- **Backend**: Node.js, Express, TypeScript (`tsx` / Node native type stripping)
- **Database**: SQLite (`node:sqlite` dengan *Parameterized Prepared Statements*)
- **Keamanan**: `bcryptjs` (cost 12), `jsonwebtoken`, `cookie-parser`, `helmet` (CSP & Security Headers), `express-rate-limit`, `zod`, CSRF Double-Submit Token

## Konfigurasi Environment Variable
Salin `.env.example` menjadi `.env` dan isi nilai rahasia secara lokal (jangan pernah commit `.env` ke repository):

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=<generate-random-48-byte-hex-secret>
SEED_ADMIN_PASSWORD=<opsional-password-awal-admin>
APP_URL=https://domain-aplikasi-anda.example.com
```

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

## Akun Uji Coba (Demo)
- **Admin Desa (Sekretaris Desa)**: `admin_tundagan` / `AdminTundagan#2026`
- **Warga 1 (Dusun Pahing)**: `warga_asep` / `WargaTundagan#2026`
- **Warga 2 (Dusun Manis)**: `warga_siti` / `WargaSiti#2026`

## Ringkasan Keamanan & Self-Testing
| Skenario Uji | Metode Uji | Hasil | Mitigasi / Implementasi |
| :--- | :--- | :--- | :--- |
| SQL Injection pada Form & URL | Payload `' OR '1'='1` di login, pencarian, dan `/api/pengaduan/:id` | Lolos | Parameterized prepared statements (`?`) & validasi ID integer positif (`400 Bad Request`) |
| Cross-Site Scripting (XSS) | Input `<script>alert(1)</script>` pada judul/deskripsi | Lolos | Sanitasi tag/event-handler di server, JSX auto-escaping, dan Helmet CSP |
| Kontrol Akses & IDOR | Warga mengakses `/api/admin/audit-logs` atau `/api/pengaduan/:id` milik warga lain | Lolos | Middleware `requireRole('admin')` & pengecekan `user_id === req.user.id` mengembalikan `403 Forbidden` + tercatat di audit log |
| Brute Force & Kebijakan Password | Registrasi password lemah & >5 kali login gagal | Lolos | Kebijakan password kuat Zod (`400`) & `express-rate-limit` pada `/api/auth/login` (`429 Too Many Requests`) |
| Sesi & CSRF | Mutasi POST/PUT/DELETE tanpa header `X-CSRF-Token` | Lolos | JWT disimpan dalam cookie `HttpOnly` (TTL 2 jam) & validasi `timingSafeEqual` CSRF token |
