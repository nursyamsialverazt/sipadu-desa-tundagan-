import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from './db.ts';
import type { UserRole } from '../src/shared/constants.ts';

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(48).toString('hex');

function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret && envSecret.length >= 16 && !envSecret.startsWith('CHANGE_ME')) {
    return envSecret;
  }
  return EPHEMERAL_FALLBACK_SECRET;
}

export const SESSION_COOKIE_NAME = 'sipadu_session';
export const CSRF_COOKIE_NAME = 'sipadu_csrf';
export const TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2 jam

export interface SessionPayload {
  userId: number;
  username: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    full_name: string;
    email: string;
    dusun: string;
    role: UserRole;
  };
}

export function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return process.env.NODE_ENV === 'production';
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload;

    if (
      typeof decoded.userId === 'number' &&
      typeof decoded.username === 'string' &&
      (decoded.role === 'admin' || decoded.role === 'warga')
    ) {
      return {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function createSignedCsrfToken(): string {
  const issuedAt = Date.now().toString(36);
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = `${issuedAt}.${nonce}`;
  const sig = crypto
    .createHmac('sha256', getJwtSecret())
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

export function verifySignedCsrfToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [issuedAtStr, nonce, providedSig] = parts;
  if (!issuedAtStr || !nonce || !providedSig) return false;

  const issuedAt = parseInt(issuedAtStr, 36);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > TOKEN_TTL_SECONDS * 1000) return false;

  const expectedSig = crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${issuedAtStr}.${nonce}`)
    .digest('hex');

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function sanitizeText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

export function maskNik(nik: string | null | undefined): string {
  if (!nik || nik.length < 10) return '-';
  return `${nik.slice(0, 6)}******${nik.slice(-4)}`;
}

export function sanitizeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  const clean = str.replace(/\r?\n|\r/g, ' ').trim();
  const formulaSafe = /^[=+\-@\t\r]/.test(clean) ? `'${clean}` : clean;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

export const strongPasswordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(72, 'Password maksimal 72 karakter')
  .refine((val) => /[A-Z]/.test(val), 'Password harus mengandung minimal 1 huruf besar (A-Z)')
  .refine((val) => /[a-z]/.test(val), 'Password harus mengandung minimal 1 huruf kecil (a-z)')
  .refine((val) => /[0-9]/.test(val), 'Password harus mengandung minimal 1 angka (0-9)')
  .refine((val) => /[^A-Za-z0-9]/.test(val), 'Password harus mengandung minimal 1 simbol khusus');

export function logAudit(params: {
  userId?: number | null;
  username?: string | null;
  action: string;
  resource: string;
  statusCode: number;
  ipAddress: string;
  details: string;
}): void {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, resource, status_code, ip_address, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.userId ?? null,
      params.username ?? null,
      sanitizeText(params.action).slice(0, 64),
      sanitizeText(params.resource).slice(0, 128),
      params.statusCode,
      sanitizeText(params.ipAddress).slice(0, 64),
      sanitizeText(params.details).slice(0, 400)
    );
  } catch {
    // Audit logging must not crash request flow
  }
}

function extractSessionToken(req: Request): string | null {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer.length > 0) return bearer;
  }
  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractSessionToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan login terlebih dahulu.' });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah kedaluwarsa. Silakan login ulang.' });
    return;
  }

  const user = db
    .prepare('SELECT id, username, full_name, email, dusun, role FROM users WHERE id = ?')
    .get(payload.userId) as AuthenticatedRequest['user'] | undefined;

  if (!user) {
    res.status(401).json({ error: 'Akun pengguna tidak ditemukan.' });
    return;
  }

  req.user = user;
  next();
}

export function requireRole(role: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Autentikasi diperlukan.' });
      return;
    }
    if (req.user.role !== role) {
      logAudit({
        userId: req.user.id,
        username: req.user.username,
        action: 'RBAC_FORBIDDEN',
        resource: req.originalUrl,
        statusCode: 403,
        ipAddress: getClientIp(req),
        details: `Akses ditolak: peran '${req.user.role}' mencoba mengakses endpoint khusus '${role}'.`,
      });
      res.status(403).json({
        error: 'Akses ditolak (403 Forbidden). Anda tidak memiliki hak akses peran untuk fitur ini.',
      });
      return;
    }
    next();
  };
}

function isSameHostOrigin(req: Request): boolean {
  const host = req.get('x-forwarded-host') || req.get('host');
  if (!host) return true;
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (typeof origin === 'string' && origin.length > 0) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  if (typeof referer === 'string' && referer.length > 0) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return true;
}

export function verifyCsrf(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (typeof headerToken !== 'string' || !verifySignedCsrfToken(headerToken)) {
    logAudit({
      userId: req.user?.id ?? null,
      username: req.user?.username ?? null,
      action: 'CSRF_VALIDATION_FAILED',
      resource: req.originalUrl,
      statusCode: 403,
      ipAddress: getClientIp(req),
      details: 'Permintaan mutasi ditolak karena header X-CSRF-Token tidak valid atau kedaluwarsa.',
    });
    res.status(403).json({ error: 'Validasi CSRF gagal. Muat ulang halaman dan coba lagi.' });
    return;
  }

  // Jika cookie tersedia (browser normal), pastikan double-submit cookie cocok persis
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    const a = Buffer.from(headerToken);
    const b = Buffer.from(cookieToken);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      logAudit({
        userId: req.user?.id ?? null,
        username: req.user?.username ?? null,
        action: 'CSRF_MISMATCH',
        resource: req.originalUrl,
        statusCode: 403,
        ipAddress: getClientIp(req),
        details: 'Token CSRF header dan cookie tidak cocok.',
      });
      res.status(403).json({ error: 'Token CSRF tidak cocok.' });
      return;
    }
  } else if (!isSameHostOrigin(req)) {
    // Jika cookie diblokir oleh sandbox iframe, wajib lolos verifikasi Origin/Host yang sama
    logAudit({
      userId: req.user?.id ?? null,
      username: req.user?.username ?? null,
      action: 'CSRF_ORIGIN_MISMATCH',
      resource: req.originalUrl,
      statusCode: 403,
      ipAddress: getClientIp(req),
      details: 'Permintaan ditolak karena Origin tidak cocok dengan Host server.',
    });
    res.status(403).json({ error: 'Validasi Origin gagal.' });
    return;
  }

  next();
}
