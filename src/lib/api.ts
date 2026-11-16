let cachedCsrfToken: string | null = null;
// Hanya digunakan di memori jika browser memblokir cookie pihak ketiga di dalam iframe preview
let inMemoryIframeSessionToken: string | null = null;

export async function fetchCsrfToken(forceRefresh = false): Promise<string> {
  if (cachedCsrfToken && !forceRefresh) {
    return cachedCsrfToken;
  }
  const res = await fetch('/api/auth/csrf-token', {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Gagal mengambil token CSRF dari server.');
  }
  const json = (await res.json()) as { csrfToken: string };
  cachedCsrfToken = json.csrfToken;
  return cachedCsrfToken;
}

export function clearCachedCsrfToken(): void {
  cachedCsrfToken = null;
  inMemoryIframeSessionToken = null;
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
  } = {}
): Promise<T> {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (inMemoryIframeSessionToken) {
    headers['Authorization'] = `Bearer ${inMemoryIframeSessionToken}`;
  }

  if (method !== 'GET') {
    const csrf = await fetchCsrfToken();
    headers['X-CSRF-Token'] = csrf;
  }

  let res = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.status === 403 && method !== 'GET' && String(data.error || '').toLowerCase().includes('csrf')) {
    const freshCsrf = await fetchCsrfToken(true);
    headers['X-CSRF-Token'] = freshCsrf;
    res = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  }

  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' && data.error.length > 0
        ? data.error
        : `Terjadi kesalahan (${res.status}).`
    );
  }

  if (typeof data.iframeSessionToken === 'string') {
    inMemoryIframeSessionToken = data.iframeSessionToken;
  }

  return data as T;
}

export async function downloadCsvWithAuth(jenis: 'pengaduan' | 'surat'): Promise<void> {
  const headers: Record<string, string> = {};
  if (inMemoryIframeSessionToken) {
    headers['Authorization'] = `Bearer ${inMemoryIframeSessionToken}`;
  }

  const res = await fetch(`/api/laporan/export-csv?jenis=${jenis}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const errJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errJson.error || `Gagal mengekspor CSV (${res.status}).`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `rekap_${jenis}_desa_tundagan_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
