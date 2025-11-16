"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { confirmDelete, success, error, warn } from "@/lib/alerts";
import { authHeaders, fetchJson } from "@/lib/helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Guru = { id:number; user_id?:number|null; user_name?:string|null; max_hours?:number|null; allowed_categories?:string|null; active?:boolean; subject_ids?:number[] };
type UserOpt = { id:number; nama:string };
type SubjectOpt = { id:number; name:string };

export default function GuruPage() {
  const [list, setList] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<Partial<Guru>>({ active: true, max_hours: 20, subject_ids: [], allowed_categories: '' });
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = useMemo(() => ({ ...authHeaders(), "x-role": "admin" }), [token]);

  const loadRefs = async () => {
    try {
      const r = await fetch(`${API_URL}/users?page=1&limit=1000`, { headers });
      const d = await r.json().catch(()=>({}));
      const arr = Array.isArray(d?.data) ? d.data : [];
      setUsers(arr.map((u:any) => ({ id: Number(u.id), nama: String(u.nama || u.name || '') })));
    } catch {}
    try {
      const data = await fetchJson<{ items: any[] } | any[]>("/akademik/mapel", { headers });
      const arr = Array.isArray((data as any).items) ? (data as any).items : (Array.isArray(data) ? (data as any) : []);
      setSubjects(arr.map((m:any)=>({ id: Number(m.id), name: String(m.name || '') })));
    } catch {}
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ items: Guru[] } | Guru[]>("/akademik/guru", { headers });
      const arr = Array.isArray((data as any).items) ? (data as any).items : (Array.isArray(data) ? (data as any) : []);
      const filtered = query.trim()
        ? arr.filter((x: Guru)=>`${x.user_name || ''}`.toLowerCase().includes(query.toLowerCase()))
        : arr;
      setList(filtered);
    } catch (e:any) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadRefs(); load(); }, []);
  useEffect(() => { load(); }, [query]);

  const save = async () => {
    try {
      if (!form.user_id) {
        warn('Validasi', 'Wajib pilih user guru');
        return;
      }
      const payload: any = { ...form };
      if (payload.user_id && !payload.user_name) {
        const u = users.find(x=>x.id===payload.user_id);
        if (u) payload.user_name = u.nama;
      }
      // normalize categories string from selection
      if (Array.isArray((payload as any).allowed_categories_arr)) {
        payload.allowed_categories = (payload as any).allowed_categories_arr.join(',');
      }
      const res = await fetch(`${API_URL}/akademik/guru`, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      setForm({ active: true, max_hours: 20, subject_ids: [], allowed_categories: '' });
      await load();
      success('Tersimpan');
    } catch (e:any) {
      error('Gagal menyimpan', e?.message || 'Error');
    }
  };

  const update = async (id:number, payload: Partial<Guru>) => {
    try {
      const res = await fetch(`${API_URL}/akademik/guru/${id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
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
      const r = await fetch(`${API_URL}/akademik/guru/${id}`, { method: 'DELETE', headers });
      if (!r.ok) { const t = await r.text(); throw new Error(t); }
      await load();
      success('Terhapus');
    } catch (e:any) {
      error('Tidak bisa dihapus', e?.message || 'Data mungkin sudah digunakan');
    }
  };

  const categoryOpts = ["Laki-Laki","Perempuan","Gabungan"];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Akademik - Data Guru</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <input value={query} onChange={e=>setQuery(e.target.value)} className="border p-2 rounded w-full" placeholder="Cari guru..." />
          </div>
          {loading ? <div>Memuat...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Guru</th>
                  <th className="p-2">Max Jam</th>
                  <th className="p-2">Kategori Diizinkan</th>
                  <th className="p-2">Aktif</th>
                  <th className="p-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map(it => (
                  <tr key={it.id} className="border-b">
                    <td className="p-2">{it.user_name || '-'}</td>
                    <td className="p-2">
                      <input type="number" min={0} defaultValue={it.max_hours || 0} onBlur={e=>update(it.id, { max_hours: Number(e.target.value) })} className="border p-1 rounded w-24" />
                    </td>
                    <td className="p-2">{it.allowed_categories || '-'}</td>
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
            <h2 className="font-semibold">Tambah Guru</h2>
            <select value={form.user_id || ''} onChange={e=>setForm(f=>({ ...f, user_id: e.target.value ? Number(e.target.value) : undefined }))} className="border p-2 rounded w-full">
              <option value="">Pilih User</option>
              {users.map(u=> (<option key={u.id} value={u.id}>{u.nama}</option>))}
            </select>
            <input type="number" min={0} value={form.max_hours || 20} onChange={e=>setForm(f=>({ ...f, max_hours: Number(e.target.value) }))} className="border p-2 rounded w-full" placeholder="Max Jam/minggu" />
            <div>
              <label className="font-medium text-sm">Kategori Diizinkan</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {categoryOpts.map(cat => {
                  const arr = String(form.allowed_categories || '').split(',').filter(Boolean);
                  const checked = arr.includes(cat);
                  return (
                    <label key={cat} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={checked} onChange={(e)=>{
                        const current = new Set(arr);
                        if (e.target.checked) current.add(cat); else current.delete(cat);
                        setForm(f=>({ ...f, allowed_categories: Array.from(current).join(',') }));
                      }} />
                      <span>{cat}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="font-medium text-sm">Mata Pelajaran Diampu</label>
              <div className="grid grid-cols-2 gap-2 mt-1 max-h-40 overflow-auto border rounded p-2">
                {subjects.map(s => {
                  const arr = Array.isArray(form.subject_ids) ? form.subject_ids : [];
                  const checked = arr.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={checked} onChange={(e)=>{
                        const current = new Set(arr);
                        if (e.target.checked) current.add(s.id); else current.delete(s.id);
                        setForm(f=>({ ...f, subject_ids: Array.from(current) as number[] }));
                      }} />
                      <span>{s.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
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