"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { confirmDelete, success, error, warn } from "@/lib/alerts";
import { authHeaders, fetchJson } from "@/lib/helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Mapel = { id:number; name:string; active?:boolean; company_id?:number|null; company_name?:string|null; jenjang_id?:number|null; jenjang_name?:string|null; hours?:number|null; note?:string|null };
type Company = { id:number; nama:string };
type Jenjang = { id:number; name:string };

export default function MapelPage() {
  const [list, setList] = useState<Mapel[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jenjangOpts, setJenjangOpts] = useState<Jenjang[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [form, setForm] = useState<Partial<Mapel>>({ active: true, hours: 2 });
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = useMemo(() => ({ ...authHeaders(), "x-role": "admin" }), [token]);

  const loadCompanies = async () => {
    try {
      const r = await fetch(`${API_URL}/companies`, { headers });
      const d = await r.json().catch(() => []);
      if (Array.isArray(d)) setCompanies(d.map((c: any) => ({ id: Number(c.id), nama: String(c.name || c.nama || "") })));
    } catch {}
  };

  const loadJenjang = async () => {
    try {
      const j = await fetchJson<{ items: Jenjang[] } | Jenjang[]>("/akademik/jenjang", { headers });
      const arr = Array.isArray((j as any).items) ? (j as any).items : (Array.isArray(j) ? (j as any) : []);
      setJenjangOpts(arr.map((x: any) => ({ id: Number(x.id), name: String(x.name || "") })));
    } catch {}
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ items: Mapel[] } | Mapel[]>("/akademik/mapel", { headers });
      const arr = Array.isArray((data as any).items) ? (data as any).items : (Array.isArray(data) ? (data as any) : []);
      const filtered = query.trim()
        ? arr.filter((x: Mapel) => `${x.name} ${x.company_name || ''} ${x.jenjang_name || ''}`.toLowerCase().includes(query.toLowerCase()))
        : arr;
      setList(filtered);
    } catch (e:any) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadCompanies(); loadJenjang(); load(); }, []);
  useEffect(() => { load(); }, [query]);

  const save = async () => {
    try {
      if (!form.name) {
        warn('Validasi', 'Nama mata pelajaran wajib diisi');
        return;
      }
      const payload: any = { ...form };
      if (payload.company_id && !payload.company_name) {
        const comp = companies.find(c=>c.id===payload.company_id);
        if (comp) payload.company_name = comp.nama;
      }
      if (payload.jenjang_id && !payload.jenjang_name) {
        const jj = jenjangOpts.find(j=>j.id===payload.jenjang_id);
        if (jj) payload.jenjang_name = jj.name;
      }
      const res = await fetch(`${API_URL}/akademik/mapel`, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      setForm({ active: true, hours: 2 });
      await load();
      success('Tersimpan');
    } catch (e:any) {
      error('Gagal menyimpan', e?.message || 'Error');
    }
  };

  const update = async (id:number, payload: Partial<Mapel>) => {
    try {
      const res = await fetch(`${API_URL}/akademik/mapel/${id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e:any) {
      error('Gagal update', e?.message || 'Error');
    }
  };

  const remove = async (id:number) => {
    const ok = await confirmDelete('Hapus data?', undefined, 'Ya, hapus');
    if (!ok) return;
    try {
      const r = await fetch(`${API_URL}/akademik/mapel/${id}`, { method: 'DELETE', headers });
      if (!r.ok) { const t = await r.text(); throw new Error(t); }
      await load();
      success('Terhapus');
    } catch (e:any) {
      error('Tidak bisa dihapus', e?.message || 'Data mungkin sudah digunakan');
    }
  };

  return (
    <div className="p-4 space-y-4 text-black">
      <h1 className="text-xl font-semibold">Akademik - Mata Pelajaran</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <input value={query} onChange={e=>setQuery(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white w-full" placeholder="Cari mata pelajaran..." />
          </div>
          {loading ? <div>Memuat...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Nama</th>
                  <th className="p-2">Perusahaan</th>
                  <th className="p-2">Jenjang</th>
                  <th className="p-2">Jam</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.slice((page-1)*limit, page*limit).map(it => (
                  <tr key={it.id} className="border-b">
                    <td className="p-2">
                      <input defaultValue={it.name} onBlur={e=>update(it.id, { name: e.target.value })} className="border p-1 rounded w-full" />
                    </td>
                    <td className="p-2">{it.company_name || '-'}</td>
                    <td className="p-2">{it.jenjang_name || '-'}</td>
                    <td className="p-2">
                      <input type="number" min={1} defaultValue={it.hours || 2} onBlur={e=>update(it.id, { hours: Number(e.target.value) })} className="border p-1 rounded w-24" />
                    </td>
                    <td className="p-2">
                      <select defaultValue={it.active ? 'Aktif' : 'Tidak Aktif'} onChange={e=>update(it.id, { active: e.target.value === 'Aktif' })} className="border p-1 rounded">
                        <option>Aktif</option>
                        <option>Tidak Aktif</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <button onClick={()=>remove(it.id)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-600 text-white text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 7h12v2H6V7Zm2 3h8l-.7 8.4a2 2 0 0 1-2 1.6H10.7a2 2 0 0 1-2-1.6L8 10Zm3-5h2a2 2 0 0 1 2 2H9a2 2 0 0 1 2-2Z"/></svg>
                        <span>Hapus</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex items-center justify-between mt-2">
            <div className="text-sm">Total: {list.length}</div>
            <div className="flex items-center gap-2">
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
              <span className="text-sm">Hal {page}</span>
              <button disabled={page*limit>=list.length} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
              <select value={limit} onChange={e=>{ setLimit(Number(e.target.value)); setPage(1); }} className="border rounded px-2 py-1 text-sm">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
        <div>
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow space-y-2">
            <h2 className="font-semibold">Tambah Mata Pelajaran</h2>
            <label className="flex flex-col gap-1"><span>Nama <span className="text-red-600">*</span></span><input value={form.name || ''} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))} className="border px-2 py-1 rounded w-full" placeholder="Nama" /></label>
            <select value={form.company_id || ''} onChange={e=>setForm(f=>({ ...f, company_id: e.target.value ? Number(e.target.value) : undefined }))} className="border p-2 rounded w-full">
              <option value="">Pilih Perusahaan</option>
              {companies.map(c=> (<option key={c.id} value={c.id}>{c.nama}</option>))}
            </select>
            <select value={form.jenjang_id || ''} onChange={e=>setForm(f=>({ ...f, jenjang_id: e.target.value ? Number(e.target.value) : undefined }))} className="border p-2 rounded w-full">
              <option value="">Pilih Jenjang</option>
              {jenjangOpts.map(j=> (<option key={j.id} value={j.id}>{j.name}</option>))}
            </select>
            <input type="number" min={1} value={form.hours || 2} onChange={e=>setForm(f=>({ ...f, hours: Number(e.target.value) }))} className="border px-2 py-1 rounded w-full" placeholder="Jam per minggu" />
            <textarea value={form.note || ''} onChange={e=>setForm(f=>({ ...f, note: e.target.value }))} className="border px-2 py-1 rounded w-full" placeholder="Catatan" />
            <select value={form.active ? 'Aktif' : 'Tidak Aktif'} onChange={e=>setForm(f=>({ ...f, active: e.target.value === 'Aktif' }))} className="border px-2 py-1 rounded w-full">
              <option>Aktif</option>
              <option>Tidak Aktif</option>
            </select>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={()=>setForm({ active: true, hours: 2 })} className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center justify-center gap-2">
                <span>Bersihkan</span>
              </button>
              <button type="button" onClick={save} className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center justify-center gap-2">
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}