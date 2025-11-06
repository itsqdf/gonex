"use client";

import { useEffect, useState } from "react";
import { Datepicker } from "flowbite-react";
import FloatingDatepicker from "../../../../components/FloatingDatepicker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

type Asset = { id: number; name: string; code: string };
type Item = {
  id: number;
  asset_id: number;
  asset_name?: string;
  requested_by?: number | null;
  approved_by?: number | null;
  status: "requested" | "approved" | "in_progress" | "done" | "rejected";
  issue_description?: string;
  maintenance_date?: string | null;
  cost?: number;
  note?: string;
  created_at: string;
  updated_at?: string;
  _editing?: boolean;
  _asset_id?: number;
  _requested_by?: string;
  _approved_by?: string;
  _status?: Item["status"];
  _issue_description?: string;
  _maintenance_date?: string;
  _cost?: string;
  _note?: string;
};

export default function MaintenancePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  // pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // form
  const [asset_id, setAssetId] = useState<number | null>(null);
  const [requested_by, setRequestedBy] = useState("");
  const [approved_by, setApprovedBy] = useState("");
  const [status, setStatus] = useState<Item["status"]>("requested");
  const [issue_description, setIssueDescription] = useState("");
  const [maintenance_date, setMaintenanceDate] = useState("");
  const [cost, setCost] = useState("0");
  const [note, setNote] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const loadAssets = async () => {
    try {
      const r = await fetch(`${API_URL}/assets`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      const list = Array.isArray(d.data) ? d.data : [];
      setAssets(list.map((it:any)=>({ id: it.id, name: it.name, code: it.code })));
    } catch (e) {}
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/maintenance?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      const list = Array.isArray(d.data) ? d.data : [];
      setItems(list.map((it: any) => ({
        id: it.id,
        asset_id: it.asset_id,
        asset_name: it.asset_name,
        requested_by: it.requested_by ?? null,
        approved_by: it.approved_by ?? null,
        status: it.status,
        issue_description: it.issue_description,
        maintenance_date: it.maintenance_date,
        cost: typeof it.cost === "number" ? it.cost : parseFloat(it.cost || "0"),
        note: it.note,
        created_at: it.created_at,
        updated_at: it.updated_at,
      })));
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { loadAssets(); }, []);
  useEffect(() => { loadData(); }, [q]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const currentItems = items.slice(start, start + limit);

  const createItem = async () => {
    if (!asset_id) return alert("Asset wajib dipilih");
    const payload: any = {
      asset_id,
      requested_by: requested_by ? Number(requested_by) : null,
      approved_by: approved_by ? Number(approved_by) : null,
      status,
      issue_description,
      maintenance_date: maintenance_date || null,
      cost: parseFloat(cost || "0"),
      note,
    };
    const r = await fetch(`${API_URL}/maintenance`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (r.ok) {
      setAssetId(null); setRequestedBy(""); setApprovedBy(""); setStatus("requested"); setIssueDescription(""); setMaintenanceDate(""); setCost("0"); setNote("");
      loadData();
    } else { const d = await r.json().catch(()=>({})); alert(d.error || "Gagal menyimpan"); }
  };

  const startEdit = (it: Item) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: true, _asset_id: i.asset_id, _requested_by: String(i.requested_by ?? ""), _approved_by: String(i.approved_by ?? ""), _status: i.status, _issue_description: i.issue_description || "", _maintenance_date: i.maintenance_date || "", _cost: String(i.cost ?? 0), _note: i.note || "" } : i));
  };
  const cancelEdit = (it: Item) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: false } : i));
  };
  const saveEdit = async (it: Item) => {
    const payload: any = {
      asset_id: it._asset_id,
      requested_by: it._requested_by ? Number(it._requested_by) : null,
      approved_by: it._approved_by ? Number(it._approved_by) : null,
      status: it._status,
      issue_description: it._issue_description,
      maintenance_date: it._maintenance_date || null,
      cost: parseFloat(it._cost || "0"),
      note: it._note,
    };
    const r = await fetch(`${API_URL}/maintenance/${it.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    if (r.ok) { loadData(); } else { const d = await r.json().catch(()=>({})); alert(d.error || "Gagal menyimpan"); }
  };
  const deleteItem = async (it: Item) => {
    if (!confirm("Hapus maintenance ini?")) return;
    const r = await fetch(`${API_URL}/maintenance/${it.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) { loadData(); } else { const d = await r.json().catch(()=>({})); alert(d.error || "Gagal menghapus"); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Maintenance Asset</h2>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowForm(s=>!s)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-400 hover:bg-green-500 shadow">
              <span>{showForm ? "✖️ Tutup" : "➕ Tambah"}</span>
            </button>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari..." className="px-3 py-2 rounded border w-64" />
          </div>
        </div>

        {showForm && (
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <h3 className="text-black font-medium mb-2">Tambah Maintenance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="relative">
              <select value={asset_id ?? ""} onChange={e=>setAssetId(e.target.value?Number(e.target.value):null)} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
                <option value="">Pilih Asset</option>
                {assets.map(a=> <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Asset</label>
            </div>
            <div className="relative">
              <input value={requested_by} onChange={e=>setRequestedBy(e.target.value)} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Requested By (User ID)</label>
            </div>
            <div className="relative">
              <input value={approved_by} onChange={e=>setApprovedBy(e.target.value)} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Approved By (User ID)</label>
            </div>
            <div className="relative">
              <select value={status} onChange={e=>setStatus(e.target.value as Item["status"])} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
                <option value="requested">requested</option>
                <option value="approved">approved</option>
                <option value="in_progress">in_progress</option>
                <option value="done">done</option>
                <option value="rejected">rejected</option>
              </select>
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Status</label>
            </div>
            <div className="relative md:col-span-2">
              <input value={issue_description} onChange={e=>setIssueDescription(e.target.value)} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Issue</label>
            </div>
            <FloatingDatepicker
              id="maintenance_date"
              label="Tanggal"
              value={maintenance_date ? new Date(maintenance_date) : null}
              onChange={(val: unknown) => {
                const toYMD = (d: Date) => {
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  return `${y}-${m}-${day}`;
                };
                if (!val) { setMaintenanceDate(""); return; }
                if (val instanceof Date && !isNaN(val.getTime())) {
                  setMaintenanceDate(toYMD(val));
                  return;
                }
                if (typeof val === "string") {
                  const d = new Date(val);
                  if (!isNaN(d.getTime())) { setMaintenanceDate(toYMD(d)); }
                  return;
                }
                if (typeof val === "number") {
                  const d = new Date(val);
                  if (!isNaN(d.getTime())) { setMaintenanceDate(toYMD(d)); }
                  return;
                }
              }}
            />
            <div className="relative">
              <input type="number" step="0.01" value={cost} onChange={e=>setCost(e.target.value)} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Biaya</label>
            </div>
            <div className="relative md:col-span-2">
              <input value={note} onChange={e=>setNote(e.target.value)} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Catatan</label>
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
                    <th className="py-2">Asset</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Biaya</th>
                    <th className="py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map(it => (
                    <tr key={it.id} className="border-t border-gray-100">
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <select value={it._asset_id ?? it.asset_id} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _asset_id:Number(e.target.value)}:p))} className="px-2 py-1 rounded border">
                            {assets.map(a=> <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                          </select>
                        ) : (
                          it.asset_name || `#${it.asset_id}`
                        )}
                      </td>
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <select value={it._status || it.status} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _status:e.target.value as Item["status"]}:p))} className="px-2 py-1 rounded border">
                            <option value="requested">requested</option>
                            <option value="approved">approved</option>
                            <option value="in_progress">in_progress</option>
                            <option value="done">done</option>
                            <option value="rejected">rejected</option>
                          </select>
                        ) : (
                          it.status
                        )}
                      </td>
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <input type="number" step="0.01" value={it._cost || String(it.cost ?? 0)} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _cost:e.target.value}:p))} className="px-2 py-1 rounded border" />
                        ) : (
                          (it.cost ?? 0).toLocaleString()
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
                            <button onClick={()=>startEdit(it)} className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1">✏️ <span>Edit</span></button>
                            <button onClick={()=>deleteItem(it)} className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white inline-flex items-center gap-1">🗑️ <span>Hapus</span></button>
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
                  <button onClick={()=>setPage(p=>Math.max(1, p-1))} disabled={page<=1} className="px-3 py-1.5 rounded bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white">Prev</button>
                  <button onClick={()=>setPage(p=>Math.min(totalPages, p+1))} disabled={page>=totalPages} className="px-3 py-1.5 rounded bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white">Next</button>
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