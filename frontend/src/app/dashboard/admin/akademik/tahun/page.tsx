"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { confirmDelete, success, error, warn } from "@/lib/alerts";
import { authHeaders, fetchJson } from "@/lib/helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Tahun = { id: number; name: string; kurikulum?: string | null; tahun?: string | null; active?: boolean; note?: string | null };

export default function TahunPelajaranPage() {
  const [list, setList] = useState<Tahun[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<Partial<Tahun>>({ active: true });
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = useMemo(() => ({ ...authHeaders(), "x-role": "admin" }), [token]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ items: Tahun[] } | Tahun[]>("/akademik/tahun", { headers });
      const arr = Array.isArray((data as any).items) ? (data as any).items : (Array.isArray(data) ? (data as any) : []);
      const filtered = query.trim()
        ? arr.filter((x: Tahun) => `${x.name} ${x.kurikulum || ''} ${x.tahun || ''}`.toLowerCase().includes(query.toLowerCase()))
        : arr;
      setList(filtered);
    } catch (e: any) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { load(); }, [query]);

  const save = async () => {
    try {
      if (!form.name) {
        warn('Validasi', 'Nama tahun pelajaran wajib diisi');
        return;
      }
      const res = await fetch(`${API_URL}/akademik/tahun`, { method: 'POST', headers, body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      setForm({ active: true });
      await load();
      success('Tersimpan');
    } catch (e:any) {
      error('Gagal menyimpan', e?.message || 'Error');
    }
  };

  const update = async (id:number, payload: Partial<Tahun>) => {
    try {
      const res = await fetch(`${API_URL}/akademik/tahun/${id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
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
      const r = await fetch(`${API_URL}/akademik/tahun/${id}`, { method: 'DELETE', headers });
      if (!r.ok) { const t = await r.text(); throw new Error(t); }
      await load();
      success('Terhapus');
    } catch (e:any) {
      error('Tidak bisa dihapus', e?.message || 'Data mungkin sudah digunakan');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Akademik - Tahun Pelajaran</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <input value={query} onChange={e=>setQuery(e.target.value)} className="border p-2 rounded w-full" placeholder="Cari tahun pelajaran..." />
          </div>
          {loading ? <div>Memuat...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Nama</th>
                  <th className="p-2">Kurikulum</th>
                  <th className="p-2">Tahun</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map(it => (
                  <tr key={it.id} className="border-b">
                    <td className="p-2">
                      <input defaultValue={it.name} onBlur={e=>update(it.id, { name: e.target.value })} className="border p-1 rounded w-full" />
                    </td>
                    <td className="p-2">
                      <input defaultValue={it.kurikulum || ''} onBlur={e=>update(it.id, { kurikulum: e.target.value })} className="border p-1 rounded w-full" />
                    </td>
                    <td className="p-2">
                      <input defaultValue={it.tahun || ''} onBlur={e=>update(it.id, { tahun: e.target.value })} className="border p-1 rounded w-full" />
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
        </div>
        <div>
          <div className="border rounded p-3 space-y-2">
            <h2 className="font-semibold">Tambah Tahun Pelajaran</h2>
            <input value={form.name || ''} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))} className="border p-2 rounded w-full" placeholder="Nama" />
            <input value={form.kurikulum || ''} onChange={e=>setForm(f=>({ ...f, kurikulum: e.target.value }))} className="border p-2 rounded w-full" placeholder="Kurikulum" />
            <input value={form.tahun || ''} onChange={e=>setForm(f=>({ ...f, tahun: e.target.value }))} className="border p-2 rounded w-full" placeholder="Tahun (mis. 2024/2025)" />
            <textarea value={form.note || ''} onChange={e=>setForm(f=>({ ...f, note: e.target.value }))} className="border p-2 rounded w-full" placeholder="Catatan" />
            <select value={form.active ? 'Aktif' : 'Tidak Aktif'} onChange={e=>setForm(f=>({ ...f, active: e.target.value === 'Aktif' }))} className="border p-2 rounded w-full">
              <option>Aktif</option>
              <option>Tidak Aktif</option>
            </select>
            <button onClick={save} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-blue-600 hover:bg-blue-700 shadow">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>Simpan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}