"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type RackPosition = {
  id: number;
  rack_id: number;
  code: string;
  name: string;
  baris: number;
  posisi: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
  _editing?: boolean;
  _rack_id?: string;
  _code?: string;
  _name?: string;
  _baris?: string;
  _posisi?: string;
  _is_active?: string; // "true" | "false"
};

type Rack = { id: number; code: string; name: string };

export default function PosisiRakPage() {
  const [items, setItems] = useState<RackPosition[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [rackId, setRackId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [baris, setBaris] = useState("0");
  const [posisi, setPosisi] = useState("0");
  const [isActive, setIsActive] = useState("true");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const tok = localStorage.getItem("token");
    fetch(`${API_URL}/racks`, { headers: { Authorization: `Bearer ${tok}` }})
      .then(r => r.json())
      .then(d => setRacks(Array.isArray(d.racks) ? d.racks.map((it:any)=>({ id: it.id, code: it.code, name: it.name })) : []))
      .catch(()=>{});
  }, []);

  useEffect(() => {
    const tok = localStorage.getItem("token");
    fetch(`${API_URL}/rack-positions${q?`?q=${encodeURIComponent(q)}`:""}`, { headers: { Authorization: `Bearer ${tok}` }})
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d.rack_positions) ? d.rack_positions : []))
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
    const payload:any = { rack_id: Number(rackId), code, name, baris: Number(baris||"0"), posisi: Number(posisi||"0"), is_active: isActive === "true" };
    const r = await fetch(`${API_URL}/rack-positions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(payload) });
    if (r.ok) { setShowForm(false); setRackId(""); setCode(""); setName(""); setBaris("0"); setPosisi("0"); setIsActive("true"); setQ(q=>q); }
  };

  const startEdit = (it: RackPosition) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: true, _rack_id: String(it.rack_id), _code: it.code, _name: it.name, _baris: String(it.baris), _posisi: String(it.posisi), _is_active: it.is_active ? "true" : "false" } : i));
  };
  const saveEdit = async (it: RackPosition) => {
    const tok = localStorage.getItem("token");
    const payload:any = {};
    if (it._rack_id !== undefined) payload.rack_id = Number(it._rack_id);
    if (it._code !== undefined) payload.code = it._code;
    if (it._name !== undefined) payload.name = it._name;
    if (it._baris !== undefined) payload.baris = Number(it._baris||"0");
    if (it._posisi !== undefined) payload.posisi = Number(it._posisi||"0");
    if (it._is_active !== undefined) payload.is_active = it._is_active === "true";
    const r = await fetch(`${API_URL}/rack-positions/${it.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(payload) });
    if (r.ok) setItems(items.map(i=>i.id===it.id?{...i, rack_id: Number(it._rack_id||i.rack_id), code: it._code || i.code, name: it._name || i.name, baris: Number(it._baris||String(i.baris)), posisi: Number(it._posisi||String(i.posisi)), is_active: (it._is_active||String(i.is_active)) === "true", _editing: false }:i));
  };

  const remove = async (id: number) => {
    if (!confirm("Hapus posisi rak ini?")) return;
    const tok = localStorage.getItem("token");
    const r = await fetch(`${API_URL}/rack-positions/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${tok}` } });
    if (r.ok) setItems(items.filter(i => i.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Posisi Rak</h2>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowForm(s=>!s)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow"><span>➕</span><span>{showForm?"Tutup":"Tambah"}</span></button>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ketik untuk mencari" className="px-3 py-2 rounded border w-64" />
          </div>
        </div>

        {showForm && (
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
            <h3 className="text-black font-medium mb-2">Tambah Posisi Rak</h3>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <div className="relative">
                <select value={rackId} onChange={e=>setRackId(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
                  <option value="">Pilih Rak</option>
                  {racks.map(r=> <option key={r.id} value={String(r.id)}>{r.code} - {r.name}</option>)}
                </select>
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Rak</label>
              </div>
              <div className="relative">
                <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Kode" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Kode</label>
              </div>
              <div className="relative">
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nama" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Nama</label>
              </div>
              <div className="relative">
                <input value={baris} onChange={e=>setBaris(e.target.value)} placeholder="Baris" type="number" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Baris</label>
              </div>
              <div className="relative">
                <input value={posisi} onChange={e=>setPosisi(e.target.value)} placeholder="Posisi" type="number" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Posisi</label>
              </div>
              <div className="relative">
                <select value={isActive} onChange={e=>setIsActive(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Status</label>
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
                <th className="py-2">Rak</th>
                <th>Kode</th>
                <th>Nama</th>
                <th>Baris</th>
                <th>Posisi</th>
                <th>Status</th>
                <th className="w-40">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map(it => (
                <tr key={it.id} className="border-t">
                  <td className="py-2">
                    {it._editing ? (
                      <select value={it._rack_id||""} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_rack_id:e.target.value}:i))} className="px-2 py-1 rounded border w-full">
                        <option value="">Pilih</option>
                        {racks.map(r=> <option key={r.id} value={String(r.id)}>{r.code} - {r.name}</option>)}
                      </select>
                    ) : it.rack_id}
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
                      <input value={it._baris||"0"} type="number" onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_baris:e.target.value}:i))} className="px-2 py-1 rounded border w-full" />
                    ) : it.baris}
                  </td>
                  <td>
                    {it._editing ? (
                      <input value={it._posisi||"0"} type="number" onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_posisi:e.target.value}:i))} className="px-2 py-1 rounded border w-full" />
                    ) : it.posisi}
                  </td>
                  <td>
                    {it._editing ? (
                      <select value={it._is_active||"true"} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_is_active:e.target.value}:i))} className="px-2 py-1 rounded border w-full">
                        <option value="true">Aktif</option>
                        <option value="false">Nonaktif</option>
                      </select>
                    ) : (it.is_active ? "Aktif" : "Nonaktif")}
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
                        <button onClick={()=>startEdit(it)} className="px-2 py-1 rounded bg-green-600 text-white">✏️ Edit</button>
                        <button onClick={()=>remove(it.id)} className="px-2 py-1 rounded bg-green-600 text-white">🗑️ Hapus</button>
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
      </div>
    </div>
  );
}