export const VILLAGE_INFO = {
  name: 'Desa Tundagan',
  district: 'Kecamatan Hantara',
  regency: 'Kabupaten Kuningan',
  province: 'Jawa Barat',
  postalCode: '45564',
  officeAddress: 'Jl. Raya Desa Tundagan No. 01, Kec. Hantara, Kab. Kuningan 45564',
} as const;

export const DUSUN_LIST = [
  'Dusun Manis',
  'Dusun Pahing',
  'Dusun Pon',
  'Dusun Wage',
  'Dusun Kliwon',
] as const;

export const KATEGORI_PENGADUAN = [
  'Infrastruktur & Jalan Desa',
  'Irigasi & Pertanian',
  'Penerangan Jalan Umum',
  'Kebersihan & Lingkungan',
  'Administrasi & Bantuan Sosial',
  'Keamanan & Ketertiban',
] as const;

export const JENIS_SURAT = [
  'Surat Keterangan Domisili',
  'Surat Keterangan Usaha (SKU)',
  'Surat Keterangan Tidak Mampu (SKTM)',
  'Surat Pengantar SKCK',
  'Surat Keterangan Kependudukan',
] as const;

export const STATUS_OPTIONS = ['Menunggu', 'Diproses', 'Selesai', 'Ditolak'] as const;

export type StatusType = (typeof STATUS_OPTIONS)[number];
export type UserRole = 'admin' | 'warga';

export interface UserPublic {
  id: number;
  username: string;
  full_name: string;
  email: string;
  nik_masked: string | null;
  dusun: string;
  role: UserRole;
  created_at: string;
}

export interface PengaduanRecord {
  id: number;
  kode_tiket: string;
  user_id: number;
  pelapor_nama: string;
  judul: string;
  kategori: string;
  dusun: string;
  lokasi_detail: string;
  deskripsi: string;
  status: StatusType;
  tanggapan_admin: string | null;
  created_at: string;
  updated_at: string;
}

export interface SuratRecord {
  id: number;
  kode_permohonan: string;
  nomor_surat: string | null;
  user_id: number;
  pemohon_nama: string;
  nik_masked: string;
  dusun: string;
  jenis_surat: string;
  keperluan: string;
  status: StatusType;
  catatan_admin: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRecord {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  resource: string;
  status_code: number;
  ip_address: string;
  details: string;
  created_at: string;
}

export interface PasswordCheckResult {
  valid: boolean;
  checks: {
    minLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

export function evaluatePasswordStrength(password: string): PasswordCheckResult {
  const checks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
  return {
    valid: Object.values(checks).every(Boolean),
    checks,
  };
}
