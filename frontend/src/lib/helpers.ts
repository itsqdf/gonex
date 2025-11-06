export function getToken(): string | null {
  try { return localStorage.getItem('token'); } catch { return null; }
}

export function authHeaders(contentType: string = 'application/json'): HeadersInit {
  const tok = getToken();
  const headers: Record<string, string> = { 'Content-Type': contentType };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  return headers;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = { ...(init?.headers as any), ...authHeaders() };
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const fullUrl = /^https?:\/\//i.test(url)
    ? url
    : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  const res = await fetch(fullUrl, { ...init, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e.error || msg; } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(text || 'Respons bukan JSON');
  }
  return res.json() as Promise<T>;
}

export function fmtDecimal(n: number | string, decimals = 2): string {
  const num = typeof n === 'number' ? n : Number(n);
  if (!isFinite(num)) return '0';
  const parts = num.toFixed(decimals).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.length > 1 ? `${intPart},${parts[1]}` : intPart;
}

export function fmtRupiah(n: number | string): string {
  return `Rp ${fmtDecimal(n, 2)}`;
}

// Format local date/time to input-friendly values
export function toInputDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function toInputTime(d: Date | string, withSeconds = false): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const hh = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  const ss = String(dt.getSeconds()).padStart(2, '0');
  return withSeconds ? `${hh}:${mi}:${ss}` : `${hh}:${mi}`;
}

export function toInputDateTimeLocal(d: Date | string, withSeconds = false): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const date = toInputDate(dt);
  const time = toInputTime(dt, withSeconds);
  return `${date}T${time}`;
}

export function fmtDate(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

export function fmtTime(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mi}:${ss}`;
}

export function buildQueryParams(params: Record<string, any>): string {
  const esc = encodeURIComponent;
  const pairs: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    pairs.push(`${esc(k)}=${esc(String(v))}`);
  }
  return pairs.length ? `?${pairs.join('&')}` : '';
}

export type PaginatedResponse<T> = { data: T; meta: { page: number; limit: number; total: number; pages: number } };