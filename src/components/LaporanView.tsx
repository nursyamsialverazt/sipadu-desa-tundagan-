import { useCallback, useEffect, useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { apiRequest, downloadCsvWithAuth } from '../lib/api';
import { STATUS_OPTIONS, VILLAGE_INFO } from '../shared/constants';

interface SummaryResponse {
  scope: string;
  pengaduanByStatus: Array<{ status: string; total: number }>;
  suratByStatus: Array<{ status: string; total: number }>;
  pengaduanByDusun: Array<{ dusun: string; total: number }>;
  pengaduanByKategori: Array<{ kategori: string; total: number }>;
  suratByJenis: Array<{ jenis_surat: string; total: number }>;
}

interface LaporanViewProps {
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function LaporanView({ onNotify }: LaporanViewProps) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<SummaryResponse>('/api/laporan/summary');
      setSummary(res);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal memuat rekapitulasi laporan.');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function handleExportCsv(jenis: 'pengaduan' | 'surat') {
    try {
      await downloadCsvWithAuth(jenis);
      onNotify('success', `Mengunduh rekapitulasi ${jenis} format CSV.`);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal mengekspor CSV.');
    }
  }

  if (loading || !summary) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const getCount = (arr: Array<{ status: string; total: number }>, status: string) =>
    arr.find((x) => x.status === status)?.total ?? 0;

  const totalPengaduan = summary.pengaduanByStatus.reduce((acc, cur) => acc + cur.total, 0);
  const selesaiPengaduan = getCount(summary.pengaduanByStatus, 'Selesai');
  const totalSurat = summary.suratByStatus.reduce((acc, cur) => acc + cur.total, 0);
  const selesaiSurat = getCount(summary.suratByStatus, 'Selesai');
  const maxDusun = Math.max(1, ...summary.pengaduanByDusun.map((d) => d.total));
  const maxKategori = Math.max(1, ...summary.pengaduanByKategori.map((k) => k.total));

  return (
    <div className="space-y-6">
      {/* Print-Only Official Village Header */}
      <div className="hidden print-only border-b-2 border-slate-900 pb-4 mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide">
          Pemerintah Kabupaten Kuningan · Kecamatan Hantara
        </p>
        <h1 className="text-xl font-bold mt-0.5">PEMERINTAH {VILLAGE_INFO.name.toUpperCase()}</h1>
        <p className="text-xs text-slate-600 mt-0.5">{VILLAGE_INFO.officeAddress}</p>
        <p className="text-sm font-semibold mt-3">
          Laporan Rekapitulasi Pelayanan Publik &amp; Pengaduan Warga
        </p>
        <p className="text-xs text-slate-600">
          Cakupan: {summary.scope} · Dicetak pada {new Date().toLocaleDateString('id-ID')}
        </p>
      </div>

      {/* Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <p className="text-xs font-medium text-slate-500">Cakupan Data Laporan</p>
          <p className="text-sm font-semibold text-slate-900">{summary.scope}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadSummary}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Muat Ulang</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportCsv('pengaduan')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ekspor CSV Pengaduan</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportCsv('surat')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ekspor CSV Surat</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Cetak Laporan PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total Pengaduan</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {totalPengaduan}
          </p>
          <p className="text-xs text-slate-500 mt-1">Laporan masyarakat tercatat</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Pengaduan Selesai</p>
          <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {selesaiPengaduan}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {totalPengaduan > 0
              ? `${Math.round((selesaiPengaduan / totalPengaduan) * 100)}% tingkat penyelesaian`
              : 'Belum ada data'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Permohonan Surat</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {totalSurat}
          </p>
          <p className="text-xs text-slate-500 mt-1">Pengajuan administrasi desa</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Surat Diterbitkan</p>
          <p className="text-2xl font-bold text-teal-700 font-mono tabular-nums mt-1">
            {selesaiSurat}
          </p>
          <p className="text-xs text-slate-500 mt-1">Telah bernomor &amp; disetujui</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribusi per Dusun */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Distribusi Pengaduan per Dusun
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sebaran aspirasi warga di lima dusun wilayah Desa Tundagan
            </p>
          </div>
          {summary.pengaduanByDusun.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">Belum ada data pengaduan.</p>
          ) : (
            <div className="space-y-3">
              {summary.pengaduanByDusun.map((item) => {
                const widthPct = Math.round((item.total / maxDusun) * 100);
                return (
                  <div key={item.dusun} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.dusun}</span>
                      <span className="font-mono text-slate-900 tabular-nums font-semibold">
                        {item.total}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-teal-700 rounded-sm"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Distribusi per Kategori */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Rekap Pengaduan per Bidang
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Klasifikasi permasalahan infrastruktur, pertanian, hingga sosial
            </p>
          </div>
          {summary.pengaduanByKategori.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">Belum ada data kategori.</p>
          ) : (
            <div className="space-y-3">
              {summary.pengaduanByKategori.map((item) => {
                const widthPct = Math.round((item.total / maxKategori) * 100);
                return (
                  <div key={item.kategori} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.kategori}</span>
                      <span className="font-mono text-slate-900 tabular-nums font-semibold">
                        {item.total}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-slate-700 rounded-sm"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Status Rekapitulasi Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">
            Tabel Rekapitulasi Status Pelayanan
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <tr>
                <th className="py-3 px-6">Status Penanganan</th>
                <th className="py-3 px-6 text-right">Jumlah Pengaduan</th>
                <th className="py-3 px-6 text-right">Jumlah Permohonan Surat</th>
                <th className="py-3 px-6 text-right">Total Layanan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {STATUS_OPTIONS.map((status) => {
                const pCount = getCount(summary.pengaduanByStatus, status);
                const sCount = getCount(summary.suratByStatus, status);
                return (
                  <tr key={status} className="hover:bg-slate-50/70">
                    <td className="py-3 px-6 font-medium text-slate-900">{status}</td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums text-slate-700">
                      {pCount}
                    </td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums text-slate-700">
                      {sCount}
                    </td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {pCount + sCount}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50 font-semibold">
                <td className="py-3 px-6 text-slate-900">Total Keseluruhan</td>
                <td className="py-3 px-6 text-right font-mono tabular-nums text-slate-900">
                  {totalPengaduan}
                </td>
                <td className="py-3 px-6 text-right font-mono tabular-nums text-slate-900">
                  {totalSurat}
                </td>
                <td className="py-3 px-6 text-right font-mono tabular-nums text-teal-700">
                  {totalPengaduan + totalSurat}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
