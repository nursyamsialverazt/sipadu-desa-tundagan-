import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  DUSUN_LIST,
  JENIS_SURAT,
  STATUS_OPTIONS,
  VILLAGE_INFO,
  type StatusType,
  type SuratRecord,
  type UserPublic,
} from '../shared/constants';
import { StatusIndicator } from './StatusBadge';

interface SuratViewProps {
  user: UserPublic;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function SuratView({ user, onNotify }: SuratViewProps) {
  const [items, setItems] = useState<SuratRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('Semua');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SuratRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Warga fields
  const [nikPemohon, setNikPemohon] = useState('');
  const [dusun, setDusun] = useState<string>(user.dusun || DUSUN_LIST[0]);
  const [jenisSurat, setJenisSurat] = useState<string>(JENIS_SURAT[0]);
  const [keperluan, setKeperluan] = useState('');

  // Admin fields
  const [adminStatus, setAdminStatus] = useState<StatusType>('Menunggu');
  const [nomorSurat, setNomorSurat] = useState('');
  const [catatanAdmin, setCatatanAdmin] = useState('');

  // Preview print & Delete confirm
  const [printTarget, setPrintTarget] = useState<SuratRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SuratRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const query = statusFilter !== 'Semua' ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const res = await apiRequest<{ data: SuratRecord[] }>(`/api/surat${query}`);
      setItems(res.data);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal memuat permohonan surat.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, onNotify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreateModal() {
    setEditingItem(null);
    setNikPemohon('');
    setDusun(user.dusun || DUSUN_LIST[0]);
    setJenisSurat(JENIS_SURAT[0]);
    setKeperluan('');
    setModalOpen(true);
  }

  function openEditModal(item: SuratRecord) {
    setEditingItem(item);
    setNikPemohon('');
    setDusun(item.dusun);
    setJenisSurat(item.jenis_surat);
    setKeperluan(item.keperluan);
    setAdminStatus(item.status);
    setNomorSurat(item.nomor_surat || '');
    setCatatanAdmin(item.catatan_admin || '');
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!editingItem) {
        await apiRequest('/api/surat', {
          method: 'POST',
          body: {
            nik_pemohon: nikPemohon,
            dusun,
            jenis_surat: jenisSurat,
            keperluan,
          },
        });
        onNotify('success', 'Permohonan surat keterangan berhasil diajukan.');
      } else if (user.role === 'admin') {
        await apiRequest(`/api/surat/${editingItem.id}`, {
          method: 'PUT',
          body: {
            status: adminStatus,
            nomor_surat: nomorSurat || null,
            catatan_admin: catatanAdmin || null,
          },
        });
        onNotify('success', `Permohonan ${editingItem.kode_permohonan} berhasil diperbarui.`);
      } else {
        await apiRequest(`/api/surat/${editingItem.id}`, {
          method: 'PUT',
          body: {
            nik_pemohon: nikPemohon,
            dusun,
            jenis_surat: jenisSurat,
            keperluan,
          },
        });
        onNotify('success', `Permohonan ${editingItem.kode_permohonan} berhasil diubah.`);
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal menyimpan permohonan surat.');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/surat/${deleteTarget.id}`, { method: 'DELETE' });
      onNotify('success', `Permohonan ${deleteTarget.kode_permohonan} berhasil dihapus.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal menghapus permohonan surat.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Ajukan Surat Baru</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((r) => (
              <div key={r} className="h-11 bg-slate-100 rounded-md animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-base font-semibold text-slate-900">Belum ada permohonan surat</p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Ajukan permohonan Surat Domisili, SKU, SKTM, atau Pengantar SKCK untuk diterbitkan
              oleh Pemerintah {VILLAGE_INFO.name}.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Ajukan Surat Pertama</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">Kode & Nomor Surat</th>
                  <th className="py-3 px-4">Jenis Surat & Keperluan</th>
                  <th className="py-3 px-4 whitespace-nowrap">Pemohon (NIK)</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => {
                  const canWargaModify = user.role === 'warga' && item.status === 'Menunggu';
                  const canModify = user.role === 'admin' || canWargaModify;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs tabular-nums whitespace-nowrap">
                        <div className="font-medium text-teal-700">{item.kode_permohonan}</div>
                        <div className="text-slate-500 mt-0.5">
                          {item.nomor_surat || 'Belum bernomor'}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <div className="font-medium text-slate-900">{item.jenis_surat}</div>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {item.keperluan}
                        </p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-900">{item.pemohon_nama}</div>
                        <div className="font-mono text-xs text-slate-500 tabular-nums">
                          {item.nik_masked} · {item.dusun}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusIndicator status={item.status} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setPrintTarget(item)}
                            title="Lihat & Cetak Tanda Terima"
                            className="p-2 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-md cursor-pointer"
                          >
                            <Printer className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {canModify && (
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              title={
                                user.role === 'admin' ? 'Proses permohonan' : 'Ubah permohonan'
                              }
                              className="p-2 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                          {canModify && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              title="Hapus permohonan"
                              className="p-2 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {!editingItem
                  ? 'Ajukan Permohonan Surat Desa'
                  : user.role === 'admin'
                    ? `Proses ${editingItem.kode_permohonan}`
                    : `Ubah ${editingItem.kode_permohonan}`}
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
                    <p className="font-semibold text-slate-900">{editingItem.jenis_surat}</p>
                    <p className="text-xs text-slate-500">
                      Pemohon: {editingItem.pemohon_nama} · NIK {editingItem.nik_masked} ·{' '}
                      {editingItem.dusun}
                    </p>
                    <p className="text-slate-700 pt-1">{editingItem.keperluan}</p>
                  </div>

                  <div>
                    <label
                      htmlFor="surat-admin-status"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Status Permohonan
                    </label>
                    <select
                      id="surat-admin-status"
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
                      htmlFor="surat-nomor"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Nomor Registrasi Surat Desa
                    </label>
                    <input
                      id="surat-nomor"
                      type="text"
                      value={nomorSurat}
                      onChange={(e) => setNomorSurat(e.target.value)}
                      placeholder="Contoh: 470/024/Pemdes-TDG/XI/2026"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="surat-catatan"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Catatan Perangkat Desa
                    </label>
                    <textarea
                      id="surat-catatan"
                      rows={3}
                      value={catatanAdmin}
                      onChange={(e) => setCatatanAdmin(e.target.value)}
                      placeholder="Informasi pengambilan surat di Balai Desa Tundagan..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="surat-nik"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        NIK Pemohon (16 Digit)
                      </label>
                      <input
                        id="surat-nik"
                        type="text"
                        required
                        minLength={16}
                        maxLength={16}
                        value={nikPemohon}
                        onChange={(e) => setNikPemohon(e.target.value.replace(/\D/g, ''))}
                        placeholder="320815xxxxxxxxxx"
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="surat-dusun"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Dusun
                      </label>
                      <select
                        id="surat-dusun"
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
                      htmlFor="surat-jenis"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Jenis Surat Keterangan
                    </label>
                    <select
                      id="surat-jenis"
                      value={jenisSurat}
                      onChange={(e) => setJenisSurat(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    >
                      {JENIS_SURAT.map((j) => (
                        <option key={j} value={j}>
                          {j}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="surat-keperluan"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Keperluan Pengajuan
                    </label>
                    <textarea
                      id="surat-keperluan"
                      rows={3}
                      required
                      minLength={10}
                      maxLength={600}
                      value={keperluan}
                      onChange={(e) => setKeperluan(e.target.value)}
                      placeholder="Contoh: Persyaratan pengajuan Kredit Usaha Rakyat untuk usaha gula aren..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Preview Modal */}
      {printTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-5 print-surface">
            <div className="border-b-2 border-slate-900 pb-3 text-center space-y-0.5">
              <p className="text-xs font-semibold tracking-wide text-slate-600">
                PEMERINTAH KABUPATEN KUNINGAN · KECAMATAN HANTARA
              </p>
              <h3 className="text-lg font-bold text-slate-900">PEMERINTAH DESA TUNDAGAN</h3>
              <p className="text-xs text-slate-500">{VILLAGE_INFO.officeAddress}</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Kode Permohonan</span>
                <span className="font-mono font-semibold text-slate-900">
                  {printTarget.kode_permohonan}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Nomor Surat Resmi</span>
                <span className="font-mono text-slate-900">
                  {printTarget.nomor_surat || 'Menunggu Penomoran Desa'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Nama Pemohon</span>
                <span className="font-medium text-slate-900">{printTarget.pemohon_nama}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">NIK (Tersamar) / Dusun</span>
                <span className="font-mono text-slate-900">
                  {printTarget.nik_masked} · {printTarget.dusun}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Jenis Layanan</span>
                <span className="font-medium text-slate-900">{printTarget.jenis_surat}</span>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Keperluan</p>
                <p className="text-slate-900 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {printTarget.keperluan}
                </p>
              </div>
              {printTarget.catatan_admin && (
                <div>
                  <p className="text-slate-500 mb-1">Catatan Perangkat Desa</p>
                  <p className="text-slate-800">{printTarget.catatan_admin}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 no-print">
              <button
                type="button"
                onClick={() => setPrintTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <span>Cetak / Simpan PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Batalkan Permohonan Surat?</h3>
            <p className="text-sm text-slate-600">
              Permohonan{' '}
              <span className="font-mono font-semibold text-slate-900">
                {deleteTarget.kode_permohonan}
              </span>{' '}
              ({deleteTarget.jenis_surat}) akan dihapus permanen.
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
