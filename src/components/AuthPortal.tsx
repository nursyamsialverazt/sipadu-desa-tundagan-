import { useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, Lock, ShieldCheck, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  DUSUN_LIST,
  VILLAGE_INFO,
  evaluatePasswordStrength,
  type UserPublic,
} from '../shared/constants';

interface AuthPortalProps {
  onLoginSuccess: (user: UserPublic) => void;
}

export function AuthPortal({ onLoginSuccess }: AuthPortalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register state
  const [regUsername, setRegUsername] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regNik, setRegNik] = useState('');
  const [regDusun, setRegDusun] = useState<string>(DUSUN_LIST[0]);
  const [regPassword, setRegPassword] = useState('');

  const passwordCheck = evaluatePasswordStrength(regPassword);

  function fillDemoAccount(role: 'admin' | 'warga1' | 'warga2') {
    setMode('login');
    setErrorMsg(null);
    setSuccessMsg(null);
    if (role === 'admin') {
      setLoginUsername('admin_tundagan');
      setLoginPassword('AdminTundagan#2026');
    } else if (role === 'warga1') {
      setLoginUsername('warga_asep');
      setLoginPassword('WargaTundagan#2026');
    } else {
      setLoginUsername('warga_siti');
      setLoginPassword('WargaSiti#2026');
    }
  }

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ user: UserPublic }>('/api/auth/login', {
        method: 'POST',
        body: {
          username: loginUsername,
          password: loginPassword,
        },
      });
      onLoginSuccess(res.user);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal masuk ke sistem.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!passwordCheck.valid) {
      setErrorMsg('Password belum memenuhi seluruh kriteria keamanan minimum.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/register', {
        method: 'POST',
        body: {
          username: regUsername,
          full_name: regFullName,
          email: regEmail,
          nik: regNik,
          dusun: regDusun,
          password: regPassword,
        },
      });
      setSuccessMsg(res.message);
      setLoginUsername(regUsername);
      setLoginPassword('');
      setRegPassword('');
      setMode('login');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Registrasi gagal.');
    } finally {
      setLoading(false);
    }
  }

  function focusAuthForm() {
    const el = document.getElementById('auth-panel');
    el?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#beranda"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SIPADU Desa Tundagan
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#beranda"
              className="hover:text-teal-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Beranda
            </a>
            <a
              href="#layanan"
              className="hover:text-teal-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Layanan
            </a>
            <a
              href="#alur"
              className="hover:text-teal-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Alur
            </a>
            <a
              href="#keamanan"
              className="hover:text-teal-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Keamanan
            </a>
          </nav>

          <button
            type="button"
            onClick={focusAuthForm}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Masuk Portal
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero & Auth Split Section */}
        <section id="beranda" className="max-w-6xl mx-auto px-6 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            {/* Left Overview Column */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <p className="text-sm font-medium text-teal-700">
                  {VILLAGE_INFO.name} · {VILLAGE_INFO.district} · {VILLAGE_INFO.regency}
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 leading-[1.15] [text-wrap:balance]">
                  Portal Pelayanan Administrasi dan Pengaduan Warga Desa Tundagan
                </h1>
                <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
                  Platform digital resmi untuk penyampaian aspirasi masyarakat lintas lima dusun
                  serta pengajuan surat keterangan desa secara terstruktur, transparan, dan
                  terproteksi standar keamanan web modern.
                </p>
              </div>

              {/* Clean Structured Village Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-200">
                <div>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">5 Dusun</p>
                  <p className="text-xs text-slate-500 mt-1">Manis, Pahing, Pon, Wage, Kliwon</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">5 Jenis</p>
                  <p className="text-xs text-slate-500 mt-1">Surat Keterangan Desa</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">6 Bidang</p>
                  <p className="text-xs text-slate-500 mt-1">Kategori Pengaduan Publik</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">RBAC</p>
                  <p className="text-xs text-slate-500 mt-1">Isolasi Data Warga & Admin</p>
                </div>
              </div>

              {/* Service Highlights */}
              <div id="layanan" className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    01. Pengaduan & Aspirasi Warga
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Laporkan kendala jalan desa, saluran irigasi pertanian, penerangan jalan umum,
                    hingga layanan sosial lengkap dengan pelacakan status tindak lanjut perangkat desa.
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    02. Permohonan Surat Keterangan
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Ajukan Surat Domisili, SKU, SKTM, dan Pengantar SKCK dengan verifikasi NIK 16
                    digit serta penomoran surat resmi oleh Sekretaris Desa.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Auth Panel */}
            <div id="auth-panel" className="lg:col-span-5">
              <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7 h-full flex flex-col justify-between">
                <div>
                  {/* Segmented Tab Switcher */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMsg(null);
                      }}
                      className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        mode === 'login'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Masuk Akun
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        mode === 'register'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Daftar Warga
                    </button>
                  </div>

                  {errorMsg && (
                    <div
                      role="alert"
                      className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
                    >
                      {errorMsg}
                    </div>
                  )}

                  {successMsg && (
                    <div
                      role="status"
                      className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800"
                    >
                      {successMsg}
                    </div>
                  )}

                  {mode === 'login' ? (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div>
                        <label
                          htmlFor="login-username"
                          className="block text-sm font-medium text-slate-700 mb-1.5"
                        >
                          Username atau Email
                        </label>
                        <input
                          id="login-username"
                          type="text"
                          required
                          autoComplete="username"
                          value={loginUsername}
                          onChange={(e) => setLoginUsername(e.target.value)}
                          placeholder="Contoh: warga_asep"
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="login-password"
                          className="block text-sm font-medium text-slate-700 mb-1.5"
                        >
                          Password
                        </label>
                        <div className="relative">
                          <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            autoComplete="current-password"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="Masukkan password Anda"
                            className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 px-4 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {loading ? 'Memverifikasi Sesi...' : 'Masuk ke Portal'}
                      </button>

                      {/* Demo Account Quick-Fill for Evaluation & Testing */}
                      <div className="pt-4 mt-4 border-t border-slate-200 space-y-2.5">
                        <p className="text-xs font-medium text-slate-600">
                          Akun Uji Coba (Evaluasi RBAC & IDOR):
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => fillDemoAccount('admin')}
                            className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                          >
                            Admin Desa
                          </button>
                          <button
                            type="button"
                            onClick={() => fillDemoAccount('warga1')}
                            className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                          >
                            Warga (Asep)
                          </button>
                          <button
                            type="button"
                            onClick={() => fillDemoAccount('warga2')}
                            className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                          >
                            Warga (Siti)
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="reg-fullname"
                            className="block text-xs font-medium text-slate-700 mb-1"
                          >
                            Nama Lengkap
                          </label>
                          <input
                            id="reg-fullname"
                            type="text"
                            required
                            value={regFullName}
                            onChange={(e) => setRegFullName(e.target.value)}
                            placeholder="Sesuai KTP"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="reg-username"
                            className="block text-xs font-medium text-slate-700 mb-1"
                          >
                            Username
                          </label>
                          <input
                            id="reg-username"
                            type="text"
                            required
                            value={regUsername}
                            onChange={(e) => setRegUsername(e.target.value)}
                            placeholder="huruf_angka"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="reg-nik"
                            className="block text-xs font-medium text-slate-700 mb-1"
                          >
                            NIK (16 Digit)
                          </label>
                          <input
                            id="reg-nik"
                            type="text"
                            required
                            maxLength={16}
                            value={regNik}
                            onChange={(e) => setRegNik(e.target.value.replace(/\D/g, ''))}
                            placeholder="320815xxxxxxxxxx"
                            className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="reg-dusun"
                            className="block text-xs font-medium text-slate-700 mb-1"
                          >
                            Wilayah Dusun
                          </label>
                          <select
                            id="reg-dusun"
                            value={regDusun}
                            onChange={(e) => setRegDusun(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                          >
                            {DUSUN_LIST.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="reg-email"
                          className="block text-xs font-medium text-slate-700 mb-1"
                        >
                          Alamat Email
                        </label>
                        <input
                          id="reg-email"
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="nama@email.com"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="reg-password"
                          className="block text-xs font-medium text-slate-700 mb-1"
                        >
                          Password Kuat
                        </label>
                        <input
                          id="reg-password"
                          type="password"
                          required
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="Min. 8 karakter kombinasi simbol"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                        />
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          <PasswordRuleItem
                            ok={passwordCheck.checks.minLength}
                            label="Minimal 8 karakter"
                          />
                          <PasswordRuleItem
                            ok={passwordCheck.checks.hasUpper}
                            label="Huruf kapital (A-Z)"
                          />
                          <PasswordRuleItem
                            ok={passwordCheck.checks.hasLower}
                            label="Huruf kecil (a-z)"
                          />
                          <PasswordRuleItem
                            ok={passwordCheck.checks.hasNumber}
                            label="Angka (0-9)"
                          />
                          <PasswordRuleItem
                            ok={passwordCheck.checks.hasSpecial}
                            label="Simbol khusus (!@#)"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 px-4 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {loading ? 'Mendaftarkan Akun...' : 'Daftar Akun Warga'}
                      </button>
                    </form>
                  )}
                </div>

                <div className="pt-4 mt-5 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-500">
                  <Lock className="h-3.5 w-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                  <span>Sesi dilindungi cookie HttpOnly, CSRF token, dan pembatasan percobaan login.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow & Security Architecture Section */}
        <section id="alur" className="border-t border-slate-200 bg-white py-12">
          <div className="max-w-6xl mx-auto px-6 space-y-8">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">
                Alur Pelayanan Publik Desa Tundagan
              </h2>
              <p className="text-sm text-slate-600">
                Dirancang agar warga dapat mengajukan layanan dari rumah dan perangkat desa dapat
                memverifikasi, menindaklanjuti, serta merekap laporan dengan akuntabilitas penuh.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border border-slate-200 rounded-xl p-5 space-y-2">
                <p className="text-xs font-mono font-semibold text-teal-700 tabular-nums">
                  Langkah 01
                </p>
                <h3 className="text-base font-semibold text-slate-900">
                  Registrasi & Autentikasi Warga
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Warga mendaftar menggunakan NIK 16 digit dan password kuat yang di-hash dengan
                  algoritma bcrypt (cost 12) sebelum disimpan ke basis data SQLite.
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-5 space-y-2">
                <p className="text-xs font-mono font-semibold text-teal-700 tabular-nums">
                  Langkah 02
                </p>
                <h3 className="text-base font-semibold text-slate-900">
                  Pengajuan & Tindak Lanjut
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Setiap laporan maupun permohonan surat memiliki nomor tiket unik dan hanya dapat
                  diakses oleh pemilik data atau perangkat desa berwenang.
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl p-5 space-y-2">
                <p className="text-xs font-mono font-semibold text-teal-700 tabular-nums">
                  Langkah 03
                </p>
                <h3 className="text-base font-semibold text-slate-900">
                  Rekapitulasi & Ekspor Laporan
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Perangkat desa memantau distribusi laporan per dusun dan mengekspor laporan resmi
                  ke format CSV aman maupun cetak PDF berkop Desa Tundagan.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="keamanan" className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="max-w-6xl mx-auto px-6 space-y-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-6 w-6 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-slate-900">
                  Lapisan Pengamanan Aplikasi Web
                </h2>
                <p className="text-sm text-slate-600">
                  Implementasi kontrol keamanan aktif pada seluruh endpoint API dan antarmuka.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="py-3 px-4">Aspek Keamanan</th>
                      <th className="py-3 px-4">Implementasi Teknis</th>
                      <th className="py-3 px-4">Mitigasi Risiko</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    <tr>
                      <td className="py-3 px-4 font-medium text-slate-900">Password Hashing</td>
                      <td className="py-3 px-4 font-mono text-xs">bcryptjs (salt rounds = 12)</td>
                      <td className="py-3 px-4">Mencegah kebocoran kredensial plaintext</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium text-slate-900">Anti SQL Injection</td>
                      <td className="py-3 px-4 font-mono text-xs">
                        Parameterized Prepared Statements + Zod
                      </td>
                      <td className="py-3 px-4">Menolak manipulasi query melalui form & URL</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium text-slate-900">Anti XSS & Headers</td>
                      <td className="py-3 px-4 font-mono text-xs">
                        Helmet CSP + Sanitasi Tag + JSX Escaping
                      </td>
                      <td className="py-3 px-4">Mencegah eksekusi skrip berbahaya di browser</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium text-slate-900">Sesi & CSRF</td>
                      <td className="py-3 px-4 font-mono text-xs">
                        JWT (2h TTL) dalam Cookie HttpOnly + X-CSRF-Token
                      </td>
                      <td className="py-3 px-4">Melindungi token dari pencurian XSS & CSRF</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium text-slate-900">RBAC, IDOR & Rate Limit</td>
                      <td className="py-3 px-4 font-mono text-xs">
                        Middleware Role/Ownership + Max 5 Login Gagal
                      </td>
                      <td className="py-3 px-4">Mencegah akses lintas warga & brute-force</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            Pemerintah {VILLAGE_INFO.name} · {VILLAGE_INFO.district} · {VILLAGE_INFO.regency}
          </span>
          <span>{VILLAGE_INFO.officeAddress}</span>
        </div>
      </footer>
    </div>
  );
}

function PasswordRuleItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>
      {ok ? (
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{label}</span>
    </div>
  );
}
