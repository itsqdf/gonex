"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Item = {
  id: number;
  nama: string;
  deskripsi: string;
  maintenance: boolean;
  created_at: string;
  updated_at?: string;
  _editing?: boolean;
  _nama?: string;
  _deskripsi?: string;
  _maintenance?: boolean;
};

export default function CategoryAssetPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const loadData = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/category-assets?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      const list = Array.isArray(d.data) ? d.data : [];
      setItems(list.map((it: any) => ({
        id: it.id,
        nama: it.nama || "",
        deskripsi: it.deskripsi || "",
        maintenance: !!it.maintenance,
        created_at: it.created_at,
        updated_at: it.updated_at,
      })));
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [q]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIdx = (page - 1) * limit;
  const currentItems = items.slice(startIdx, startIdx + limit);
  useEffect(() => { if (page > totalPages) setPage(1); }, [items, limit, page, totalPages]);

  const createItem = async () => {
    if (!nama.trim()) return alert("Nama wajib");
    const payload = { nama, deskripsi, maintenance };
    const r = await fetch(`${API_URL}/category-assets`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (r.ok) {
      setNama(""); setDeskripsi(""); setMaintenance(false);
      loadData();
    } else {
      const d = await r.json().catch(()=>({})); alert(d.error || "Gagal menyimpan");
    }
  };

  const startEdit = (it: Item) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: true, _nama: i.nama, _deskripsi: i.deskripsi, _maintenance: i.maintenance } : i));
  };
  const cancelEdit = (it: Item) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: false } : i));
  };
  const saveEdit = async (it: Item) => {
    const payload: any = { nama: it._nama, deskripsi: it._deskripsi, maintenance: it._maintenance };
    const r = await fetch(`${API_URL}/category-assets/${it.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (r.ok) { loadData(); } else { const d = await r.json().catch(()=>({})); alert(d.error || "Gagal menyimpan"); }
  };
  const deleteItem = async (it: Item) => {
    if (!confirm("Hapus kategori ini?")) return;
    const r = await fetch(`${API_URL}/category-assets/${it.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) { loadData(); } else { const d = await r.json().catch(()=>({})); alert(d.error || "Gagal menghapus"); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Category Asset</h2>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowForm(s=>!s)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow">
              <span>➕</span><span>{showForm ? "Tutup" : "Tambah"}</span>
            </button>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari..." className="px-3 py-2 rounded border w-64" />
          </div>
        </div>

        {showForm && (
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <h3 className="text-black font-medium mb-2">Tambah Category Asset</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="relative">
              <input value={nama} onChange={e=>setNama(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 transition-all">Nama</label>
            </div>
            <div className="relative">
              <input value={deskripsi} onChange={e=>setDeskripsi(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 transition-all">Deskripsi</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={maintenance} onChange={e=>setMaintenance(e.target.checked)} />
              <span className="text-sm text-black">Perlu Maintenance</span>
            </div>
          </div>
          <div className="mt-3">
            <button onClick={createItem} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow">
              <span>Simpan</span>
            </button>
          </div>
        </div>
        )}

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          {loading ? (
            <p className="text-sm text-black">Memuat...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-black">
                <thead>
                  <tr className="text-left text-black">
                    <th className="py-2">Nama</th>
                    <th className="py-2">Deskripsi</th>
                    <th className="py-2">Maintenance</th>
                    <th className="py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map(it => (
                    <tr key={it.id} className="border-t border-gray-100">
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <input value={it._nama || ""} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _nama:e.target.value}:p))} className="px-2 py-1 rounded border" />
                        ) : (
                          it.nama
                        )}
                      </td>
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <input value={it._deskripsi || ""} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _deskripsi:e.target.value}:p))} className="px-2 py-1 rounded border" />
                        ) : (
                          it.deskripsi
                        )}
                      </td>
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <input type="checkbox" checked={!!it._maintenance} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _maintenance:e.target.checked}:p))} />
                        ) : (
                          it.maintenance ? "Ya" : "Tidak"
                        )}
                      </td>
                      <td className="py-2">
                        {it._editing ? (
                          <div className="flex gap-2">
                 <button onClick={()=>saveEdit(it)} className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-blue-500 dark:text-blue-500 dark:hover:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-800 inline-flex items-center justify-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                   </svg>
                   <span>Simpan</span>
                 </button>
                 <button onClick={()=>cancelEdit(it)} className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-red-500 dark:text-red-500 dark:hover:text-white dark:hover:bg-red-600 dark:focus:ring-red-900 inline-flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                   </svg>
                   <span>Batal</span>
                 </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={()=>startEdit(it)} className="px-2 py-1 rounded bg-green-600 text-white">✏️ Edit</button>
                            <button onClick={()=>deleteItem(it)} className="px-2 py-1 rounded bg-green-600 text-white">🗑️ Hapus</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 text-sm text-black">
                  <span>Limit:</span>
                  <select value={limit} onChange={e=>{setLimit(Number(e.target.value)); setPage(1);}} className="px-2 py-1 rounded border">
                    {[10,25,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span>Total: {total}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="inline-flex items-center gap-2 rounded px-3 py-1.5 bg-green-600 text-white disabled:opacity-50"><span>◀</span><span>Prev</span></button>
                  <span className="text-sm text-black">Page {page} of {totalPages}</span>
                  <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="inline-flex items-center gap-2 rounded px-3 py-1.5 bg-green-600 text-white disabled:opacity-50"><span>Next</span><span>▶</span></button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}