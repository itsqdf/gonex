"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Rekening = {
  id: number;
  kode: string;
  nama: string;
  jenis: "CASH" | "BANK" | "QRIS";
  nomor?: string;
  atas_nama?: string;
  saldo: number;
};

export default function RekeningPage() {
  const [items, setItems] = useState<Rekening[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  // form
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [jenis, setJenis] = useState<"CASH" | "BANK" | "QRIS">("CASH");
  const [nomor, setNomor] = useState("");
  const [atasNama, setAtasNama] = useState("");
  const [saldo, setSaldo] = useState<string>("");

  const token = useMemo(() => (typeof window !== "undefined" ? localStorage.getItem("token") : null), []);

  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/rekening?q=${encodeURIComponent(q)}`, { headers });
      const d = await r.json().catch(()=>({}));
      const arr = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : [];
      const list: Rekening[] = arr.map((x: any) => ({
        id: Number(x.id),
        kode: x.kode || "",
        nama: x.nama || x.bank || "",
        jenis: (x.jenis as any) || "CASH",
        nomor: x.nomor || x.number || undefined,
        atas_nama: x.atas_nama || x.name || undefined,
        saldo: Number(x.saldo || 0),
      }));
      setItems(list);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIdx = (page - 1) * limit;
  const currentItems = items.slice(startIdx, startIdx + limit);
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [items, limit, page, totalPages]);

  const createItem = async () => {
    if (!token) return;
    try {
      // Kirim field lengkap agar backend menyimpan secara kaya
      const payload = {
        kode: kode || undefined,
        nama,
        jenis,
        nomor: nomor || undefined,
        atas_nama: atasNama || undefined,
        saldo: saldo ? Number(saldo) : 0,
      };
      const res = await fetch(`${API_URL}/rekening`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) { return Swal.fire({ title: "Gagal", text: data?.error || "Gagal menyimpan", icon: "error" }); }
      Swal.fire({ title: "Berhasil", text: "Rekening ditambahkan", icon: "success" });
      setKode(""); setNama(""); setJenis("CASH"); setNomor(""); setAtasNama(""); setSaldo("");
      load();
    } catch {}
  };

  const startEdit = (it: Rekening) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: true as any, _kode: it.kode as any, _nama: it.nama as any, _jenis: it.jenis as any, _nomor: it.nomor as any, _atas_nama: it.atas_nama as any, _saldo: String(it.saldo) as any } : i));
  };
  const cancelEdit = (it: Rekening) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: false as any } : i));
  };
  const saveEdit = async (it: any) => {
    if (!token) return;
    try {
      // Kirim field lengkap saat menyimpan
      const payload = {
        kode: it._kode ?? it.kode ?? undefined,
        nama: it._nama ?? it.nama ?? undefined,
        jenis: it._jenis ?? it.jenis ?? undefined,
        nomor: it._nomor ?? it.nomor ?? undefined,
        atas_nama: it._atas_nama ?? it.atas_nama ?? undefined,
        saldo: it._saldo != null ? Number(it._saldo) : it.saldo,
      };
      const res = await fetch(`${API_URL}/rekening/${it.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) { return Swal.fire({ title: "Gagal", text: data?.error || "Gagal menyimpan", icon: "error" }); }
      Swal.fire({ title: "Berhasil", text: "Rekening diperbarui", icon: "success" });
      load();
    } catch {}
  };
  const deleteItem = async (it: Rekening) => {
    if (!token) return;
    const ok = await Swal.fire({ title: "Hapus Rekening?", text: `${it.nama} akan dihapus.`, icon: "warning", showCancelButton: true, confirmButtonText: "Ya, hapus" });
    if (!ok.isConfirmed) return;
    try {
      const res = await fetch(`${API_URL}/rekening/${it.id}`, { method: "DELETE", headers });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) { return Swal.fire({ title: "Gagal", text: data?.error || "Gagal menghapus", icon: "error" }); }
      Swal.fire({ title: "Berhasil", text: "Rekening dihapus", icon: "success" });
      load();
    } catch {}
  };

  const fmtJenis = (j: string) => j === "QRIS" ? "Qris" : j === "BANK" ? "Bank" : "Cash";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Rekening</h2>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowForm(s=>!s)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow">
              <span>➕</span><span>{showForm ? "Tutup" : "Tambah"}</span>
            </button>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari..." className="px-3 py-2 rounded border w-64" />
          </div>
        </div>

        {showForm && (
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <h3 className="text-black font-medium mb-2">Tambah Rekening</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="relative">
              <input value={kode} onChange={e=>setKode(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Kode</label>
            </div>
            <div className="relative">
              <input value={nama} onChange={e=>setNama(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Nama Rekening</label>
            </div>
            <div className="relative">
              <select value={jenis} onChange={e=>setJenis(e.target.value as "CASH" | "BANK" | "QRIS")} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
                <option value="QRIS">Qris</option>
              </select>
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 transition-all">Jenis</label>
            </div>
            <div className="relative">
              <input value={nomor} onChange={e=>setNomor(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 transition-all">Nomor</label>
            </div>
            <div className="relative">
              <input value={atasNama} onChange={e=>setAtasNama(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 transition-all">Atas Nama</label>
            </div>
            <div className="relative">
              <input type="number" step="0.01" value={saldo} onChange={e=>setSaldo(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 transition-all">Saldo Awal</label>
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
                    <th className="px-2 py-1.5">Kode</th>
                    <th className="px-2 py-1.5">Nama</th>
                    <th className="px-2 py-1.5">Jenis</th>
                    <th className="px-2 py-1.5">Nomor</th>
                    <th className="px-2 py-1.5">Atas Nama</th>
                    <th className="px-2 py-1.5">Saldo</th>
                    <th className="px-2 py-1.5">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((it: any) => (
                    <tr key={it.id} className="border-t border-gray-200">
                      <td className="px-2 py-1.5 text-black">
                        {it._editing ? (
                          <input value={it._kode || ""} onChange={e=>setItems(items.map(i => i.id===it.id ? { ...i, _kode: e.target.value } : i))} className="px-2 py-1 rounded border w-28" />
                        ) : (
                          <span>{it.kode}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-black">
                        {it._editing ? (
                          <input value={it._nama || ""} onChange={e=>setItems(items.map(i => i.id===it.id ? { ...i, _nama: e.target.value } : i))} className="px-2 py-1 rounded border w-40" />
                        ) : (
                          <span>{it.nama}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-black">
                        {it._editing ? (
                          <select value={it._jenis || it.jenis} onChange={e=>setItems(items.map(i => i.id===it.id ? { ...i, _jenis: e.target.value } : i))} className="px-2 py-1 rounded border w-32">
                            <option value="CASH">Cash</option>
                            <option value="BANK">Bank</option>
                            <option value="QRIS">Qris</option>
                          </select>
                        ) : (
                          <span>{fmtJenis(it.jenis)}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-black">
                        {it._editing ? (
                          <input value={it._nomor || ""} onChange={e=>setItems(items.map(i => i.id===it.id ? { ...i, _nomor: e.target.value } : i))} className="px-2 py-1 rounded border w-40" />
                        ) : (
                          <span>{it.nomor || "-"}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-black">
                        {it._editing ? (
                          <input value={it._atas_nama || ""} onChange={e=>setItems(items.map(i => i.id===it.id ? { ...i, _atas_nama: e.target.value } : i))} className="px-2 py-1 rounded border w-40" />
                        ) : (
                          <span>{it.atas_nama || "-"}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-black">
                        {it._editing ? (
                          <input type="number" step="0.01" value={it._saldo || "0"} onChange={e=>setItems(items.map(i => i.id===it.id ? { ...i, _saldo: e.target.value } : i))} className="px-2 py-1 rounded border w-28" />
                        ) : (
                          <span>{new Intl.NumberFormat('id-ID',{minimumFractionDigits:2, maximumFractionDigits:2}).format(it.saldo || 0)}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {it._editing ? (
                          <div className="flex items-center gap-2">
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
                          <div className="flex items-center gap-2">
                            <button onClick={()=>startEdit(it)} className="px-2 py-1 rounded bg-green-600 text-white text-xs">✏️ Edit</button>
                            <button onClick={()=>deleteItem(it)} className="px-2 py-1 rounded bg-green-600 text-white text-xs">🗑️ Hapus</button>
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