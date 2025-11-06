"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Warehouse = {
  id: number;
  company_id?: number | null;
  name: string;
  location: string;
  descriptions: string;
  created_at: string;
  updated_at?: string | null;
  _editing?: boolean;
  _name?: string;
  _location?: string;
  _descriptions?: string;
  _company_id?: string;
};

type Company = { id: number; nama: string };

export default function GudangPage() {
  const [items, setItems] = useState<Warehouse[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [location, setLocation] = useState("");
  const [descriptions, setDescriptions] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const tok = localStorage.getItem("token");
    setLoading(true);
    fetch(`${API_URL}/warehouses${q?`?q=${encodeURIComponent(q)}`:""}`, { headers: { Authorization: `Bearer ${tok}` }})
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d.warehouses) ? d.warehouses : []); })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, [q]);

  useEffect(() => {
    const tok = localStorage.getItem("token");
    fetch(`${API_URL}/companies`, { headers: { Authorization: `Bearer ${tok}` }})
      .then(r => r.json())
      .then(d => { setCompanies(Array.isArray(d.companies) ? d.companies.map((c:any)=>({ id: c.id, nama: c.nama })) : []); })
      .catch(()=>{});
  }, []);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIdx = (page - 1) * limit;
  const currentItems = items.slice(startIdx, startIdx + limit);
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [items, limit, page, totalPages]);

  const submit = async () => {
    const tok = localStorage.getItem("token");
    const payload:any = { name, location, descriptions };
    if (companyId) payload.company_id = Number(companyId);
    const r = await fetch(`${API_URL}/warehouses`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(payload) });
    if (r.ok) {
      setShowForm(false);
      setName(""); setCompanyId(""); setLocation(""); setDescriptions("");
      setQ(q => q); // trigger reload
    }
  };

  const startEdit = (it: Warehouse) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: true, _name: it.name, _location: it.location || "", _descriptions: it.descriptions || "", _company_id: String(it.company_id ?? "") } : i));
  };

  const saveEdit = async (it: Warehouse) => {
    const tok = localStorage.getItem("token");
    const payload:any = {};
    if (it._name !== undefined) payload.name = it._name;
    if (it._location !== undefined) payload.location = it._location;
    if (it._descriptions !== undefined) payload.descriptions = it._descriptions;
    if (it._company_id !== undefined) payload.company_id = it._company_id ? Number(it._company_id) : null;
    const r = await fetch(`${API_URL}/warehouses/${it.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(payload) });
    if (r.ok) setItems(items.map(i => i.id===it.id ? { ...i, name: it._name || it.name, location: it._location || it.location, descriptions: it._descriptions || it.descriptions, company_id: it._company_id ? Number(it._company_id) : null, _editing: false } : i));
  };

  const remove = async (id: number) => {
    if (!confirm("Hapus gudang ini?")) return;
    const tok = localStorage.getItem("token");
    const r = await fetch(`${API_URL}/warehouses/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${tok}` } });
    if (r.ok) setItems(items.filter(i => i.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Gudang</h2>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowForm(s=>!s)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-400 hover:bg-green-500 shadow">
              <span>➕</span><span>{showForm ? "Tutup" : "Tambah"}</span>
            </button>
            <button onClick={()=>{ if (typeof window !== 'undefined') window.print(); }} className="px-3 py-2 rounded border">Cetak</button>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ketik untuk mencari" className="px-3 py-2 rounded border w-64" />
          </div>
        </div>

        {showForm && (
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
            <h3 className="text-black font-medium mb-2">Tambah Gudang</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="relative">
                <select value={companyId} onChange={e=>setCompanyId(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
                  <option value="">Pilih Perusahaan (opsional)</option>
                  {companies.map(c=> <option key={c.id} value={String(c.id)}>{c.nama}</option>)}
                </select>
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Perusahaan</label>
              </div>
              <div className="relative">
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Nama</label>
              </div>
              <div className="relative">
                <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Lokasi" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Lokasi</label>
              </div>
              <div className="relative">
                <input value={descriptions} onChange={e=>setDescriptions(e.target.value)} placeholder="Deskripsi" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Deskripsi</label>
              </div>
              <div>
                <button onClick={submit} className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:border-blue-500 dark:text-blue-500 dark:hover:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-800 inline-flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Simpan</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          {loading ? <p className="text-sm text-black">Memuat...</p> : (
            <>
            <table className="w-full text-sm text-black">
              <thead>
                <tr className="text-left">
                  <th className="py-2">Nama</th>
                  <th>Lokasi</th>
                  <th>Deskripsi</th>
                  <th>Perusahaan</th>
                  <th className="w-40">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map(it => (
                  <tr key={it.id} className="border-t">
                    <td className="py-2">
                      {it._editing ? (
                        <input value={it._name || ""} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_name:e.target.value}:i))} className="px-2 py-1 rounded border w-full" />
                      ) : it.name}
                    </td>
                    <td>
                      {it._editing ? (
                        <input value={it._location || ""} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_location:e.target.value}:i))} className="px-2 py-1 rounded border w-full" />
                      ) : it.location}
                    </td>
                    <td>
                      {it._editing ? (
                        <input value={it._descriptions || ""} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_descriptions:e.target.value}:i))} className="px-2 py-1 rounded border w-full" />
                      ) : it.descriptions}
                    </td>
                    <td>
                      {it._editing ? (
                        <select value={it._company_id || ""} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_company_id:e.target.value}:i))} className="px-2 py-1 rounded border w-full">
                          <option value="">-</option>
                          {companies.map(c=> <option key={c.id} value={String(c.id)}>{c.nama}</option>)}
                        </select>
                      ) : (it.company_id || "-")}
                    </td>
                    <td>
                      {it._editing ? (
                        <div className="flex gap-2">
                           <button onClick={()=>saveEdit(it)} className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-blue-500 dark:text-blue-500 dark:hover:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-800 inline-flex items-center justify-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                               <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                             </svg>
                             <span>Simpan</span>
                           </button>
                           <button onClick={()=>setItems(items.map(i=>i.id===it.id?{...i,_editing:false}:i))} className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-red-500 dark:text-red-500 dark:hover:text-white dark:hover:bg-red-600 dark:focus:ring-red-900 inline-flex items-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                               <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                             </svg>
                             <span>Batal</span>
                           </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={()=>startEdit(it)} className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">✏️ Edit</button>
                          <button onClick={()=>remove(it.id)} className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white">🗑️ Hapus</button>
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
                <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="inline-flex items-center gap-2 rounded px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50"><span>◀</span><span>Prev</span></button>
                <span className="text-sm text-black">Page {page} of {totalPages}</span>
                <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="inline-flex items-center gap-2 rounded px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50"><span>Next</span><span>▶</span></button>
              </div>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}