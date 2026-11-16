import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import { db, seedInitialData } from './server/db.ts';
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  TOKEN_TTL_SECONDS,
  createSignedCsrfToken,
  getClientIp,
  isHttpsRequest,
  logAudit,
  maskNik,
  requireAuth,
  requireRole,
  sanitizeCsvCell,
  sanitizeText,
  signSessionToken,
  strongPasswordSchema,
  verifyCsrf,
  verifySignedCsrfToken,
  type AuthenticatedRequest,
} from './server/security.ts';
import {
  DUSUN_LIST,
  JENIS_SURAT,
  KATEGORI_PENGADUAN,
  STATUS_OPTIONS,
} from './src/shared/constants.ts';

dotenv.config();
seedInitialData();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Penting untuk reverse proxy Cloud Run / Vercel / Render agar IP & HTTPS header akurat
app.set('trust proxy', 1);

// Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'", 'https://aistudio.google.com', 'https://*.google.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
    frameguard: false, // Controlled cleanly by CSP frame-ancestors
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// Header keamanan tambahan
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

// Rate Limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan dari IP Anda. Silakan coba lagi beberapa menit lagi.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logAudit({
      username: typeof req.body?.username === 'string' ? req.body.username : null,
      action: 'RATE_LIMIT_LOGIN',
      resource: '/api/auth/login',
      statusCode: 429,
      ipAddress: getClientIp(req),
      details: 'Percobaan login gagal melebihi batas (5 kali / 15 menit). IP diblokir sementara.',
    });
    res.status(429).json({
      error:
        'Terlalu banyak percobaan login gagal (maksimal 5 kali dalam 15 menit). Silakan tunggu sebelum mencoba kembali.',
    });
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak pendaftaran dari IP Anda. Silakan coba lagi nanti.' },
});

app.use('/api', apiLimiter);

function parsePositiveId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') return null;
  if (!/^\d+$/.test(raw)) return null;
  const num = Number(raw);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

// ---------------------------------------------------------------------------
// Auth & Session Routes
// ---------------------------------------------------------------------------

app.get('/api/auth/csrf-token', (req, res) => {
  const existingCookie = req.cookies?.[CSRF_COOKIE_NAME];
  const token =
    typeof existingCookie === 'string' && verifySignedCsrfToken(existingCookie)
      ? existingCookie
      : createSignedCsrfToken();

  const secure = isHttpsRequest(req);
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
  });
  res.json({ csrfToken: token });
});

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(4, 'Username minimal 4 karakter')
    .max(32, 'Username maksimal 32 karakter')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username hanya boleh huruf, angka, dan underscore (_)'),
  full_name: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter').max(80),
  email: z.string().trim().email('Format email tidak valid').max(100),
  nik: z
    .string()
    .trim()
    .regex(/^\d{16}$/, 'NIK harus tepat 16 digit angka'),
  dusun: z.enum(DUSUN_LIST, { error: 'Pilihan dusun tidak valid' }),
  password: strongPasswordSchema,
});

app.post('/api/auth/register', registerLimiter, verifyCsrf, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data registrasi tidak valid.' });
    return;
  }

  const username = sanitizeText(parsed.data.username).toLowerCase();
  const fullName = sanitizeText(parsed.data.full_name);
  const email = sanitizeText(parsed.data.email).toLowerCase();
  const { nik, dusun, password } = parsed.data;

  if (fullName.length < 3) {
    res.status(400).json({ error: 'Nama lengkap tidak valid setelah sanitasi.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?')
    .get(username, email) as { id: number } | undefined;

  if (existing) {
    res.status(409).json({ error: 'Username atau email sudah terdaftar.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Role dipaksa 'warga' di server untuk mencegah Privilege Escalation
  const result = db
    .prepare(
      `INSERT INTO users (username, full_name, email, nik, dusun, role, password_hash)
       VALUES (?, ?, ?, ?, ?, 'warga', ?)`
    )
    .run(username, fullName, email, nik, dusun, passwordHash);

  const userId = Number(result.lastInsertRowid);

  logAudit({
    userId,
    username,
    action: 'REGISTER_WARGA',
    resource: '/api/auth/register',
    statusCode: 201,
    ipAddress: getClientIp(req),
    details: `Registrasi warga baru (${dusun}) berhasil dengan hashing bcrypt.`,
  });

  res.status(201).json({
    message: 'Registrasi berhasil. Silakan login menggunakan akun yang baru dibuat.',
  });
});

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username wajib diisi').max(64),
  password: z.string().min(1, 'Password wajib diisi').max(72),
});

app.post('/api/auth/login', loginLimiter, verifyCsrf, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Input login tidak valid.' });
    return;
  }

  const identifier = sanitizeText(parsed.data.username).toLowerCase();
  const { password } = parsed.data;

  const user = db
    .prepare(
      `SELECT id, username, full_name, email, nik, dusun, role, password_hash, created_at
       FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?`
    )
    .get(identifier, identifier) as
    | {
        id: number;
        username: string;
        full_name: string;
        email: string;
        nik: string | null;
        dusun: string;
        role: 'admin' | 'warga';
        password_hash: string;
        created_at: string;
      }
    | undefined;

  const passwordValid = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !passwordValid) {
    logAudit({
      userId: user?.id ?? null,
      username: identifier,
      action: 'LOGIN_FAILED',
      resource: '/api/auth/login',
      statusCode: 401,
      ipAddress: getClientIp(req),
      details: 'Username atau password salah.',
    });
    res.status(401).json({ error: 'Username atau password salah.' });
    return;
  }

  const token = signSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  const secure = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
  });

  // Jika browser memblokir cookie (misal iframe pihak ketiga), sediakan token memori sementara
  const cookiesBlocked = typeof req.cookies?.[CSRF_COOKIE_NAME] !== 'string';

  logAudit({
    userId: user.id,
    username: user.username,
    action: 'LOGIN_SUCCESS',
    resource: '/api/auth/login',
    statusCode: 200,
    ipAddress: getClientIp(req),
    details: `Login berhasil sebagai peran '${user.role}'. Cookie sesi HttpOnly diterbitkan.`,
  });

  res.json({
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      nik_masked: maskNik(user.nik),
      dusun: user.dusun,
      role: user.role,
      created_at: user.created_at,
    },
    ...(cookiesBlocked ? { iframeSessionToken: token } : {}),
  });
});

app.post('/api/auth/logout', verifyCsrf, (req: AuthenticatedRequest, res) => {
  const secure = isHttpsRequest(req);
  const existingCookie = req.cookies?.[SESSION_COOKIE_NAME];
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  });

  if (existingCookie) {
    logAudit({
      action: 'LOGOUT',
      resource: '/api/auth/logout',
      statusCode: 200,
      ipAddress: getClientIp(req),
      details: 'Pengguna melakukan logout dan cookie sesi HttpOnly dibersihkan.',
    });
  }

  res.json({ message: 'Logout berhasil.' });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const userRow = db
    .prepare('SELECT id, username, full_name, email, nik, dusun, role, created_at FROM users WHERE id = ?')
    .get(req.user!.id) as
    | {
        id: number;
        username: string;
        full_name: string;
        email: string;
        nik: string | null;
        dusun: string;
        role: 'admin' | 'warga';
        created_at: string;
      }
    | undefined;

  if (!userRow) {
    res.status(401).json({ error: 'Pengguna tidak ditemukan.' });
    return;
  }

  res.json({
    user: {
      id: userRow.id,
      username: userRow.username,
      full_name: userRow.full_name,
      email: userRow.email,
      nik_masked: maskNik(userRow.nik),
      dusun: userRow.dusun,
      role: userRow.role,
      created_at: userRow.created_at,
    },
  });
});

// ---------------------------------------------------------------------------
// Pengaduan Warga CRUD Routes
// ---------------------------------------------------------------------------

const createPengaduanSchema = z.object({
  judul: z.string().trim().min(5, 'Judul pengaduan minimal 5 karakter').max(120),
  kategori: z.enum(KATEGORI_PENGADUAN, { error: 'Kategori pengaduan tidak valid' }),
  dusun: z.enum(DUSUN_LIST, { error: 'Dusun tidak valid' }),
  lokasi_detail: z.string().trim().min(4, 'Detail lokasi minimal 4 karakter').max(160),
  deskripsi: z.string().trim().min(15, 'Deskripsi pengaduan minimal 15 karakter').max(1500),
});

const adminUpdatePengaduanSchema = z.object({
  status: z.enum(STATUS_OPTIONS, { error: 'Status tidak valid' }),
  tanggapan_admin: z.string().trim().max(1000).optional().nullable(),
});

app.get('/api/pengaduan', requireAuth, (req: AuthenticatedRequest, res) => {
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : '';
  const dusunFilter = typeof req.query.dusun === 'string' ? req.query.dusun : '';
  const search = typeof req.query.search === 'string' ? sanitizeText(req.query.search).slice(0, 80) : '';

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (req.user!.role !== 'admin') {
    conditions.push('p.user_id = ?');
    params.push(req.user!.id);
  }

  if (statusFilter && (STATUS_OPTIONS as readonly string[]).includes(statusFilter)) {
    conditions.push('p.status = ?');
    params.push(statusFilter);
  }

  if (dusunFilter && (DUSUN_LIST as readonly string[]).includes(dusunFilter)) {
    conditions.push('p.dusun = ?');
    params.push(dusunFilter);
  }

  if (search) {
    conditions.push('(p.judul LIKE ? OR p.kode_tiket LIKE ? OR p.lokasi_detail LIKE ?)');
    const likeTerm = `%${search}%`;
    params.push(likeTerm, likeTerm, likeTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT p.id, p.kode_tiket, p.user_id, u.full_name AS pelapor_nama,
              p.judul, p.kategori, p.dusun, p.lokasi_detail, p.deskripsi,
              p.status, p.tanggapan_admin, p.created_at, p.updated_at
       FROM pengaduan p
       JOIN users u ON u.id = p.user_id
       ${whereClause}
       ORDER BY p.id DESC`
    )
    .all(...params);

  res.json({ data: rows });
});

app.get('/api/pengaduan/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Parameter ID pengaduan harus berupa angka positif.' });
    return;
  }

  const row = db
    .prepare(
      `SELECT p.id, p.kode_tiket, p.user_id, u.full_name AS pelapor_nama,
              p.judul, p.kategori, p.dusun, p.lokasi_detail, p.deskripsi,
              p.status, p.tanggapan_admin, p.created_at, p.updated_at
       FROM pengaduan p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`
    )
    .get(id) as { user_id: number } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Pengaduan tidak ditemukan.' });
    return;
  }

  // Proteksi IDOR
  if (req.user!.role !== 'admin' && row.user_id !== req.user!.id) {
    logAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'IDOR_ATTEMPT_BLOCKED',
      resource: `/api/pengaduan/${id}`,
      statusCode: 403,
      ipAddress: getClientIp(req),
      details: `Warga mencoba mengakses pengaduan #${id} milik pengguna lain.`,
    });
    res.status(403).json({
      error: 'Akses ditolak (403 Forbidden). Anda tidak dapat melihat pengaduan milik warga lain.',
    });
    return;
  }

  res.json({ data: row });
});

app.post('/api/pengaduan', requireAuth, verifyCsrf, (req: AuthenticatedRequest, res) => {
  const parsed = createPengaduanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data pengaduan tidak valid.' });
    return;
  }

  const judul = sanitizeText(parsed.data.judul);
  const lokasi = sanitizeText(parsed.data.lokasi_detail);
  const deskripsi = sanitizeText(parsed.data.deskripsi);

  if (judul.length < 5 || lokasi.length < 4 || deskripsi.length < 15) {
    res.status(400).json({ error: 'Konten pengaduan tidak memenuhi panjang minimum setelah sanitasi.' });
    return;
  }

  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM pengaduan').get() as { cnt: number };
  const suffix = String(countRow.cnt + 1).padStart(3, '0');
  const randomCode = crypto.randomInt(10, 99);
  const kodeTiket = `ADU-TDG-2026-${suffix}${randomCode}`;

  const result = db
    .prepare(
      `INSERT INTO pengaduan (kode_tiket, user_id, judul, kategori, dusun, lokasi_detail, deskripsi)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(kodeTiket, req.user!.id, judul, parsed.data.kategori, parsed.data.dusun, lokasi, deskripsi);

  const created = db
    .prepare(
      `SELECT p.*, u.full_name AS pelapor_nama
       FROM pengaduan p JOIN users u ON u.id = p.user_id WHERE p.id = ?`
    )
    .get(Number(result.lastInsertRowid));

  logAudit({
    userId: req.user!.id,
    username: req.user!.username,
    action: 'CREATE_PENGADUAN',
    resource: '/api/pengaduan',
    statusCode: 201,
    ipAddress: getClientIp(req),
    details: `Pengaduan ${kodeTiket} dibuat di ${parsed.data.dusun}.`,
  });

  res.status(201).json({ data: created });
});

app.put('/api/pengaduan/:id', requireAuth, verifyCsrf, (req: AuthenticatedRequest, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Parameter ID pengaduan tidak valid.' });
    return;
  }

  const existing = db.prepare('SELECT * FROM pengaduan WHERE id = ?').get(id) as
    | { id: number; user_id: number; status: string; kode_tiket: string }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Pengaduan tidak ditemukan.' });
    return;
  }

  if (req.user!.role === 'admin') {
    const parsed = adminUpdatePengaduanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Input pembaruan tidak valid.' });
      return;
    }

    const tanggapan = parsed.data.tanggapan_admin ? sanitizeText(parsed.data.tanggapan_admin) : null;
    db.prepare(
      `UPDATE pengaduan
       SET status = ?, tanggapan_admin = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(parsed.data.status, tanggapan, id);

    logAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'UPDATE_PENGADUAN_STATUS',
      resource: `/api/pengaduan/${id}`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      details: `Status ${existing.kode_tiket} diubah menjadi '${parsed.data.status}'.`,
    });
  } else {
    // IDOR check
    if (existing.user_id !== req.user!.id) {
      logAudit({
        userId: req.user!.id,
        username: req.user!.username,
        action: 'IDOR_ATTEMPT_BLOCKED',
        resource: `/api/pengaduan/${id}`,
        statusCode: 403,
        ipAddress: getClientIp(req),
        details: `Percobaan ubah pengaduan #${id} milik pengguna lain diblokir.`,
      });
      res.status(403).json({ error: 'Akses ditolak. Anda hanya dapat mengubah pengaduan milik Anda sendiri.' });
      return;
    }

    if (existing.status !== 'Menunggu') {
      res.status(400).json({ error: 'Pengaduan yang sudah diproses perangkat desa tidak dapat diubah lagi.' });
      return;
    }

    const parsed = createPengaduanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data pengaduan tidak valid.' });
      return;
    }

    db.prepare(
      `UPDATE pengaduan
       SET judul = ?, kategori = ?, dusun = ?, lokasi_detail = ?, deskripsi = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    ).run(
      sanitizeText(parsed.data.judul),
      parsed.data.kategori,
      parsed.data.dusun,
      sanitizeText(parsed.data.lokasi_detail),
      sanitizeText(parsed.data.deskripsi),
      id,
      req.user!.id
    );

    logAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'UPDATE_PENGADUAN',
      resource: `/api/pengaduan/${id}`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      details: `Pengaduan ${existing.kode_tiket} diperbarui oleh pelapor.`,
    });
  }

  const updated = db
    .prepare(
      `SELECT p.*, u.full_name AS pelapor_nama
       FROM pengaduan p JOIN users u ON u.id = p.user_id WHERE p.id = ?`
    )
    .get(id);
  res.json({ data: updated });
});

app.delete('/api/pengaduan/:id', requireAuth, verifyCsrf, (req: AuthenticatedRequest, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Parameter ID pengaduan tidak valid.' });
    return;
  }

  const existing = db.prepare('SELECT id, user_id, status, kode_tiket FROM pengaduan WHERE id = ?').get(id) as
    | { id: number; user_id: number; status: string; kode_tiket: string }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Pengaduan tidak ditemukan.' });
    return;
  }

  if (req.user!.role !== 'admin') {
    if (existing.user_id !== req.user!.id) {
      logAudit({
        userId: req.user!.id,
        username: req.user!.username,
        action: 'IDOR_ATTEMPT_BLOCKED',
        resource: `/api/pengaduan/${id}`,
        statusCode: 403,
        ipAddress: getClientIp(req),
        details: `Percobaan hapus pengaduan #${id} milik pengguna lain diblokir.`,
      });
      res.status(403).json({ error: 'Akses ditolak. Anda tidak dapat menghapus pengaduan warga lain.' });
      return;
    }
    if (existing.status !== 'Menunggu') {
      res.status(400).json({ error: 'Pengaduan yang sudah diproses tidak dapat dihapus oleh warga.' });
      return;
    }
  }

  db.prepare('DELETE FROM pengaduan WHERE id = ?').run(id);
  logAudit({
    userId: req.user!.id,
    username: req.user!.username,
    action: 'DELETE_PENGADUAN',
    resource: `/api/pengaduan/${id}`,
    statusCode: 200,
    ipAddress: getClientIp(req),
    details: `Pengaduan ${existing.kode_tiket} dihapus.`,
  });

  res.json({ message: 'Pengaduan berhasil dihapus.' });
});

// ---------------------------------------------------------------------------
// Permohonan Surat Keterangan CRUD Routes
// ---------------------------------------------------------------------------

const createSuratSchema = z.object({
  nik_pemohon: z.string().trim().regex(/^\d{16}$/, 'NIK harus tepat 16 digit angka'),
  dusun: z.enum(DUSUN_LIST, { error: 'Dusun tidak valid' }),
  jenis_surat: z.enum(JENIS_SURAT, { error: 'Jenis surat tidak valid' }),
  keperluan: z.string().trim().min(10, 'Keperluan minimal 10 karakter').max(600),
});

const adminUpdateSuratSchema = z.object({
  status: z.enum(STATUS_OPTIONS, { error: 'Status tidak valid' }),
  nomor_surat: z.string().trim().max(80).optional().nullable(),
  catatan_admin: z.string().trim().max(600).optional().nullable(),
});

app.get('/api/surat', requireAuth, (req: AuthenticatedRequest, res) => {
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : '';
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (req.user!.role !== 'admin') {
    conditions.push('s.user_id = ?');
    params.push(req.user!.id);
  }

  if (statusFilter && (STATUS_OPTIONS as readonly string[]).includes(statusFilter)) {
    conditions.push('s.status = ?');
    params.push(statusFilter);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT s.id, s.kode_permohonan, s.nomor_surat, s.user_id, u.full_name AS pemohon_nama,
              s.nik_pemohon, s.dusun, s.jenis_surat, s.keperluan, s.status, s.catatan_admin,
              s.created_at, s.updated_at
       FROM surat_keterangan s
       JOIN users u ON u.id = s.user_id
       ${whereClause}
       ORDER BY s.id DESC`
    )
    .all(...params) as Array<Record<string, unknown>>;

  const formatted = rows.map((r) => ({
    id: r.id,
    kode_permohonan: r.kode_permohonan,
    nomor_surat: r.nomor_surat,
    user_id: r.user_id,
    pemohon_nama: r.pemohon_nama,
    nik_masked: maskNik(String(r.nik_pemohon || '')),
    dusun: r.dusun,
    jenis_surat: r.jenis_surat,
    keperluan: r.keperluan,
    status: r.status,
    catatan_admin: r.catatan_admin,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  res.json({ data: formatted });
});

app.get('/api/surat/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Parameter ID permohonan surat harus angka positif.' });
    return;
  }

  const row = db
    .prepare(
      `SELECT s.*, u.full_name AS pemohon_nama
       FROM surat_keterangan s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Permohonan surat tidak ditemukan.' });
    return;
  }

  if (req.user!.role !== 'admin' && row.user_id !== req.user!.id) {
    logAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'IDOR_ATTEMPT_BLOCKED',
      resource: `/api/surat/${id}`,
      statusCode: 403,
      ipAddress: getClientIp(req),
      details: `Warga mencoba mengakses permohonan surat #${id} milik pengguna lain.`,
    });
    res.status(403).json({ error: 'Akses ditolak (403 Forbidden). Data surat milik warga lain dilindungi.' });
    return;
  }

  res.json({
    data: {
      ...row,
      nik_masked: maskNik(String(row.nik_pemohon || '')),
      nik_pemohon: undefined,
    },
  });
});

app.post('/api/surat', requireAuth, verifyCsrf, (req: AuthenticatedRequest, res) => {
  const parsed = createSuratSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data permohonan surat tidak valid.' });
    return;
  }

  const keperluan = sanitizeText(parsed.data.keperluan);
  if (keperluan.length < 10) {
    res.status(400).json({ error: 'Keperluan surat tidak valid setelah sanitasi.' });
    return;
  }

  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM surat_keterangan').get() as { cnt: number };
  const suffix = String(countRow.cnt + 1).padStart(3, '0');
  const randomCode = crypto.randomInt(10, 99);
  const kodePermohonan = `SRT-TDG-2026-${suffix}${randomCode}`;

  const result = db
    .prepare(
      `INSERT INTO surat_keterangan (kode_permohonan, user_id, nik_pemohon, dusun, jenis_surat, keperluan)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(kodePermohonan, req.user!.id, parsed.data.nik_pemohon, parsed.data.dusun, parsed.data.jenis_surat, keperluan);

  logAudit({
    userId: req.user!.id,
    username: req.user!.username,
    action: 'CREATE_SURAT',
    resource: '/api/surat',
    statusCode: 201,
    ipAddress: getClientIp(req),
    details: `Permohonan ${kodePermohonan} (${parsed.data.jenis_surat}) dibuat.`,
  });

  res.status(201).json({
    data: {
      id: Number(result.lastInsertRowid),
      kode_permohonan: kodePermohonan,
    },
  });
});

app.put('/api/surat/:id', requireAuth, verifyCsrf, (req: AuthenticatedRequest, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Parameter ID surat tidak valid.' });
    return;
  }

  const existing = db.prepare('SELECT * FROM surat_keterangan WHERE id = ?').get(id) as
    | { id: number; user_id: number; status: string; kode_permohonan: string }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Permohonan surat tidak ditemukan.' });
    return;
  }

  if (req.user!.role === 'admin') {
    const parsed = adminUpdateSuratSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Pembaruan surat tidak valid.' });
      return;
    }

    const nomorSurat = parsed.data.nomor_surat ? sanitizeText(parsed.data.nomor_surat) : null;
    const catatan = parsed.data.catatan_admin ? sanitizeText(parsed.data.catatan_admin) : null;

    db.prepare(
      `UPDATE surat_keterangan
       SET status = ?, nomor_surat = ?, catatan_admin = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(parsed.data.status, nomorSurat, catatan, id);

    logAudit({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'UPDATE_SURAT_STATUS',
      resource: `/api/surat/${id}`,
      statusCode: 200,
      ipAddress: getClientIp(req),
      details: `Permohonan ${existing.kode_permohonan} diperbarui menjadi '${parsed.data.status}'.`,
    });
  } else {
    if (existing.user_id !== req.user!.id) {
      logAudit({
        userId: req.user!.id,
        username: req.user!.username,
        action: 'IDOR_ATTEMPT_BLOCKED',
        resource: `/api/surat/${id}`,
        statusCode: 403,
        ipAddress: getClientIp(req),
        details: `Percobaan ubah surat #${id} milik warga lain diblokir.`,
      });
      res.status(403).json({ error: 'Akses ditolak. Anda hanya dapat mengubah permohonan milik sendiri.' });
      return;
    }

    if (existing.status !== 'Menunggu') {
      res.status(400).json({ error: 'Permohonan surat yang sedang diproses tidak dapat diubah lagi.' });
      return;
    }

    const parsed = createSuratSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Input surat tidak valid.' });
      return;
    }

    db.prepare(
      `UPDATE surat_keterangan
       SET nik_pemohon = ?, dusun = ?, jenis_surat = ?, keperluan = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    ).run(
      parsed.data.nik_pemohon,
      parsed.data.dusun,
      parsed.data.jenis_surat,
      sanitizeText(parsed.data.keperluan),
      id,
      req.user!.id
    );
  }

  res.json({ message: 'Permohonan surat berhasil diperbarui.' });
});

app.delete('/api/surat/:id', requireAuth, verifyCsrf, (req: AuthenticatedRequest, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'Parameter ID surat tidak valid.' });
    return;
  }

  const existing = db.prepare('SELECT id, user_id, status, kode_permohonan FROM surat_keterangan WHERE id = ?').get(id) as
    | { id: number; user_id: number; status: string; kode_permohonan: string }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Permohonan surat tidak ditemukan.' });
    return;
  }

  if (req.user!.role !== 'admin') {
    if (existing.user_id !== req.user!.id) {
      logAudit({
        userId: req.user!.id,
        username: req.user!.username,
        action: 'IDOR_ATTEMPT_BLOCKED',
        resource: `/api/surat/${id}`,
        statusCode: 403,
        ipAddress: getClientIp(req),
        details: `Percobaan hapus surat #${id} milik warga lain diblokir.`,
      });
      res.status(403).json({ error: 'Akses ditolak. Anda tidak dapat membatalkan permohonan milik warga lain.' });
      return;
    }
    if (existing.status !== 'Menunggu') {
      res.status(400).json({ error: 'Permohonan yang sudah diproses tidak dapat dibatalkan.' });
      return;
    }
  }

  db.prepare('DELETE FROM surat_keterangan WHERE id = ?').run(id);
  logAudit({
    userId: req.user!.id,
    username: req.user!.username,
    action: 'DELETE_SURAT',
    resource: `/api/surat/${id}`,
    statusCode: 200,
    ipAddress: getClientIp(req),
    details: `Permohonan ${existing.kode_permohonan} dihapus.`,
  });

  res.json({ message: 'Permohonan surat berhasil dihapus.' });
});

// ---------------------------------------------------------------------------
// Laporan & Ekspor Routes
// ---------------------------------------------------------------------------

app.get('/api/laporan/summary', requireAuth, (req: AuthenticatedRequest, res) => {
  const isAdmin = req.user!.role === 'admin';
  const userFilter = isAdmin ? '' : 'WHERE user_id = ?';
  const params = isAdmin ? [] : [req.user!.id];

  const pengaduanByStatus = db
    .prepare(`SELECT status, COUNT(*) AS total FROM pengaduan ${userFilter} GROUP BY status`)
    .all(...params) as Array<{ status: string; total: number }>;

  const suratByStatus = db
    .prepare(`SELECT status, COUNT(*) AS total FROM surat_keterangan ${userFilter} GROUP BY status`)
    .all(...params) as Array<{ status: string; total: number }>;

  const pengaduanByDusun = db
    .prepare(`SELECT dusun, COUNT(*) AS total FROM pengaduan ${userFilter} GROUP BY dusun ORDER BY total DESC`)
    .all(...params) as Array<{ dusun: string; total: number }>;

  const pengaduanByKategori = db
    .prepare(`SELECT kategori, COUNT(*) AS total FROM pengaduan ${userFilter} GROUP BY kategori ORDER BY total DESC`)
    .all(...params) as Array<{ kategori: string; total: number }>;

  const suratByJenis = db
    .prepare(`SELECT jenis_surat, COUNT(*) AS total FROM surat_keterangan ${userFilter} GROUP BY jenis_surat ORDER BY total DESC`)
    .all(...params) as Array<{ jenis_surat: string; total: number }>;

  res.json({
    scope: isAdmin ? 'Desa Tundagan (Seluruh Wilayah)' : `Akun Pribadi (${req.user!.full_name})`,
    pengaduanByStatus,
    suratByStatus,
    pengaduanByDusun,
    pengaduanByKategori,
    suratByJenis,
  });
});

app.get('/api/laporan/export-csv', requireAuth, (req: AuthenticatedRequest, res) => {
  const jenis = req.query.jenis === 'surat' ? 'surat' : 'pengaduan';
  const isAdmin = req.user!.role === 'admin';

  let csvLines: string[] = [];

  if (jenis === 'pengaduan') {
    const rows = (
      isAdmin
        ? db
            .prepare(
              `SELECT p.kode_tiket, u.full_name AS pelapor, p.dusun, p.kategori, p.judul, p.lokasi_detail, p.status, p.tanggapan_admin, p.created_at
               FROM pengaduan p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC`
            )
            .all()
        : db
            .prepare(
              `SELECT p.kode_tiket, u.full_name AS pelapor, p.dusun, p.kategori, p.judul, p.lokasi_detail, p.status, p.tanggapan_admin, p.created_at
               FROM pengaduan p JOIN users u ON u.id = p.user_id WHERE p.user_id = ? ORDER BY p.id DESC`
            )
            .all(req.user!.id)
    ) as Array<Record<string, string | null>>;

    csvLines.push(
      ['Kode Tiket', 'Nama Pelapor', 'Dusun', 'Kategori', 'Judul Pengaduan', 'Lokasi', 'Status', 'Tanggapan Desa', 'Tanggal Dibuat']
        .map(sanitizeCsvCell)
        .join(',')
    );

    for (const r of rows) {
      csvLines.push(
        [r.kode_tiket, r.pelapor, r.dusun, r.kategori, r.judul, r.lokasi_detail, r.status, r.tanggapan_admin ?? '-', r.created_at]
          .map(sanitizeCsvCell)
          .join(',')
      );
    }
  } else {
    const rows = (
      isAdmin
        ? db
            .prepare(
              `SELECT s.kode_permohonan, s.nomor_surat, u.full_name AS pemohon, s.nik_pemohon, s.dusun, s.jenis_surat, s.keperluan, s.status, s.created_at
               FROM surat_keterangan s JOIN users u ON u.id = s.user_id ORDER BY s.id DESC`
            )
            .all()
        : db
            .prepare(
              `SELECT s.kode_permohonan, s.nomor_surat, u.full_name AS pemohon, s.nik_pemohon, s.dusun, s.jenis_surat, s.keperluan, s.status, s.created_at
               FROM surat_keterangan s JOIN users u ON u.id = s.user_id WHERE s.user_id = ? ORDER BY s.id DESC`
            )
            .all(req.user!.id)
    ) as Array<Record<string, string | null>>;

    csvLines.push(
      ['Kode Permohonan', 'Nomor Surat', 'Pemohon', 'NIK (Masked)', 'Dusun', 'Jenis Surat', 'Keperluan', 'Status', 'Tanggal']
        .map(sanitizeCsvCell)
        .join(',')
    );

    for (const r of rows) {
      csvLines.push(
        [
          r.kode_permohonan,
          r.nomor_surat ?? '-',
          r.pemohon,
          maskNik(r.nik_pemohon),
          r.dusun,
          r.jenis_surat,
          r.keperluan,
          r.status,
          r.created_at,
        ]
          .map(sanitizeCsvCell)
          .join(',')
      );
    }
  }

  logAudit({
    userId: req.user!.id,
    username: req.user!.username,
    action: 'EXPORT_CSV',
    resource: `/api/laporan/export-csv?jenis=${jenis}`,
    statusCode: 200,
    ipAddress: getClientIp(req),
    details: `Ekspor CSV laporan ${jenis} (${isAdmin ? 'seluruh desa' : 'milik pribadi'}) dengan proteksi CSV Formula Injection.`,
  });

  const filename = `rekap_${jenis}_desa_tundagan_${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csvLines.join('\n'));
});

// ---------------------------------------------------------------------------
// Admin-Only RBAC Routes (Audit Logs & Daftar Akun)
// ---------------------------------------------------------------------------

app.get('/api/admin/audit-logs', requireAuth, requireRole('admin'), (_req, res) => {
  const logs = db
    .prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100')
    .all();
  res.json({ data: logs });
});

app.get('/api/admin/users', requireAuth, requireRole('admin'), (_req, res) => {
  const users = db
    .prepare('SELECT id, username, full_name, email, nik, dusun, role, created_at FROM users ORDER BY id ASC')
    .all() as Array<Record<string, unknown>>;

  res.json({
    data: users.map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      email: u.email,
      nik_masked: maskNik(typeof u.nik === 'string' ? u.nik : null),
      dusun: u.dusun,
      role: u.role,
      created_at: u.created_at,
    })),
  });
});

// Health endpoint minimal tanpa membocorkan info sensitif
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sipadu-desa-tundagan' });
});

app.get('/TugasProject_CyberSec_SIPADU_Desa_Tundagan.docx', (_req, res) => {
  const docxPath = path.resolve(process.cwd(), 'public', 'TugasProject_CyberSec_SIPADU_Desa_Tundagan.docx');
  if (!fs.existsSync(docxPath)) {
    res.status(404).json({ error: 'Berkas laporan DOCX tidak ditemukan.' });
    return;
  }
  res.download(docxPath, 'TugasProject_CyberSec_SIPADU_Desa_Tundagan.docx');
});

// ---------------------------------------------------------------------------
// Vite Middleware (Dev) or Static Dist Serving (Prod)
// ---------------------------------------------------------------------------

async function startServer(): Promise<void> {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIPADU Desa Tundagan server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;

