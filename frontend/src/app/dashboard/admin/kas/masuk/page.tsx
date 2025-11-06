"use client";

import { useEffect, useState } from "react";
import { fmtRupiah, toInputDateTimeLocal } from "@/lib/helpers";
import Swal from "sweetalert2";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type KasItem = {
  id: number;
  jenis: "MASUK" | "KELUAR";
  tanggal: string; // ISO
  jumlah: number;
  keterangan: string;
  rekening_id?: number | null;
  rekening_nama?: string | null;
};

export default function KasMasukPage() {
  const [items, setItems] = useState<KasItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tanggal, setTanggal] = useState<string>(toInputDateTimeLocal(new Date())); // input datetime-local (lokal)
  const [jumlah, setJumlah] = useState<string>("");
  const [keterangan, setKeterangan] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [rekList, setRekList] = useState<any[]>([]);
  const [rekeningId, setRekeningId] = useState<string>("");
  const [showForm, setShowForm] = useState<boolean>(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const loadData = () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("jenis", "MASUK");
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (q) params.set("q", q);
    fetch(`${API_URL}/kas?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json().catch(()=>({})))
      .then(data => {
        const list: KasItem[] = (data?.data || []).map((d: any) => ({
          id: d.id,
          jenis: d.jenis,
          tanggal: d.tanggal,
          jumlah: d.jumlah,
          keterangan: d.keterangan || "",
          rekening_id: typeof d.rekening_id === 'number' ? d.rekening_id : (d.rekening_id || null),
          rekening_nama: d.rekening_nama || null,
        }));
        setItems(list);
        const m = data.meta || {};
        setTotal(Number(m.total || 0));
        setPages(Number(m.pages || 0));
      })
      .finally(()=>setLoading(false));
  };

  useEffect(()=>{ loadData(); }, []);
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/rekening`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r=>r.json().catch(()=>({})))
      .then(d=>{ if (Array.isArray(d.data)) setRekList(d.data); })
      .catch(()=>{});
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); loadData(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  useEffect(() => { loadData(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [page, limit]);

  const createItem = async () => {
    if (!token) return;
    const iso = new Date(tanggal).toISOString();
    const payload: any = { jenis: "MASUK", tanggal: iso, jumlah: parseFloat(jumlah||"0"), keterangan };
    if (rekeningId) payload.rekening_id = parseInt(rekeningId, 10);
    const res = await fetch(`${API_URL}/kas`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) return Swal.fire({ title: "Gagal", text: data?.error || "Gagal menyimpan", icon: "error" });
    Swal.fire({ title: "Berhasil", text: "Kas Masuk ditambahkan", icon: "success" });
    setJumlah(""); setKeterangan(""); setRekeningId("");
    loadData();
  };

  const startEdit = (it: KasItem) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: true as any, _tanggal: toInputDateTimeLocal(it.tanggal) as any, _jumlah: String(it.jumlah) as any, _keterangan: it.keterangan as any, _rekening_id: (i.rekening_id ?? "") as any } : i));
  };
  const cancelEdit = (it: KasItem) => {
    setItems(items.map(i => i.id===it.id ? { ...i, _editing: false as any } : i));
  };
  const saveEdit = async (it: any) => {
    if (!token) return;
    const body: any = {};
    if (it._tanggal) body.tanggal = new Date(it._tanggal).toISOString();
    if (it._jumlah) body.jumlah = parseFloat(it._jumlah);
    if (typeof it._keterangan !== 'undefined') body.keterangan = it._keterangan;
    if (typeof it._rekening_id !== 'undefined' && it._rekening_id !== '') body.rekening_id = parseInt(String(it._rekening_id), 10);
    const res = await fetch(`${API_URL}/kas/${it.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) return Swal.fire({ title: "Gagal", text: data?.error || "Gagal mengupdate", icon: "error" });
    Swal.fire({ title: "Berhasil", text: "Transaksi diperbarui", icon: "success" });
    loadData();
  };

  const deleteItem = async (it: KasItem) => {
    const ok = await Swal.fire({ title: "Hapus Kas Masuk?", text: `ID ${it.id} akan dihapus.`, icon: "warning", showCancelButton: true, confirmButtonText: "Ya, hapus" });
    if (!ok.isConfirmed || !token) return;
    const res = await fetch(`${API_URL}/kas/${it.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) return Swal.fire({ title: "Gagal", text: data?.error || "Gagal menghapus", icon: "error" });
    Swal.fire({ title: "Berhasil", text: "Kas Masuk dihapus", icon: "success" });
    loadData();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Kas Masuk</h2>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowForm(s=>!s)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow">
              <span>{showForm ? "Tutup" : "Tambah"}</span>
            </button>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ketik untuk mencari" className="px-3 py-2 rounded border w-64" />
            <select value={limit} onChange={e=>{ setLimit(parseInt(e.target.value,10)); setPage(1); }} className="px-3 py-2 rounded border">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {showForm && (
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
            <h3 className="text-black font-medium mb-2">Tambah Kas Masuk</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="relative">
                <input type="datetime-local" value={tanggal} onChange={e=>setTanggal(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent"  />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Tanggal</label>
              </div>
              <div className="relative">
                <select value={rekeningId} onChange={e=>setRekeningId(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
                  <option value="">Pilih Rekening</option>
                  {rekList.map((r:any)=> (
                    <option key={r.id} value={String(r.id)}>{r.nama}</option>
                  ))}
                </select>
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 transition-all">Rekening</label>
              </div>
              <div className="relative">
                <input type="number" step="0.01" value={jumlah} onChange={e=>setJumlah(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent"  />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Jumlah</label>
                <div className="mt-1 text-xs text-gray-500">{fmtRupiah(parseFloat(jumlah||"0"))}</div>
              </div>
              <div className="md:col-span-2 relative">
                <input value={keterangan} onChange={e=>setKeterangan(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent"  />
                <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Keterangan</label>
              </div>
            </div>
            <div className="mt-3">
              <button onClick={createItem} className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center justify-center gap-2">
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
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-black">
                    <th className="py-2">Tanggal</th>
                    <th className="py-2">Rekening</th>
                    <th className="py-2">Jumlah</th>
                    <th className="py-2">Keterangan</th>
                    <th className="py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any) => (
                    <tr key={it.id} className="border-t border-gray-100">
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <input type="datetime-local" value={it._tanggal} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _tanggal:e.target.value}:p))} className="px-2 py-1 rounded border" />
                        ) : (
                          new Date(it.tanggal).toLocaleString()
                        )}
                      </td>
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <select value={it._rekening_id || ''} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _rekening_id:e.target.value}:p))} className="px-2 py-1 rounded border w-40">
                            <option value="">Pilih Rekening</option>
                            {rekList.map((r:any)=>(<option key={r.id} value={String(r.id)}>{r.nama}</option>))}
                          </select>
                        ) : (
                          <span>{it.rekening_nama || '-'}</span>
                        )}
                      </td>
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <input type="number" step="0.01" value={it._jumlah} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _jumlah:e.target.value}:p))} className="px-2 py-1 rounded border w-32" />
                        ) : (
                          fmtRupiah(it.jumlah || 0)
                        )}
                      </td>
                      <td className="py-2 text-black">
                        {it._editing ? (
                          <input value={it._keterangan} onChange={e=>setItems(prev=>prev.map(p=>p.id===it.id?{...p, _keterangan:e.target.value}:p))} className="px-2 py-1 rounded border w-full" />
                        ) : (
                          it.keterangan || "-"
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {!it._editing ? (
                            <button onClick={()=>startEdit(it)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-600 text-white text-sm">Edit</button>
                          ) : (
                            <>
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
                            </>
                          )}
                          <button onClick={()=>deleteItem(it)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-600 text-white text-sm">Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-black">Total: {total} • Halaman: {page}/{Math.max(pages, 1)}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={()=>setPage(p=>Math.max(1,p-1))}
                    disabled={page<=1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 bg-white text-black"
                  >Prev</button>
                  <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded">{page} / {pages || 1}</span>
                  <button
                    onClick={()=>setPage(p=>pages?Math.min(pages,p+1):p+1)}
                    disabled={pages?page>=pages:false}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 bg-white text-black"
                  >Next</button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}