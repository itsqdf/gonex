"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Rack = {
  id: number;
  warehouse_id: number;
  code: string;
  name: string;
  kapasitas: number;
  descriptions: string;
  created_at: string;
  updated_at?: string | null;
  _editing?: boolean;
  _warehouse_id?: string;
  _code?: string;
  _name?: string;
  _kapasitas?: string;
  _descriptions?: string;
};

type Warehouse = { id: number; name: string };

export default function RakPage() {
  const [items, setItems] = useState<Rack[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kapasitas, setKapasitas] = useState("");
  const [descriptions, setDescriptions] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const tok = localStorage.getItem("token");
    fetch(`${API_URL}/warehouses`, { headers: { Authorization: `Bearer ${tok}` }})
      .then(r => r.json())
      .then(d => setWarehouses(Array.isArray(d.warehouses) ? d.warehouses.map((w:any)=>({ id: w.id, name: w.name })) : []))
      .catch(()=>{});
  }, []);

  useEffect(() => {
    const tok = localStorage.getItem("token");
    fetch(`${API_URL}/racks${q?`?q=${encodeURIComponent(q)}`:""}`, { headers: { Authorization: `Bearer ${tok}` }})
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d.racks) ? d.racks : []))
      .catch(()=>{});
  }, [q]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIdx = (page - 1) * limit;
  const currentItems = items.slice(startIdx, startIdx + limit);
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [items, limit, page, totalPages]);

  const submit = async () => {
    const tok = localStorage.getItem("token");
    const payload:any = { warehouse_id: Number(warehouseId), code, name, kapasitas: Number(kapasitas||"0"), descriptions };
    const r = await fetch(`${API_URL}/racks`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(payload) });
    if (r.ok) { setShowForm(false); setWarehouseId(""); setCode(""); setName(""); setKapasitas(""); setDescriptions(""); setQ(q=>q); }
  };

  const startEdit = (it: Rack) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: true, _warehouse_id: String(it.warehouse_id), _code: it.code, _name: it.name, _kapasitas: String(it.kapasitas), _descriptions: it.descriptions||"" } : i));
  };
  const saveEdit = async (it: Rack) => {
    const tok = localStorage.getItem("token");
    const payload:any = {};
    if (it._warehouse_id !== undefined) payload.warehouse_id = Number(it._warehouse_id);
    if (it._code !== undefined) payload.code = it._code;
    if (it._name !== undefined) payload.name = it._name;
    if (it._kapasitas !== undefined) payload.kapasitas = Number(it._kapasitas||"0");
    if (it._descriptions !== undefined) payload.descriptions = it._descriptions;
    const r = await fetch(`${API_URL}/racks/${it.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(payload) });
    if (r.ok) setItems(items.map(i=>i.id===it.id?{...i, warehouse_id: Number(it._warehouse_id||i.warehouse_id), code: it._code || i.code, name: it._name || i.name, kapasitas: Number(it._kapasitas||String(i.kapasitas)), descriptions: it._descriptions || i.descriptions, _editing: false }:i));
  };

  const remove = async (id: number) => {
    if (!confirm("Hapus rak ini?")) return;
    const tok = localStorage.getItem("token");
    const r = await fetch(`${API_URL}/racks/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${tok}` } });
    if (r.ok) setItems(items.filter(i => i.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Rak</h2>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowForm(s=>!s)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-400 hover:bg-green-500 shadow"><span>➕</span><span>{showForm?"Tutup":"Tambah"}</span></button>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ketik untuk mencari" className="px-3 py-2 rounded border w-64" />
          </div>
        </div>

        {showForm && (
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
            <h3 className="text-black font-medium mb-2">Tambah Rak</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="relative">
                <select value={warehouseId} onChange={e=>setWarehouseId(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
                  <option value="">Pilih Gudang</option>
                  {warehouses.map(w=> <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                </select>
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Gudang</label>
              </div>
              <div className="relative">
                <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Kode" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Kode</label>
              </div>
              <div className="relative">
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Nama</label>
              </div>
              <div className="relative">
                <input value={kapasitas} onChange={e=>setKapasitas(e.target.value)} placeholder="Kapasitas" type="number" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Kapasitas</label>
              </div>
              <div className="relative">
                <input value={descriptions} onChange={e=>setDescriptions(e.target.value)} placeholder="Deskripsi" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Deskripsi</label>
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
          <table className="w-full text-sm text-black">
            <thead>
              <tr className="text-left">
                <th className="py-2">Gudang</th>
                <th>Kode</th>
                <th>Nama</th>
                <th>Kapasitas</th>
                <th>Deskripsi</th>
                <th className="w-40">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map(it => (
                <tr key={it.id} className="border-t">
                  <td className="py-2">
                    {it._editing ? (
                      <select value={it._warehouse_id||""} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_warehouse_id:e.target.value}:i))} className="px-2 py-1 rounded border w-full">
                        <option value="">Pilih</option>
                        {warehouses.map(w=> <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                      </select>
                    ) : it.warehouse_id}
                  </td>
                  <td>
                    {it._editing ? (
                      <input value={it._code||""} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_code:e.target.value}:i))} className="px-2 py-1 rounded border w-full" />
                    ) : it.code}
                  </td>
                  <td>
                    {it._editing ? (
                      <input value={it._name||""} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_name:e.target.value}:i))} className="px-2 py-1 rounded border w-full" />
                    ) : it.name}
                  </td>
                  <td>
                    {it._editing ? (
                      <input value={it._kapasitas||"0"} type="number" onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_kapasitas:e.target.value}:i))} className="px-2 py-1 rounded border w-full" />
                    ) : it.kapasitas}
                  </td>
                  <td>
                    {it._editing ? (
                      <input value={it._descriptions||""} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_descriptions:e.target.value}:i))} className="px-2 py-1 rounded border w-full" />
                    ) : it.descriptions}
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
        </div>
      </div>
    </div>
  );
}