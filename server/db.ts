import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

const dataDir =
  process.env.VERCEL === '1'
    ? path.join('/tmp', 'sipadu-data')
    : path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'sipadu_tundagan.db');
export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    nik TEXT,
    dusun TEXT NOT NULL DEFAULT 'Dusun Manis',
    role TEXT NOT NULL DEFAULT 'warga' CHECK (role IN ('admin', 'warga')),
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pengaduan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_tiket TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    judul TEXT NOT NULL,
    kategori TEXT NOT NULL,
    dusun TEXT NOT NULL,
    lokasi_detail TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Menunggu', 'Diproses', 'Selesai', 'Ditolak')),
    tanggapan_admin TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS surat_keterangan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_permohonan TEXT NOT NULL UNIQUE,
    nomor_surat TEXT,
    user_id INTEGER NOT NULL,
    nik_pemohon TEXT NOT NULL,
    dusun TEXT NOT NULL,
    jenis_surat TEXT NOT NULL,
    keperluan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Menunggu', 'Diproses', 'Selesai', 'Ditolak')),
    catatan_admin TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export function seedInitialData(): void {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
  if (existing.count > 0) {
    return;
  }

  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'AdminTundagan#2026';
  const wargaPass1 = 'WargaTundagan#2026';
  const wargaPass2 = 'WargaSiti#2026';

  const insertUser = db.prepare(`
    INSERT INTO users (username, full_name, email, nik, dusun, role, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const adminRes = insertUser.run(
    'admin_tundagan',
    'Hendra Wijaya (Sekretaris Desa)',
    'sekdes@tundagan-kuningan.desa.id',
    '3208151204850001',
    'Dusun Manis',
    'admin',
    bcrypt.hashSync(adminPass, 12)
  );

  const warga1Res = insertUser.run(
    'warga_asep',
    'Asep Saepudin',
    'asep.saepudin@warga.tundagan.id',
    '3208152408920003',
    'Dusun Pahing',
    'warga',
    bcrypt.hashSync(wargaPass1, 12)
  );

  const warga2Res = insertUser.run(
    'warga_siti',
    'Siti Aminah',
    'siti.aminah@warga.tundagan.id',
    '3208155506950002',
    'Dusun Manis',
    'warga',
    bcrypt.hashSync(wargaPass2, 12)
  );

  const warga1Id = Number(warga1Res.lastInsertRowid);
  const warga2Id = Number(warga2Res.lastInsertRowid);
  const adminId = Number(adminRes.lastInsertRowid);

  const insertPengaduan = db.prepare(`
    INSERT INTO pengaduan (kode_tiket, user_id, judul, kategori, dusun, lokasi_detail, deskripsi, status, tanggapan_admin, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
  `);

  insertPengaduan.run(
    'ADU-TDG-2026-001',
    warga1Id,
    'Perbaikan Saluran Irigasi Blok Sawah Legok',
    'Irigasi & Pertanian',
    'Dusun Pahing',
    'RT 03 / RW 02, Saluran Sekunder Blok Legok',
    'Terdapat endapan lumpur dan longsoran kecil sepanjang 12 meter di saluran irigasi sehingga aliran air ke area persawahan warga terhambat saat musim tanam.',
    'Diproses',
    'Tim Kaur Pembangunan bersama kelompok tani sudah meninjau lokasi. Pengerukan dijadwalkan hari Jumat melalui kerja bakti dan dukungan material desa.',
    '-6 days',
    '-2 days'
  );

  insertPengaduan.run(
    'ADU-TDG-2026-002',
    warga1Id,
    'Lampu Penerangan Jalan Umum Padam di Tanjakan Cijaha',
    'Penerangan Jalan Umum',
    'Dusun Pahing',
    'Pertigaan Jalan Desa arah Hantara RT 04',
    'Dua unit lampu PJU tenaga surya di tanjakan Cijaha mati sejak tiga hari lalu sehingga jalan gelap pada malam hari dan rawan bagi pengendara.',
    'Menunggu',
    null,
    '-2 days',
    '-2 days'
  );

  insertPengaduan.run(
    'ADU-TDG-2026-003',
    warga2Id,
    'Pengaspalan Ulang Jalan Lingkungan Gang Masjid',
    'Infrastruktur & Jalan Desa',
    'Dusun Manis',
    'Gang Masjid Al-Ikhlas RT 01 / RW 01',
    'Permukaan rabat beton di beberapa titik mulai retak dan terkelupas akibat genangan air hujan. Mohon penambalan sebelum semakin melebar.',
    'Selesai',
    'Perbaikan rabat beton telah selesai dilaksanakan menggunakan anggaran pemeliharaan infrastruktur tahap I. Terima kasih atas partisipasi warga.',
    '-14 days',
    '-3 days'
  );

  insertPengaduan.run(
    'ADU-TDG-2026-004',
    warga2Id,
    'Jadwal Pengangkutan Sampah TPS Dusun Manis',
    'Kebersihan & Lingkungan',
    'Dusun Manis',
    'TPS Sementara dekat Lapangan Desa',
    'Volume sampah rumah tangga meningkat pasca acara bersih desa. Mohon penambahan jadwal angkut minggu ini agar tidak menimbulkan bau.',
    'Selesai',
    'Petugas kebersihan BUMDes telah melakukan pengangkutan ekstra pada hari Rabu pagi.',
    '-10 days',
    '-5 days'
  );

  const insertSurat = db.prepare(`
    INSERT INTO surat_keterangan (kode_permohonan, nomor_surat, user_id, nik_pemohon, dusun, jenis_surat, keperluan, status, catatan_admin, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))
  `);

  insertSurat.run(
    'SRT-TDG-2026-001',
    '470/018/Pemdes-TDG/XI/2026',
    warga1Id,
    '3208152408920003',
    'Dusun Pahing',
    'Surat Keterangan Usaha (SKU)',
    'Pengajuan Kredit Usaha Rakyat (KUR) untuk pengembangan usaha pengolahan gula aren Tundagan.',
    'Selesai',
    'Surat telah ditandatangani Kepala Desa dan dapat diambil di loket pelayanan Balai Desa Tundagan.',
    '-8 days',
    '-4 days'
  );

  insertSurat.run(
    'SRT-TDG-2026-002',
    null,
    warga1Id,
    '3208152408920003',
    'Dusun Pahing',
    'Surat Pengantar SKCK',
    'Melengkapi berkas lamaran kerja di wilayah Kabupaten Kuningan.',
    'Menunggu',
    null,
    '-1 day',
    '-1 day'
  );

  insertSurat.run(
    'SRT-TDG-2026-003',
    null,
    warga2Id,
    '3208155506950002',
    'Dusun Manis',
    'Surat Keterangan Domisili',
    'Keperluan administrasi perbankan dan pembaruan data rekening keluarga.',
    'Diproses',
    'Verifikasi berkas RT/RW telah diterima, sedang dalam proses penomoran surat oleh Kaur Umum.',
    '-3 days',
    '-1 day'
  );

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_id, username, action, resource, status_code, ip_address, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  insertAudit.run(
    adminId,
    'admin_tundagan',
    'SYSTEM_SEED',
    '/system/init',
    200,
    '127.0.0.1',
    'Inisialisasi skema SQLite dan akun awal dengan hashing bcrypt (cost 12).',
    '-14 days'
  );
  insertAudit.run(
    warga1Id,
    'warga_asep',
    'CREATE_PENGADUAN',
    '/api/pengaduan',
    201,
    '192.168.1.24',
    'Pengaduan baru ADU-TDG-2026-001 dibuat dengan sanitasi input dan prepared statement.',
    '-6 days'
  );
  insertAudit.run(
    adminId,
    'admin_tundagan',
    'UPDATE_SURAT_STATUS',
    '/api/surat/1',
    200,
    '192.168.1.10',
    'Nomor surat 470/018/Pemdes-TDG/XI/2026 diterbitkan untuk permohonan SRT-TDG-2026-001.',
    '-4 days'
  );
}
