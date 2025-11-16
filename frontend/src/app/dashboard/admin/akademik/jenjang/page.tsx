"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { authHeaders, fetchJson } from "@/lib/helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Jenjang = { id:number; kode:string; name:string; company_id?:number|null; company_name?:string|null; note?:string|null; status?:string };
type Company = { id:number; nama:string };

export default function JenjangPage() {
  const [list, setList] = useState<Jenjang[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [form, setForm] = useState<Partial<Jenjang>>({ status: "Aktif" });
  const [companies, setCompanies] = useState<Company[]>([]);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = useMemo(() => ({ ...authHeaders(), "x-role": "admin" }), [token]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ items: Jenjang[] } | Jenjang[]>("/akademik/jenjang", { headers });
      const arr: Jenjang[] = Array.isArray((data as any)?.items)
        ? ((data as any).items as Jenjang[])
        : (Array.isArray(data) ? (data as Jenjang[]) : []);
      const filtered = query.trim()
        ? arr.filter((x: Jenjang) => (`${x.kode} ${x.name}`).toLowerCase().includes(query.toLowerCase()))
        : arr;
      setList(filtered);
    } catch (e:any) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [query]);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const r = await fetch(`${API_URL}/companies`, { headers });
        const d = await r.json().catch(()=>[]);
        if (Array.isArray(d)) setCompanies(d.map((c:any)=>({ id: Number(c.id), nama: String(c.name || c.nama || '') })));
      } catch {}
    };
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    try {
      if (!form.kode || !form.name) {
        Swal.fire({ icon: 'warning', title: 'Lengkapi data', text: 'Kode dan Nama wajib diisi' });
        return;
      }
      const payload = { ...form };
      // Attach company_name from selected company_id for server convenience
      if (payload.company_id && !payload.company_name) {
        const comp = companies.find(c=>c.id===payload.company_id);
        if (comp) payload.company_name = comp.nama;
      }
      const res = await fetch(`${API_URL}/akademik/jenjang`, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      setForm({ status: "Aktif" });
      await load();
      Swal.fire({ icon: 'success', title: 'Tersimpan' });
    } catch (e:any) {
      Swal.fire({ icon: 'error', title: 'Gagal menyimpan', text: e?.message || 'Error' });
    }
  };

  const update = async (id:number, payload: Partial<Jenjang>) => {
    try {
      const res = await fetch(`${API_URL}/akademik/jenjang/${id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e:any) {
      Swal.fire({ icon: 'error', title: 'Gagal update', text: e?.message || 'Error' });
    }
  };

  const remove = async (id:number) => {
    const ok = await Swal.fire({ icon: 'warning', title: 'Hapus data?', showCancelButton: true }).then(r=>r.isConfirmed);
    if (!ok) return;
    try {
      const r = await fetch(`${API_URL}/akademik/jenjang/${id}`, { method: 'DELETE', headers });
      if (!r.ok) { const t = await r.text(); throw new Error(t); }
      await load();
    } catch (e:any) {
      Swal.fire({ icon: 'error', title: 'Tidak bisa dihapus', text: e?.message || 'Data mungkin sudah digunakan' });
    }
  };

  return (
    <div className="p-4 space-y-4 text-black">
      <h1 className="text-xl font-semibold">Akademik - Jenjang</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <input value={query} onChange={e=>setQuery(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm bg-white w-full" placeholder="Cari jenjang..." />
          </div>
          {loading ? <div>Memuat...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Kode</th>
                  <th className="p-2">Nama</th>
                  <th className="p-2">Perusahaan</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.slice((page-1)*limit, page*limit).map(it => (
                  <tr key={it.id} className="border-b">
                    <td className="p-2">
                      <input defaultValue={it.kode} onBlur={e=>update(it.id, { kode: e.target.value })} className="border p-1 rounded w-full" />
                    </td>
                    <td className="p-2">
                      <input defaultValue={it.name} onBlur={e=>update(it.id, { name: e.target.value })} className="border p-1 rounded w-full" />
                    </td>
                    <td className="p-2">{it.company_name || '-'}</td>
                    <td className="p-2">
                      <select defaultValue={it.status || 'Aktif'} onChange={e=>update(it.id, { status: e.target.value })} className="border p-1 rounded">
                        <option>Aktif</option>
                        <option>Tidak Aktif</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <button onClick={()=>remove(it.id)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-600 text-white text-sm">Hapus</button>
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
            <h2 className="font-semibold">Tambah Jenjang</h2>
            <label className="flex flex-col gap-1"><span>Kode <span className="text-red-600">*</span></span><input value={form.kode || ''} onChange={e=>setForm(f=>({ ...f, kode: e.target.value }))} className="border px-2 py-1 rounded w-full" placeholder="Kode" /></label>
            <label className="flex flex-col gap-1"><span>Nama <span className="text-red-600">*</span></span><input value={form.name || ''} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))} className="border px-2 py-1 rounded w-full" placeholder="Nama" /></label>
            <select value={form.company_id || ''} onChange={e=>setForm(f=>({ ...f, company_id: e.target.value ? Number(e.target.value) : undefined }))} className="border p-2 rounded w-full">
              <option value="">Pilih Perusahaan</option>
              {companies.map(c=> (<option key={c.id} value={c.id}>{c.nama}</option>))}
            </select>
            <textarea value={form.note || ''} onChange={e=>setForm(f=>({ ...f, note: e.target.value }))} className="border px-2 py-1 rounded w-full" placeholder="Catatan" />
            <select value={form.status || 'Aktif'} onChange={e=>setForm(f=>({ ...f, status: e.target.value }))} className="border px-2 py-1 rounded w-full">
              <option>Aktif</option>
              <option>Tidak Aktif</option>
            </select>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={()=>setForm({ status: 'Aktif' })} className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center justify-center gap-2">
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