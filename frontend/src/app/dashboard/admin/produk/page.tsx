"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtRupiah } from "@/lib/helpers";
import { BrowserMultiFormatReader } from "@zxing/browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Product = {
  id: number;
  kode: string;
  nama: string;
  harga: number;
  stok: number;
  deskripsi?: string;
  created_at?: string;
  updated_at?: string | null;
};

export default function ProdukPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [q, setQ] = useState<string>("");
  const [showForm, setShowForm] = useState<boolean>(false);
  const [scanActive, setScanActive] = useState<boolean>(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);

  // form state
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [harga, setHarga] = useState<number>(0);
  const [stok, setStok] = useState<number>(0);
  const [deskripsi, setDeskripsi] = useState("");

  // edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editVals, setEditVals] = useState<Partial<Product>>({});

  const canCreate = perms.includes("produk_create") || perms.includes("manage");
  const canEdit = perms.includes("produk_edit") || perms.includes("manage");
  const canDelete = perms.includes("produk_delete") || perms.includes("manage");

  const token = useMemo(() => (typeof window !== "undefined" ? localStorage.getItem("token") : null), []);

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const load = async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const qs = q ? `?q=${encodeURIComponent(q)}` : "";
      const r = await fetch(`${API_URL}/products${qs}`, { headers });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setItems(Array.isArray(d.data) ? d.data : []);
      } else {
        setError(d.error || "Gagal memuat data");
      }
    } catch (e: any) {
      setError(e?.message || "Kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    // permissions
    fetch(`${API_URL}/auth/permissions`, { headers })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.permissions)) setPerms(d.permissions as string[]); })
      .catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Barcode scan setup
  useEffect(() => {
    if (!scanActive) {
      // stop and cleanup via scanner controls
      try { controlsRef.current?.stop?.(); } catch {}
      return;
    }
    (async () => {
      try {
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        setDevices(list);
        const firstId = list[0]?.deviceId || "";
        setSelectedDeviceId(d => d || firstId);
        readerRef.current = new BrowserMultiFormatReader();
        controlsRef.current = await readerRef.current.decodeFromVideoDevice(selectedDeviceId || firstId, videoRef.current!, (res, err) => {
          if (res) {
            const code = res.getText();
            setQ(code);
            setScanActive(false);
            try { controlsRef.current?.stop?.(); } catch {}
          }
        });
      } catch (e) {
        // ignore
      }
    })();
    return () => { try { controlsRef.current?.stop?.(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanActive]);

  const resetForm = () => { setKode(""); setNama(""); setHarga(0); setStok(0); setDeskripsi(""); };

  const createItem = async () => {
    if (!canCreate) return;
    if (!kode || !nama) { setError("Kode dan Nama wajib"); return; }
    try {
      const r = await fetch(`${API_URL}/products`, {
        method: "POST",
        headers,
        body: JSON.stringify({ kode, nama, harga, stok, deskripsi }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Gagal menyimpan"); return; }
      resetForm();
      await load();
    } catch (e: any) { setError(e?.message || "Kesalahan jaringan"); }
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditVals({ ...p });
  };

  const cancelEdit = () => { setEditingId(null); setEditVals({}); };

  const saveEdit = async () => {
    if (!canEdit || !editingId) return;
    const payload: any = {};
    ["kode","nama","harga","stok","deskripsi"].forEach(k => {
      const v = (editVals as any)[k];
      if (v !== undefined && v !== null) payload[k] = v;
    });
    try {
      const r = await fetch(`${API_URL}/products/${editingId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Gagal mengubah"); return; }
      cancelEdit();
      await load();
    } catch (e: any) { setError(e?.message || "Kesalahan jaringan"); }
  };

  const remove = async (id: number) => {
    if (!canDelete) return;
    if (!confirm("Hapus produk ini?")) return;
    try {
      const r = await fetch(`${API_URL}/products/${id}`, { method: "DELETE", headers });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Gagal menghapus"); return; }
      await load();
    } catch (e: any) { setError(e?.message || "Kesalahan jaringan"); }
  };

  const handleExport = () => { const url = `${API_URL}/products/export.csv`; if (typeof window !== "undefined") { window.open(url, "_blank"); } };
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const fd = new FormData(); fd.append("file", file); try { const r = await fetch(`${API_URL}/products/import-csv`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd } as any); await r.json().catch(()=>({})); await load(); } catch {} e.target.value = ""; };
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-black">Produk</h1>
        <div className="flex items-center gap-2">
          {canCreate && (
            <button onClick={() => setShowForm(s => !s)} className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-700/40 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {showForm ? "Tutup" : "Tambah"}
            </button>
          )}
          <button onClick={() => setScanActive(s => !s)} className="px-3 py-2 rounded-md border-2 border-blue-600 text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500">{scanActive ? "Stop Scan" : "Scan Barcode"}</button>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ketik untuk mencari" className="px-3 py-2 rounded border w-64" />
        </div>
      </div>

      {scanActive && (
        <div className="mb-4 rounded border p-3 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm text-gray-600">Kamera:</label>
            <select value={selectedDeviceId} onChange={e=>setSelectedDeviceId(e.target.value)} className="px-2 py-1 rounded border">
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
              ))}
            </select>
          </div>
          <video ref={videoRef} className="w-full max-h-64 bg-black" muted playsInline />
          <p className="text-xs text-gray-500 mt-1">Arahkan barcode ke kamera. Otomatis mengisi pencarian.</p>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Form create */}
      {canCreate && showForm && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-2">
          <div className="relative">
            <input value={kode} onChange={e=>setKode(e.target.value)}  className="peer px-3 py-3 rounded border w-full placeholder-transparent" />
            <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Kode</label>
          </div>
          <div className="relative">
            <input value={nama} onChange={e=>setNama(e.target.value)}  className="peer px-3 py-3 rounded border w-full placeholder-transparent" />
            <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Nama</label>
          </div>
          <div className="relative">
            <input type="number" step="0.01" value={harga} onChange={e=>setHarga(Number(e.target.value))} className="peer px-3 py-3 rounded border w-full placeholder-transparent" />
            <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Harga</label>
            <div className="mt-1 text-xs text-gray-500">{fmtRupiah(Number(harga||0))}</div>
          </div>
          <div className="relative">
            <input type="number" value={stok} onChange={e=>setStok(Number(e.target.value))}  className="peer px-3 py-3 rounded border w-full placeholder-transparent" />
            <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Stok</label>
          </div>
          <div className="relative">
            <input value={deskripsi} onChange={e=>setDeskripsi(e.target.value)}  className="peer px-3 py-3 rounded border w-full placeholder-transparent" />
            <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Deskripsi</label>
          </div>
          <div className="md:col-span-5 flex gap-2 items-center">
             <button onClick={createItem} className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-blue-500 dark:text-blue-500 dark:hover:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-800 inline-flex items-center justify-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
               </svg>
               <span>Simpan</span>
             </button>
            <div className="ml-auto flex gap-2 items-center">
              <input id="csvFile" type="file" accept=".csv" onChange={handleImport} className="hidden" />
              <label htmlFor="csvFile" className="px-3 py-2 rounded border border-gray-300 cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300">Import CSV</label>
              <button onClick={handleExport} className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300">Export CSV</button>
            </div>
          </div>
        </div>
      )}
      <div className="rounded border overflow-x-auto">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-black">Tampil</label>
            {/* limit selector */}
            {/* will be wired below */}
          </div>
          <div className="text-sm text-black">Total: {items.length}</div>
        </div>
        <table className="min-w-full text-sm text-black">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Kode</th>
              <th className="p-2 text-left">Nama</th>
              <th className="p-2 text-right">Harga</th>
              <th className="p-2 text-right">Stok</th>
              <th className="p-2 text-left">Deskripsi</th>
              <th className="p-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={6}>Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="p-3" colSpan={6}>Tidak ada data</td></tr>
            ) : items.slice(((page-1)*limit), ((page-1)*limit)+limit).map(p => (
              <tr key={p.id} className="border-t">
                <td className="p-2">
                  {editingId === p.id && canEdit ? (
                    <input value={editVals.kode as any as string} onChange={e=>setEditVals({...editVals, kode: e.target.value})} className="px-2 py-1 rounded border w-32" />
                  ) : p.kode}
                </td>
                <td className="p-2">
                  {editingId === p.id && canEdit ? (
                    <input value={editVals.nama as any as string} onChange={e=>setEditVals({...editVals, nama: e.target.value})} className="px-2 py-1 rounded border w-40" />
                  ) : p.nama}
                </td>
                <td className="p-2 text-right">
                  {editingId === p.id && canEdit ? (
                    <div className="flex flex-col items-end gap-1">
                      <input type="number" step="0.01" value={Number(editVals.harga ?? p.harga)} onChange={e=>setEditVals({...editVals, harga: Number(e.target.value)})} className="px-2 py-1 rounded border w-28 text-right" />
                      <span className="text-xs text-gray-500">{fmtRupiah(Number(((editVals.harga ?? p.harga) || 0)))}</span>
                    </div>
                  ) : (
                    fmtRupiah(p.harga)
                  )}
                </td>
                <td className="p-2 text-right">
                  {editingId === p.id && canEdit ? (
                    <input type="number" value={Number(editVals.stok ?? p.stok)} onChange={e=>setEditVals({...editVals, stok: Number(e.target.value)})} className="px-2 py-1 rounded border w-20 text-right" />
                  ) : new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(p.stok)}
                </td>
                <td className="p-2">
                  {editingId === p.id && canEdit ? (
                    <input value={(editVals.deskripsi as any as string) ?? ""} onChange={e=>setEditVals({...editVals, deskripsi: e.target.value})} className="px-2 py-1 rounded border w-52" />
                  ) : (p.deskripsi || "-")}
                </td>
                <td className="p-2 text-center">
                  {editingId === p.id ? (
                    <div className="flex gap-2 justify-center">
             <button onClick={saveEdit} className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-blue-500 dark:text-blue-500 dark:hover:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-800 inline-flex items-center justify-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
               </svg>
               <span>Simpan</span>
             </button>
             <button onClick={cancelEdit} className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-red-500 dark:text-red-500 dark:hover:text-white dark:hover:bg-red-600 dark:focus:ring-red-900 inline-flex items-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
               </svg>
               <span>Batal</span>
             </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-center">
                      {canEdit && (<button onClick={()=>startEdit(p)} className="px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-700/40 focus:outline-none focus:ring-2 focus:ring-indigo-400">Edit</button>)}
                      {canDelete && (<button onClick={()=>remove(p.id)} className="px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-500 border border-rose-700/40 focus:outline-none focus:ring-2 focus:ring-rose-400">Hapus</button>)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-black">Tampil</label>
            <select value={limit} onChange={e=>{ setLimit(parseInt(e.target.value,10)); setPage(1); }} className="px-2 py-1 rounded border text-sm">
              {[5,10,20,50].map(n=> (<option key={n} value={n}>{n}</option>))}
            </select>
            <span className="text-black">per halaman</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} className="px-3 py-1.5 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 bg-white text-black">Prev</button>
            <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded">{page} / {Math.max(1, Math.ceil(items.length/limit))}</span>
            <button onClick={()=>setPage(p=>p+1)} disabled={page>=Math.max(1, Math.ceil(items.length/limit))} className="px-3 py-1.5 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 bg-white text-black">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}