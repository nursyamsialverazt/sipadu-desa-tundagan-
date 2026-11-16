import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  ShieldCheck,
  X,
} from 'lucide-react';
import { apiRequest, clearCachedCsrfToken, fetchCsrfToken } from './lib/api';
import { VILLAGE_INFO, type PengaduanRecord, type SuratRecord, type UserPublic } from './shared/constants';
import { AuditKeamananView } from './components/AuditKeamananView';
import { AuthPortal } from './components/AuthPortal';
import { LaporanView } from './components/LaporanView';
import { PengaduanView } from './components/PengaduanView';
import { StatusIndicator } from './components/StatusBadge';
import { SuratView } from './components/SuratView';

type NavTab = 'ringkasan' | 'pengaduan' | 'surat' | 'laporan' | 'audit';

interface NotificationState {
  type: 'success' | 'error';
  message: string;
}

export default function App() {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [booting, setBooting] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('ringkasan');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  // Overview quick snapshot
  const [recentPengaduan, setRecentPengaduan] = useState<PengaduanRecord[]>([]);
  const [recentSurat, setRecentSurat] = useState<SuratRecord[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const handleNotify = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(timer);
  }, [notification]);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        await fetchCsrfToken();
        const res = await apiRequest<{ user: UserPublic }>('/api/auth/me');
        if (active) {
          setUser(res.user);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setBooting(false);
        }
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const loadOverview = useCallback(async () => {
    if (!user) return;
    setOverviewLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        apiRequest<{ data: PengaduanRecord[] }>('/api/pengaduan'),
        apiRequest<{ data: SuratRecord[] }>('/api/surat'),
      ]);
      setRecentPengaduan(pRes.data);
      setRecentSurat(sRes.data);
    } catch {
      // Handled silently on overview
    } finally {
      setOverviewLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === 'ringkasan') {
      loadOverview();
    }
  }, [user, activeTab, loadOverview]);

  async function handleLogout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore error on logout cleanup
    } finally {
      clearCachedCsrfToken();
      await fetchCsrfToken(true).catch(() => undefined);
      setUser(null);
      setActiveTab('ringkasan');
    }
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-600">Memuat portal SIPADU Desa Tundagan...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPortal
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setActiveTab('ringkasan');
        }}
      />
    );
  }

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: typeof LayoutDashboard;
    adminOnly?: boolean;
  }> = [
    { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'pengaduan', label: 'Pengaduan Warga', icon: MessageSquareWarning },
    { id: 'surat', label: 'Permohonan Surat', icon: FileText },
    { id: 'laporan', label: 'Laporan & Ekspor', icon: BarChart3 },
    { id: 'audit', label: 'Audit Keamanan', icon: ShieldCheck, adminOnly: true },
  ];

  const visibleNav = navItems.filter((item) => !item.adminOnly || user.role === 'admin');
  const activeLabel = visibleNav.find((n) => n.id === activeTab)?.label || 'Ringkasan';

  const countPendingPengaduan = recentPengaduan.filter(
    (p) => p.status === 'Menunggu' || p.status === 'Diproses'
  ).length;
  const countDonePengaduan = recentPengaduan.filter((p) => p.status === 'Selesai').length;
  const countPendingSurat = recentSurat.filter(
    (s) => s.status === 'Menunggu' || s.status === 'Diproses'
  ).length;
  const countDoneSurat = recentSurat.filter((s) => s.status === 'Selesai').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 no-print">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            SIPADU Tundagan
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</p>
            <p className="text-xs text-slate-500">
              {user.role === 'admin' ? 'Perangkat Desa (Admin)' : 'Warga Desa'} · {user.dusun}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-full bg-white h-full border-r border-slate-200 flex flex-col z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-bold text-slate-900">SIPADU Tundagan</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Tutup menu"
                className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-teal-700 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</p>
                <p className="text-xs text-slate-500">
                  {user.role === 'admin' ? 'Admin Desa' : 'Warga'} · {user.dusun}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Keluar Sesi</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Context Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-20 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu"
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-md cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                {VILLAGE_INFO.name} / {VILLAGE_INFO.district}
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate">{activeLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono text-slate-500 hidden md:inline">
              @{user.username}
            </span>
            <button
              type="button"
              onClick={() =>
                setActiveTab(activeTab === 'surat' ? 'surat' : 'pengaduan')
              }
              className="px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {activeTab === 'surat' ? 'Kelola Surat' : 'Layanan Pengaduan'}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto space-y-6">
          {notification && (
            <div
              role="status"
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 text-sm no-print ${
                notification.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <span>{notification.message}</span>
              <button
                type="button"
                onClick={() => setNotification(null)}
                aria-label="Tutup notifikasi"
                className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {activeTab === 'ringkasan' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Selamat Datang, {user.full_name}
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {user.role === 'admin'
                      ? 'Anda login sebagai Perangkat Desa Tundagan dengan akses penuh pengelolaan data pengaduan, penomoran surat, laporan desa, dan audit keamanan.'
                      : `Akun Warga ${user.dusun}, Desa Tundagan. Data pengaduan dan permohonan surat Anda terisolasi aman dari akses warga lain.`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('pengaduan')}
                    className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    Buka Pengaduan
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('surat')}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    Ajukan Surat
                  </button>
                </div>
              </div>

              {/* Snapshot Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Pengaduan Aktif</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
                    {overviewLoading ? '-' : countPendingPengaduan}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Menunggu atau diproses</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Pengaduan Selesai</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                    {overviewLoading ? '-' : countDonePengaduan}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Telah ditindaklanjuti</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Surat Diproses</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {overviewLoading ? '-' : countPendingSurat}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Menunggu verifikasi desa</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs font-medium text-slate-500">Surat Diterbitkan</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-teal-700 mt-1">
                    {overviewLoading ? '-' : countDoneSurat}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Siap diambil / dicetak</p>
                </div>
              </div>

              {/* Recent Pengaduan & Surat Lists */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Pengaduan Terbaru</h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('pengaduan')}
                      className="text-xs font-medium text-teal-700 hover:underline cursor-pointer"
                    >
                      Lihat Semua
                    </button>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {recentPengaduan.slice(0, 4).map((p) => (
                      <div key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{p.judul}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            <span className="font-mono">{p.kode_tiket}</span> · {p.dusun}
                          </p>
                        </div>
                        <StatusIndicator status={p.status} />
                      </div>
                    ))}
                    {!overviewLoading && recentPengaduan.length === 0 && (
                      <p className="px-5 py-6 text-sm text-slate-500">Belum ada pengaduan.</p>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Permohonan Surat Terbaru
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('surat')}
                      className="text-xs font-medium text-teal-700 hover:underline cursor-pointer"
                    >
                      Lihat Semua
                    </button>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {recentSurat.slice(0, 4).map((s) => (
                      <div key={s.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {s.jenis_surat}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            <span className="font-mono">{s.kode_permohonan}</span> ·{' '}
                            {s.pemohon_nama}
                          </p>
                        </div>
                        <StatusIndicator status={s.status} />
                      </div>
                    ))}
                    {!overviewLoading && recentSurat.length === 0 && (
                      <p className="px-5 py-6 text-sm text-slate-500">
                        Belum ada permohonan surat.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pengaduan' && <PengaduanView user={user} onNotify={handleNotify} />}
          {activeTab === 'surat' && <SuratView user={user} onNotify={handleNotify} />}
          {activeTab === 'laporan' && <LaporanView onNotify={handleNotify} />}
          {activeTab === 'audit' && user.role === 'admin' && (
            <AuditKeamananView onNotify={handleNotify} />
          )}
        </main>
      </div>
    </div>
  );
}
