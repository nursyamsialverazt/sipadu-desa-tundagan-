import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { AuditLogRecord, UserPublic } from '../shared/constants';

interface AuditKeamananViewProps {
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function AuditKeamananView({ onNotify }: AuditKeamananViewProps) {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAuditData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, usersRes] = await Promise.all([
        apiRequest<{ data: AuditLogRecord[] }>('/api/admin/audit-logs'),
        apiRequest<{ data: UserPublic[] }>('/api/admin/users'),
      ]);
      setLogs(logsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Gagal memuat data audit keamanan.');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadAuditData();
  }, [loadAuditData]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Log Aktivitas &amp; Audit Keamanan (Khusus Admin Desa)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mencatat autentikasi, percobaan login gagal, pemblokiran rate-limit, dan deteksi
              percobaan IDOR/RBAC secara real-time.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadAuditData}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Segarkan Log</span>
        </button>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">Riwayat Event Keamanan Terbaru</h4>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {logs.length} entri tercatat
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-md animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 px-4 whitespace-nowrap">Waktu (UTC)</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Aksi</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Pengguna</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Endpoint</th>
                  <th className="py-2.5 px-4 whitespace-nowrap text-right">HTTP</th>
                  <th className="py-2.5 px-4">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((log) => {
                  const isWarning = log.status_code >= 400;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {log.created_at}
                      </td>
                      <td
                        className={`py-2.5 px-4 font-mono font-semibold whitespace-nowrap ${
                          isWarning ? 'text-red-700' : 'text-teal-700'
                        }`}
                      >
                        {log.action}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {log.username || '-'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {log.resource}
                      </td>
                      <td
                        className={`py-2.5 px-4 font-mono tabular-nums text-right font-semibold ${
                          isWarning ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {log.status_code}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 max-w-md">{log.details}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registered Users Directory (Masked NIK, No Password Hash) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">
            Daftar Akun Terdaftar (NIK Tersamar &amp; Tanpa Password Hash)
          </h4>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {users.length} akun
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
              <tr>
                <th className="py-2.5 px-4">Username</th>
                <th className="py-2.5 px-4">Nama Lengkap</th>
                <th className="py-2.5 px-4">Dusun</th>
                <th className="py-2.5 px-4">NIK (Masked)</th>
                <th className="py-2.5 px-4">Peran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 px-4 font-mono text-slate-900">{u.username}</td>
                  <td className="py-2.5 px-4 text-slate-800">{u.full_name}</td>
                  <td className="py-2.5 px-4 text-slate-600">{u.dusun}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600 tabular-nums">
                    {u.nik_masked || '-'}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">
                    {u.role === 'admin' ? 'Admin Desa' : 'Warga'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
