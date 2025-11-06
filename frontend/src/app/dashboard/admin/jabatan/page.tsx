"use client";

import { useEffect, useState } from "react";
import { confirmDelete, error, success, warn } from "@/lib/alerts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Jabatan = { id: number; name: string };

export default function JabatanPage() {
  const [items, setItems] = useState<Jabatan[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [mode, setMode] = useState<"add"|"edit"|null>(null);
  const [editingId, setEditingId] = useState<number|null>(null);
  const [form, setForm] = useState<{name:string}>({ name: "" });
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const load = () => {
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    setLoading(true);
    if (!tok) { setLoading(false); warn("Autentikasi", "Token tidak ditemukan, silakan login kembali"); return; }
    fetch(`${API_URL}/jabatan`, { headers: { Authorization: `Bearer ${tok}` }})
      .then(r=>r.json().catch(()=>[]))
      .then((arr)=>{
        const all: Jabatan[] = Array.isArray(arr) ? arr : [];
        const filtered = query.trim() ? all.filter(i => i.name?.toLowerCase().includes(query.trim().toLowerCase())) : all;
        setTotal(filtered.length);
        const pgs = Math.max(1, Math.ceil(filtered.length / limit));
        setPages(pgs);
        const start = (page - 1) * limit;
        setItems(filtered.slice(start, start + limit));
      })
      .finally(()=>setLoading(false));
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [page, limit, query]);

  const resetForm = () => { setForm({ name: "" }); setMode(null); setEditingId(null); };

  const onSave = async () => {
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!tok) { return warn("Autentikasi", "Token tidak ditemukan, silakan login kembali"); }
    const payload = { name: form.name.trim() };
    if (!payload.name) return warn("Validasi", "Nama Jabatan wajib");
    // Client-side duplicate check (case-insensitive)
    const existsLocal = items.some(i => i.name?.toLowerCase() === payload.name.toLowerCase() && (mode !== 'edit' || i.id !== editingId));
    if (existsLocal) return warn("Validasi", "Nama Jabatan sudah ada");
    let url = `${API_URL}/jabatan`; let method = "POST";
    if (mode === "edit" && editingId) { url = `${API_URL}/jabatan/${editingId}`; method = "PUT"; }
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(payload) });
    const data = await res.json().catch(()=>({}));
    if (res.status === 409) return warn("Validasi", data?.error || "Nama Jabatan sudah ada");
    if (!res.ok) return error("Gagal", data?.error || "Gagal menyimpan");
    success("Berhasil", "Data Jabatan disimpan");
    resetForm();
    load();
  };

  const startEdit = (it: Jabatan) => {
    setMode("edit"); setEditingId(it.id); setForm({ name: it.name || "" });
  };
  const remove = async (it: Jabatan) => {
    const ok = await confirmDelete("Hapus Jabatan?", it.name, "Ya, hapus");
    if (!ok || !token) return;
    const res = await fetch(`${API_URL}/jabatan/${it.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) return error("Gagal", data?.error || "Gagal menghapus");
    success("Berhasil", "Jabatan dihapus");
    load();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Jabatan</h2>
          <div className="flex items-center gap-2">
            <button onClick={()=> setMode(m=> m ? null : "add")} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow">
              <span>{mode ? "Tutup" : "Tambah"}</span>
            </button>
            <input value={query} onChange={e=>{ setQuery(e.target.value); setPage(1);} } placeholder="Cari jabatan" className="px-3 py-2 rounded border w-64" />
          </div>
        </div>

        {mode && (
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
            <h3 className="text-black font-medium mb-2">{mode === "add" ? "Tambah" : "Edit"} Jabatan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <input value={form.name} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent normal-case" placeholder="Nama" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={onSave} className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Simpan</span>
              </button>
              <button onClick={resetForm} className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Batal</span>
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-black">Tampil</label>
              <select value={limit} onChange={e=>{ setLimit(parseInt(e.target.value,10)); setPage(1); }} className="px-2 py-1 rounded border text-sm">
                {[5,10,20,50].map(n=> (<option key={n} value={n}>{n}</option>))}
              </select>
              <span className="text-sm text-black">per halaman</span>
            </div>
            <div className="text-sm text-black">Total: {total} • Halaman {page} dari {pages || 1}</div>
          </div>
          {loading ? (
            <p className="text-sm text-black">Memuat...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-black">
                    <th className="py-2">Nama</th>
                    <th className="py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it=> (
                    <tr key={it.id} className="border-t border-gray-100">
                      <td className="py-2 text-black normal-case">{it.name}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <button onClick={()=>startEdit(it)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-600 text-white text-sm">Edit</button>
                          <button onClick={()=>remove(it)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-600 text-white text-sm">Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between mt-3">
                <div className="text-sm text-black">Menampilkan {(items?.length||0)} dari {total}</div>
                <div className="flex items-center gap-2">
                  <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1, p-1))} className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-50">Prev</button>
                  <span className="text-sm text-black">{page} / {pages || 1}</span>
                  <button disabled={pages>0 && page>=pages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-50">Next</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}