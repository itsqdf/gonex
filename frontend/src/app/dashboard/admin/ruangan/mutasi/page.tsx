"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Mutasi = {
  id: number;
  code: string;
  date: string; // ISO
  approved_time?: string | null;
  location_awal: string;
  pindah_location: string;
  description: string;
  status: string; // draft | pending | approved | rejected
  created_by?: number | null;
  approved_by?: number | null;
  created_at: string;
  updated_at?: string | null;
  _editing?: boolean;
  _code?: string;
  _date?: string;
  _approved_time?: string;
  _location_awal?: string;
  _pindah_location?: string;
  _description?: string;
  _status?: string;
};

export default function MutasiBarangPage() {
  const [items, setItems] = useState<Mutasi[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [date, setDate] = useState("");
  const [locationAwal, setLocationAwal] = useState("");
  const [pindahLocation, setPindahLocation] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const tok = localStorage.getItem("token");
    fetch(`${API_URL}/mutasi-barang${q?`?q=${encodeURIComponent(q)}`:""}`, { headers: { Authorization: `Bearer ${tok}` }})
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d.mutasi) ? d.mutasi : []))
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
    if (!date) { alert("Tanggal wajib"); return; }
    const tok = localStorage.getItem("token");
    const payload:any = { code, date: new Date(date).toISOString(), location_awal: locationAwal, pindah_location: pindahLocation, description, status };
    const r = await fetch(`${API_URL}/mutasi-barang`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(payload) });
    if (r.ok) { setShowForm(false); setCode(""); setDate(""); setLocationAwal(""); setPindahLocation(""); setDescription(""); setStatus("draft"); setQ(q=>q); }
  };

  const startEdit = (it: Mutasi) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: true, _code: it.code, _date: it.date ? new Date(it.date).toISOString().slice(0,16) : "", _approved_time: it.approved_time ? new Date(it.approved_time).toISOString().slice(0,16) : "", _location_awal: it.location_awal, _pindah_location: it.pindah_location, _description: it.description, _status: it.status } : i));
  };
  const saveEdit = async (it: Mutasi) => {
    const tok = localStorage.getItem("token");
    const payload:any = {};
    if (it._code !== undefined) payload.code = it._code;
    if (it._date !== undefined && it._date) payload.date = new Date(it._date).toISOString();
    if (it._approved_time !== undefined) payload.approved_time = it._approved_time ? new Date(it._approved_time).toISOString() : "";
    if (it._location_awal !== undefined) payload.location_awal = it._location_awal;
    if (it._pindah_location !== undefined) payload.pindah_location = it._pindah_location;
    if (it._description !== undefined) payload.description = it._description;
    if (it._status !== undefined) payload.status = it._status;
    const r = await fetch(`${API_URL}/mutasi-barang/${it.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify(payload) });
    if (r.ok) setItems(items.map(i=>i.id===it.id?{...i, code: it._code || i.code, date: it._date ? new Date(it._date).toISOString() : i.date, approved_time: it._approved_time ? new Date(it._approved_time).toISOString() : null, location_awal: it._location_awal || i.location_awal, pindah_location: it._pindah_location || i.pindah_location, description: it._description || i.description, status: it._status || i.status, _editing: false }:i));
  };

  const remove = async (id: number) => {
    if (!confirm("Hapus mutasi barang ini?")) return;
    const tok = localStorage.getItem("token");
    const r = await fetch(`${API_URL}/mutasi-barang/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${tok}` } });
    if (r.ok) setItems(items.filter(i => i.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Mutasi Barang</h2>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowForm(s=>!s)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-400 hover:bg-green-500 shadow"><span>➕</span><span>{showForm?"Tutup":"Tambah"}</span></button>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ketik untuk mencari" className="px-3 py-2 rounded border w-64" />
          </div>
        </div>

        {showForm && (
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
            <h3 className="text-black font-medium mb-2">Tambah Mutasi</h3>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <div className="relative">
                <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Kode (otomatis jika kosong)" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Kode</label>
              </div>
              <div className="relative">
                <input value={date} onChange={e=>setDate(e.target.value)} placeholder="Tanggal" type="datetime-local" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Tanggal</label>
              </div>
              <div className="relative">
                <input value={locationAwal} onChange={e=>setLocationAwal(e.target.value)} placeholder="Lokasi Awal" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Lokasi Awal</label>
              </div>
              <div className="relative">
                <input value={pindahLocation} onChange={e=>setPindahLocation(e.target.value)} placeholder="Lokasi Pindah" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Lokasi Pindah</label>
              </div>
              <div className="relative md:col-span-2">
                <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Deskripsi" className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Deskripsi</label>
              </div>
              <div className="relative">
                <select value={status} onChange={e=>setStatus(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
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
                <th className="py-2">Kode</th>
                <th>Tanggal</th>
                <th>Lokasi Awal</th>
                <th>Pindah Ke</th>
                <th>Status</th>
                <th className="w-40">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map(it => (
                <tr key={it.id} className="border-t">
                  <td className="py-2">
                    {it._editing ? (
                      <input value={it._code||""} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_code:e.target.value}:i))} className="px-2 py-1 rounded border w-full" />
                    ) : it.code}
                  </td>
                  <td>
                    {it._editing ? (
                      <input value={it._date||""} type="datetime-local" onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_date:e.target.value}:i))} className="px-2 py-1 rounded border w-full" />
                    ) : new Date(it.date).toLocaleString()}
                  </td>
                  <td>
                    {it._editing ? (
                      <input value={it._location_awal||""} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_location_awal:e.target.value}:i))} className="px-2 py-1 rounded border w-full" />
                    ) : it.location_awal}
                  </td>
                  <td>
                    {it._editing ? (
                      <input value={it._pindah_location||""} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_pindah_location:e.target.value}:i))} className="px-2 py-1 rounded border w-full" />
                    ) : it.pindah_location}
                  </td>
                  <td>
                    {it._editing ? (
                      <select value={it._status||"draft"} onChange={e=>setItems(items.map(i=>i.id===it.id?{...i,_status:e.target.value}:i))} className="px-2 py-1 rounded border w-full">
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    ) : it.status}
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