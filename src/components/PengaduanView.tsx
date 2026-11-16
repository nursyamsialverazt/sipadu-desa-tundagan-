import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  DUSUN_LIST,
  KATEGORI_PENGADUAN,
  STATUS_OPTIONS,
  type PengaduanRecord,
  type StatusType,
  type UserPublic,
} from '../shared/constants';
import { StatusIndicator } from './StatusBadge';

interface PengaduanViewProps {
  user: UserPublic;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function PengaduanView({ user, onNotify }: PengaduanViewProps) {
  const [items, setItems] = useState<PengaduanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [dusunFilter, setDusunFilter] = useState<string>('Semua');

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PengaduanRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Warga form fields
  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState<string>(KATEGORI_PENGADUAN[0]);
  const [dusun, setDusun] = useState<string>(user.dusun || DUSUN_LIST[0]);
  const [lokasiDetail, setLokasiDetail] = useState('');
  const [deskripsi, setDeskripsi] = useState('');

  // Admin respond fields
  const [adminStatus, setAdminStatus] = useState<StatusType>('Menunggu');
  const [tanggapanAdmin, setTanggapanAdmin] = useState('');

  // Detail & Delete confirm modals
  const [detailItem, setDetailItem] = useState<PengaduanRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PengaduanRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'Semua') params.set('status', statusFilter);
      if (dusunFilter !== 'Semua') params.set('dusun', dusunFilter);
      if (search.trim()) params.set('search', search.trim());
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiRequest<{ data: PengaduanRecord[] }>(`/api/pengaduan${query}`);
      setItems(res.data);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal memuat pengaduan.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dusunFilter, search, onNotify]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  function openCreateModal() {
    setEditingItem(null);
    setJudul('');
    setKategori(KATEGORI_PENGADUAN[0]);
    setDusun(user.dusun || DUSUN_LIST[0]);
    setLokasiDetail('');
    setDeskripsi('');
    setModalOpen(true);
  }

  function openEditModal(item: PengaduanRecord) {
    setEditingItem(item);
    setJudul(item.judul);
    setKategori(item.kategori);
    setDusun(item.dusun);
    setLokasiDetail(item.lokasi_detail);
    setDeskripsi(item.deskripsi);
    setAdminStatus(item.status);
    setTanggapanAdmin(item.tanggapan_admin || '');
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!editingItem) {
        await apiRequest('/api/pengaduan', {
          method: 'POST',
          body: {
            judul,
            kategori,
            dusun,
            lokasi_detail: lokasiDetail,
            deskripsi,
          },
        });
        onNotify('success', 'Pengaduan baru berhasil dikirim dan tersimpan.');
      } else if (user.role === 'admin') {
        await apiRequest(`/api/pengaduan/${editingItem.id}`, {
          method: 'PUT',
          body: {
            status: adminStatus,
            tanggapan_admin: tanggapanAdmin,
          },
        });
        onNotify('success', `Status pengaduan ${editingItem.kode_tiket} berhasil diperbarui.`);
      } else {
        await apiRequest(`/api/pengaduan/${editingItem.id}`, {
          method: 'PUT',
          body: {
            judul,
            kategori,
            dusun,
            lokasi_detail: lokasiDetail,
            deskripsi,
          },
        });
        onNotify('success', `Pengaduan ${editingItem.kode_tiket} berhasil diperbarui.`);
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal menyimpan pengaduan.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/pengaduan/${deleteTarget.id}`, { method: 'DELETE' });
      onNotify('success', `Pengaduan ${deleteTarget.kode_tiket} berhasil dihapus.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal menghapus pengaduan.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search
                className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode tiket, judul, atau lokasi..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <select
              aria-label="Filter Dusun"
              value={dusunFilter}
              onChange={(e) => setDusunFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="Semua">Semua Dusun</option>
              {DUSUN_LIST.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Buat Pengaduan</span>
          </button>
        </div>

        {/* Segmented Status Filter */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {['Semua', ...STATUS_OPTIONS].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Data Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-11 bg-slate-100 rounded-md animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-base font-semibold text-slate-900">
              Belum ada data pengaduan sesuai filter
            </p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Anda dapat membuat laporan pengaduan baru terkait fasilitas desa, irigasi, atau layanan
              masyarakat Desa Tundagan.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Kirim Pengaduan Pertama</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Kode Tiket</th>
                  <th className="py-3 px-4">Judul & Wilayah</th>
                  {user.role === 'admin' && <th className="py-3 px-4 whitespace-nowrap">Pelapor</th>}
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">Tanggal</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => {
                  const canWargaModify = user.role === 'warga' && item.status === 'Menunggu';
                  const canModify = user.role === 'admin' || canWargaModify;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setDetailItem(item)}
                          className="text-teal-700 hover:underline font-medium cursor-pointer"
                        >
                          {item.kode_tiket}
                        </button>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <button
                          type="button"
                          onClick={() => setDetailItem(item)}
                          className="font-medium text-slate-900 hover:text-teal-700 text-left line-clamp-1 cursor-pointer"
                        >
                          {item.judul}
                        </button>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>{item.dusun}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.kategori}</span>
                        </div>
                      </td>
                      {user.role === 'admin' && (
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          {item.pelapor_nama}
                        </td>
                      )}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusIndicator status={item.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {item.created_at.slice(0, 10)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {canModify && (
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              title={
                                user.role === 'admin' ? 'Tindak lanjuti pengaduan' : 'Ubah pengaduan'
                              }
                              className="p-2 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                          {canModify && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              title="Hapus pengaduan"
                              className="p-2 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                          {!canModify && (
                            <button
                              type="button"
                              onClick={() => setDetailItem(item)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              Detail
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit / Admin Tindak Lanjut Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {!editingItem
                  ? 'Buat Pengaduan Warga Baru'
                  : user.role === 'admin'
                    ? `Tindak Lanjut ${editingItem.kode_tiket}`
                    : `Ubah Pengaduan ${editingItem.kode_tiket}`}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup dialog"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {editingItem && user.role === 'admin' ? (
                <>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-sm">
                    <p className="font-semibold text-slate-900">{editingItem.judul}</p>
                    <p className="text-xs text-slate-500">
                      {editingItem.pelapor_nama} · {editingItem.dusun} · {editingItem.lokasi_detail}
                    </p>
                    <p className="text-slate-700 pt-1">{editingItem.deskripsi}</p>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-status"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Status Penanganan
                    </label>
                    <select
                      id="admin-status"
                      value={adminStatus}
                      onChange={(e) => setAdminStatus(e.target.value as StatusType)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-tanggapan"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Tanggapan Resmi Perangkat Desa
                    </label>
                    <textarea
                      id="admin-tanggapan"
                      rows={4}
                      value={tanggapanAdmin}
                      onChange={(e) => setTanggapanAdmin(e.target.value)}
                      placeholder="Tuliskan tindak lanjut atau jadwal pengerjaan di lapangan..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="adu-judul"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Judul Pengaduan
                    </label>
                    <input
                      id="adu-judul"
                      type="text"
                      required
                      minLength={5}
                      maxLength={120}
                      value={judul}
                      onChange={(e) => setJudul(e.target.value)}
                      placeholder="Contoh: Jalan berlubang di tanjakan Dusun Wage"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="adu-kategori"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Kategori
                      </label>
                      <select
                        id="adu-kategori"
                        value={kategori}
                        onChange={(e) => setKategori(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                      >
                        {KATEGORI_PENGADUAN.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="adu-dusun"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Dusun
                      </label>
                      <select
                        id="adu-dusun"
                        value={dusun}
                        onChange={(e) => setDusun(e.target.value)}
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
                      htmlFor="adu-lokasi"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Lokasi Detail (RT/RW atau Patokan)
                    </label>
                    <input
                      id="adu-lokasi"
                      type="text"
                      required
                      minLength={4}
                      maxLength={160}
                      value={lokasiDetail}
                      onChange={(e) => setLokasiDetail(e.target.value)}
                      placeholder="Contoh: RT 02 / RW 01 dekat Balai Dusun"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="adu-deskripsi"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Uraian Pengaduan
                    </label>
                    <textarea
                      id="adu-deskripsi"
                      rows={4}
                      required
                      minLength={15}
                      maxLength={1500}
                      value={deskripsi}
                      onChange={(e) => setDeskripsi(e.target.value)}
                      placeholder="Jelaskan kondisi di lapangan secara jelas (minimal 15 karakter)..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-teal-700 font-semibold tabular-nums">
                  {detailItem.kode_tiket}
                </p>
                <h3 className="text-lg font-semibold text-slate-900 mt-1">{detailItem.judul}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                aria-label="Tutup detail"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 border-b border-slate-200 pb-3">
              <StatusIndicator status={detailItem.status} />
              <span aria-hidden="true">·</span>
              <span>{detailItem.dusun}</span>
              <span aria-hidden="true">·</span>
              <span>{detailItem.kategori}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{detailItem.created_at.slice(0, 10)}</span>
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-xs font-medium text-slate-500">Lokasi Detail</p>
              <p className="text-slate-800">{detailItem.lokasi_detail}</p>
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-xs font-medium text-slate-500">Uraian Pelapor</p>
              <p className="text-slate-800 leading-relaxed">{detailItem.deskripsi}</p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-sm">
              <p className="text-xs font-semibold text-slate-700">
                Tanggapan Pemerintah Desa Tundagan
              </p>
              <p className="text-slate-700">
                {detailItem.tanggapan_admin ||
                  'Belum ada tanggapan resmi. Laporan menunggu verifikasi perangkat desa.'}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Hapus Pengaduan?</h3>
            <p className="text-sm text-slate-600">
              Anda yakin ingin menghapus pengaduan{' '}
              <span className="font-mono font-semibold text-slate-900">
                {deleteTarget.kode_tiket}
              </span>{' '}
              ({deleteTarget.judul})? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
