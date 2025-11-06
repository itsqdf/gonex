"use client";

import { useEffect, useState } from "react";
import { Datepicker } from "flowbite-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

type Category = { id: number; nama: string };
type Item = {
  id: number;
  category_id?: number | null;
  category_nama?: string;
  name: string;
  code: string;
  description?: string;
  purchase_date?: string;
  value?: number;
  location?: string;
  status: "active" | "maintenance" | "broken" | "disposed";
  need_maintenance: boolean;
  created_at: string;
  updated_at?: string;
  _editing?: boolean;
  _category_id?: number | null;
  _name?: string;
  _code?: string;
  _description?: string;
  _purchase_date?: string;
  _value?: string;
  _location?: string;
  _status?: Item["status"];
  _need_maintenance?: boolean;
};

export default function AssetsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  // pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  // form
  const [category_id, setCategoryId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [purchase_date, setPurchaseDate] = useState("");
  const [value, setValue] = useState("0");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<Item["status"]>("active");
  const [need_maintenance, setNeedMaintenance] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const loadCats = async () => {
    try {
      const r = await fetch(`${API_URL}/category-assets`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      const list = Array.isArray(d.data) ? d.data : [];
      setCats(list.map((it:any)=>({ id: it.id, nama: it.nama })));
    } catch (e) {}
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/assets?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      const list = Array.isArray(d.data) ? d.data : [];
      setItems(list.map((it: any) => ({
        id: it.id,
        category_id: it.category_id ?? null,
        category_nama: it.category_nama,
        name: it.name,
        code: it.code,
        description: it.description,
        purchase_date: it.purchase_date,
        value: typeof it.value === "number" ? it.value : parseFloat(it.value || "0"),
        location: it.location,
        status: it.status,
        need_maintenance: !!it.need_maintenance,
        created_at: it.created_at,
        updated_at: it.updated_at,
      })));
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadCats(); }, []);
  useEffect(() => { loadData(); }, [q]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const currentItems = items.slice(start, start + limit);

  const createItem = async () => {
    if (!name.trim()) return alert("Nama wajib");
    const payload: any = {
      category_id: category_id,
      name, code, description,
      purchase_date: purchase_date || null,
      value: parseFloat(value || "0"),
      location, status, need_maintenance
    };
    const r = await fetch(`${API_URL}/assets`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (r.ok) {
      setCategoryId(null); setName(""); setCode(""); setDescription(""); setPurchaseDate(""); setValue("0"); setLocation(""); setStatus("active"); setNeedMaintenance(false);
      loadData();
    } else { const d = await r.json().catch(()=>({})); alert(d.error || "Gagal menyimpan"); }
  };

  const startEdit = (it: Item) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: true, _category_id: i.category_id ?? null, _name: i.name, _code: i.code, _description: i.description || "", _purchase_date: i.purchase_date || "", _value: String(i.value ?? 0), _location: i.location || "", _status: i.status, _need_maintenance: i.need_maintenance } : i));
  };
  const cancelEdit = (it: Item) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: false } : i));
  };
  const saveEdit = async (it: Item) => {
    const payload: any = {
      category_id: it._category_id,
      name: it._name,
      code: it._code,
      description: it._description,
      purchase_date: it._purchase_date || null,
      value: parseFloat(it._value || "0"),
      location: it._location,
      status: it._status,
      need_maintenance: !!it._need_maintenance,
    };
    const r = await fetch(`${API_URL}/assets/${it.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (r.ok) { loadData(); } else { const d = await r.json().catch(()=>({})); alert(d.error || "Gagal menyimpan"); }
  };
  const deleteItem = async (it: Item) => {
    if (!confirm("Hapus aset ini?")) return;
    const r = await fetch(`${API_URL}/assets/${it.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) { loadData(); } else { const d = await r.json().catch(()=>({})); alert(d.error || "Gagal menghapus"); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Assets</h2>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowForm(s=>!s)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow">
              <span>{showForm ? "✖️ Tutup" : "➕ Tambah"}</span>
            </button>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari..." className="px-3 py-2 rounded border w-64" />
          </div>
        </div>

        {showForm && (
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <h3 className="text-black font-medium mb-2">Tambah Asset</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="relative">
              <select value={category_id ?? ""} onChange={e=>setCategoryId(e.target.value?Number(e.target.value):null)} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
                <option value="">Pilih Category (opsional)</option>
                {cats.map(c=> <option key={c.id} value={c.id}>{c.nama}</option>)}
              </select>
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Category</label>
            </div>
            <div className="relative">
              <input value={name} onChange={e=>setName(e.target.value)} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Nama</label>
            </div>
            <div className="relative">
              <input value={code} onChange={e=>setCode(e.target.value)} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Kode</label>
            </div>
            <div className="relative md:col-span-2">
              <input value={description} onChange={e=>setDescription(e.target.value)} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Deskripsi</label>
            </div>
            <div className="relative">
              {/* Flowbite Datepicker untuk tanggal pembelian */}
              <Datepicker
                className="w-full"
                value={purchase_date ? new Date(purchase_date) : null}
                onChange={(val: unknown) => {
                  const toYMD = (d: Date) => {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}`;
                  };
                  if (!val) { setPurchaseDate(""); return; }
                  if (val instanceof Date && !isNaN(val.getTime())) {
                    setPurchaseDate(toYMD(val));
                    return;
                  }
                  if (typeof val === "string") {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) { setPurchaseDate(toYMD(d)); }
                    return;
                  }
                  if (typeof val === "number") {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) { setPurchaseDate(toYMD(d)); }
                    return;
                  }
                }}
              />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Tanggal Beli</label>
            </div>
            <div className="relative">
              <input type="number" step="0.01" value={value} onChange={e=>setValue(e.target.value)} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Nilai</label>
            </div>
            <div className="relative">
              <input value={location} onChange={e=>setLocation(e.target.value)} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Lokasi</label>
            </div>
            <div className="relative">
              <select value={status} onChange={e=>setStatus(e.target.value as Item["status"])} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
                <option value="active">active</option>
                <option value="maintenance">maintenance</option>
                <option value="broken">broken</option>
                <option value="disposed">disposed</option>
              </select>
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Status</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={need_maintenance} onChange={e=>setNeedMaintenance(e.target.checked)} />
              <span className="text-sm text-black">Perlu Maintenance</span>
            </div>
          </div>
          <div className="mt-3">
             <button onClick={createItem} className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-blue-500 dark:text-blue-500 dark:hover:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-800 inline-flex items-center justify-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
               </svg>
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
                    <th className="py-2">Kode</th>
                    <th className="py-2">Nama</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Nilai</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map(it => (
                    <tr key={it.id} className="border-t border-gray-100">
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <input value={it._code || ""} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _code:e.target.value}:p))} className="px-2 py-1 rounded border" />
                        ) : (
                          it.code
                        )}
                      </td>
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <input value={it._name || ""} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _name:e.target.value}:p))} className="px-2 py-1 rounded border" />
                        ) : (
                          it.name
                        )}
                      </td>
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <select value={it._category_id ?? ""} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _category_id: e.target.value?Number(e.target.value):null}:p))} className="px-2 py-1 rounded border">
                            <option value="">Tidak ada</option>
                            {cats.map(c=> <option key={c.id} value={c.id}>{c.nama}</option>)}
                          </select>
                        ) : (
                          it.category_nama || "-"
                        )}
                      </td>
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <input type="number" step="0.01" value={it._value || "0"} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _value:e.target.value}:p))} className="px-2 py-1 rounded border" />
                        ) : (
                          (it.value ?? 0).toLocaleString()
                        )}
                      </td>
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <select value={it._status || "active"} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _status:e.target.value as Item["status"]}:p))} className="px-2 py-1 rounded border">
                            <option value="active">active</option>
                            <option value="maintenance">maintenance</option>
                            <option value="broken">broken</option>
                            <option value="disposed">disposed</option>
                          </select>
                        ) : (
                          it.status
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
                            <button onClick={()=>startEdit(it)} className="px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white inline-flex items-center gap-1">✏️ <span>Edit</span></button>
                            <button onClick={()=>deleteItem(it)} className="px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white inline-flex items-center gap-1">🗑️ <span>Hapus</span></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between mt-3">
                <div className="text-sm text-black">Total {total} data • Halaman {page} / {totalPages}</div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setPage(p=>Math.max(1, p-1))} disabled={page<=1} className="px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white">Prev</button>
                  <button onClick={()=>setPage(p=>Math.min(totalPages, p+1))} disabled={page>=totalPages} className="px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white">Next</button>
                  <select value={limit} onChange={e=>{ setLimit(Number(e.target.value)); setPage(1); }} className="px-2 py-1 rounded border text-sm text-black">
                    {[5,10,20,50].map(l=> <option key={l} value={l}>{l}/hal</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}