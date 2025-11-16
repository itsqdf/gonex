"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { confirmDelete, success, error, warn } from "@/lib/alerts";
import { authHeaders, fetchJson } from "@/lib/helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Kelas = {
  id:number;
  kode?: string | null;
  name:string;
  kategori:"Laki-Laki"|"Perempuan"|"Gabungan"|"";
  wali_kelas_user_id?:number|null;
  wali_kelas_name?:string|null;
  nuptk?:string|null;
  nip?:string|null;
  niy?:string|null;
  signature_url?:string|null;
  jumlah_kelas?:number|null;
  jenjang_id?:number|null;
  jenjang_name?:string|null;
  active?:boolean;
  note?:string|null;
};
type Jenjang = { id:number; name:string };
type UserOpt = { id:number; nama:string };

export default function KelasPage() {
  const [list, setList] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [form, setForm] = useState<Partial<Kelas>>({ kategori: "Gabungan", active: true });
  const [jenjangOpts, setJenjangOpts] = useState<Jenjang[]>([]);
  const [waliOpts, setWaliOpts] = useState<UserOpt[]>([]);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = useMemo(() => ({ ...authHeaders(), "x-role": "admin" }), [token]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ items: Kelas[] } | Kelas[]>("/akademik/kelas", { headers });
      const arr: Kelas[] = Array.isArray((data as any)?.items)
        ? ((data as any).items as Kelas[])
        : (Array.isArray(data) ? (data as Kelas[]) : []);
      const filtered = query.trim()
        ? arr.filter((x: Kelas) => (`${x.name} ${x.jenjang_name || ''}`).toLowerCase().includes(query.toLowerCase()))
        : arr;
      setList(filtered);
    } catch (e:any) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [query]);

  useEffect(() => {
    const loadRefs = async () => {
      try {
        const j = await fetchJson<{ items: Jenjang[] }>("/akademik/jenjang", { headers });
        const arr = Array.isArray((j as any).items) ? (j as any).items : Array.isArray(j) ? (j as any) : [];
        setJenjangOpts(arr.map((x:any)=>({ id:Number(x.id), name: String(x.name||'') })));
      } catch {}
      try {
        const r = await fetch(`${API_URL}/users?page=1&limit=1000`, { headers });
        const d = await r.json().catch(()=>({}));
        const arr = Array.isArray(d?.data) ? d.data : [];
        setWaliOpts(arr.map((u:any)=>({ id: Number(u.id), nama: String(u.nama || u.name || '') })));
      } catch {}
    };
    loadRefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    try {
      if (!form.name) {
        warn('Validasi', 'Nama kelas wajib diisi');
        return;
      }
      const payload: any = { ...form };
      // Attach jenjang_name from selected jenjang_id
      if (payload.jenjang_id && !payload.jenjang_name) {
        const jj = jenjangOpts.find(j=>j.id===payload.jenjang_id);
        if (jj) payload.jenjang_name = jj.name;
      }
      // Attach wali_kelas_name from selected wali_kelas_user_id
      if (payload.wali_kelas_user_id && !payload.wali_kelas_name) {
        const wu = waliOpts.find(w=>w.id===payload.wali_kelas_user_id);
        if (wu) payload.wali_kelas_name = wu.nama;
      }
      const res = await fetch(`${API_URL}/akademik/kelas`, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      setForm({ kategori: "Gabungan", active: true });
      await load();
      success('Tersimpan');
    } catch (e:any) {
      error('Gagal menyimpan', e?.message || 'Error');
    }
  };

  const update = async (id:number, payload: Partial<Kelas>) => {
    try {
      const res = await fetch(`${API_URL}/akademik/kelas/${id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
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
      const r = await fetch(`${API_URL}/akademik/kelas/${id}`, { method: 'DELETE', headers });
      if (!r.ok) { const t = await r.text(); throw new Error(t); }
      await load();
      success('Terhapus');
    } catch (e:any) {
      error('Tidak bisa dihapus', e?.message || 'Data mungkin sudah digunakan');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Akademik - Kelas</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <input value={query} onChange={e=>setQuery(e.target.value)} className="border p-2 rounded w-full" placeholder="Cari kelas..." />
          </div>
          {loading ? <div>Memuat...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Kode</th>
                  <th className="p-2">Nama</th>
                  <th className="p-2">Kategori</th>
                  <th className="p-2">Wali Kelas</th>
                  <th className="p-2">Jenjang</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.slice((page-1)*limit, page*limit).map(it => (
                  <tr key={it.id} className="border-b">
                    <td className="p-2">
                      <input defaultValue={it.kode || ''} onBlur={e=>update(it.id, { kode: e.target.value })} className="border p-1 rounded w-full" />
                    </td>
                    <td className="p-2">
                      <input defaultValue={it.name} onBlur={e=>update(it.id, { name: e.target.value })} className="border p-1 rounded w-full" />
                    </td>
                    <td className="p-2">
                      <select defaultValue={it.kategori || ''} onChange={e=>update(it.id, { kategori: e.target.value as any })} className="border p-1 rounded">
                        <option>Laki-Laki</option>
                        <option>Perempuan</option>
                        <option>Gabungan</option>
                      </select>
                    </td>
                    <td className="p-2">{it.wali_kelas_name || '-'}</td>
                    <td className="p-2">{it.jenjang_name || '-'}</td>
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
          <div className="border rounded p-3 space-y-2">
            <h2 className="font-semibold">Tambah Kelas</h2>
            <input value={form.kode || ''} onChange={e=>setForm(f=>({ ...f, kode: e.target.value }))} className="border p-2 rounded w-full" placeholder="Kode Kelas" />
            <input value={form.name || ''} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))} className="border p-2 rounded w-full" placeholder="Nama Kelas" />
            <select value={form.kategori || 'Gabungan'} onChange={e=>setForm(f=>({ ...f, kategori: e.target.value as any }))} className="border p-2 rounded w-full">
              <option>Laki-Laki</option>
              <option>Perempuan</option>
              <option>Gabungan</option>
            </select>
            <select value={form.jenjang_id || ''} onChange={e=>setForm(f=>({ ...f, jenjang_id: e.target.value ? Number(e.target.value) : undefined }))} className="border p-2 rounded w-full">
              <option value="">Pilih Jenjang</option>
              {jenjangOpts.map(j=> (<option key={j.id} value={j.id}>{j.name}</option>))}
            </select>
            <select value={form.wali_kelas_user_id || ''} onChange={e=>setForm(f=>({ ...f, wali_kelas_user_id: e.target.value ? Number(e.target.value) : undefined }))} className="border p-2 rounded w-full">
              <option value="">Pilih Wali Kelas</option>
              {waliOpts.map(u=> (<option key={u.id} value={u.id}>{u.nama}</option>))}
            </select>
            <textarea value={form.note || ''} onChange={e=>setForm(f=>({ ...f, note: e.target.value }))} className="border p-2 rounded w-full" placeholder="Catatan" />
            <select value={(form.active ?? true) ? 'Aktif' : 'Tidak Aktif'} onChange={e=>setForm(f=>({ ...f, active: e.target.value === 'Aktif' }))} className="border p-2 rounded w-full">
              <option>Aktif</option>
              <option>Tidak Aktif</option>
            </select>
            <button onClick={save} className="bg-blue-600 text-white px-3 py-2 rounded">Simpan</button>
          </div>
        </div>
      </div>
    </div>
  );
}