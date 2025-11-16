"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { fetchJson, authHeaders, fmtRupiah, toInputDateTimeLocal, buildQueryParams, PaginatedResponse } from "@/lib/helpers";
import { notifyBell } from "@/lib/alerts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Payment = {
  id?: number;
  user_id?: number;
  amount: number;
  currency: string;
  method: string;
  status?: string;
  description?: string;
};
type Student = { id:number; name:string };

export default function PaymentPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Payment[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [allowed, setAllowed] = useState<boolean>(true);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);
  const [form, setForm] = useState<Payment>({ amount: 0, currency: "IDR", method: "cash", description: "" });
  const [editing, setEditing] = useState<Payment | null>(null);
  const [type, setType] = useState<"spp_bulanan"|"daftar_ulang">("spp_bulanan");
  const [tanggal, setTanggal] = useState<string>(toInputDateTimeLocal(new Date()));
  // siswa
  const [studentId, setStudentId] = useState<number | null>(null);
  const [studentName, setStudentName] = useState<string>("");
  const [bulan, setBulan] = useState<string>("");
  const [tahun, setTahun] = useState<string>(String(new Date().getFullYear()));
  const [students, setStudents] = useState<Student[]>([]);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { ...authHeaders() } as any;

  // Faktur: N/hari/bulan/tahun. Hitung berdasarkan jumlah transaksi berlabel "FAKTUR" pada hari yang sama.
  const formatInvoice = (n:number, d:Date) => `${n}/${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
  const parseInvoice = (desc?:string) => {
    if (!desc) return null;
    const m = desc.match(/FAKTUR\s+(\d+)\/(\d+)\/(\d+)\/(\d{4})/i);
    if (!m) return null;
    return { n: Number(m[1]), day: Number(m[2]), month: Number(m[3]), year: Number(m[4]) };
  };
  const nextInvoiceNo = async (date: Date) => {
    try {
      const qs = buildQueryParams({ limit: 200 });
      const r = await fetch(`${API_URL}/payments?${qs}`, { headers });
      const d = await r.json().catch(()=>({}));
      const items: any[] = Array.isArray((d as any)?.items) ? (d as any).items : Array.isArray((d as any)?.data) ? (d as any).data : Array.isArray(d) ? d : [];
      const day = date.getDate();
      const month = date.getMonth()+1;
      const year = date.getFullYear();
      let maxN = 0;
      for (const it of items) {
        const iv = parseInvoice(String(it.description||''));
        if (iv && iv.day===day && iv.month===month && iv.year===year) {
          if (iv.n > maxN) maxN = iv.n;
        }
      }
      return formatInvoice(maxN + 1, date);
    } catch {
      // fallback: mulai dari 1
      return formatInvoice(1, date);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const qs = buildQueryParams({ page, limit });
      const r = await fetch(`${API_URL}/payments?${qs}`, { headers });
      const d = await r.json().catch(() => ({}));
      const items = Array.isArray((d as any).items) ? (d as any).items : Array.isArray((d as any).data) ? (d as any).data : Array.isArray(d) ? d : [];
      const tot = Number((d as any)?.total || items.length || 0);
      setList(items);
      setTotal(tot);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, limit]);
  useEffect(() => {
    // muat siswa dari backend untuk SPP/daftar ulang
    (async () => {
      try {
        const qs = buildQueryParams({ limit: 200 });
        const r = await fetch(`${API_URL}/akademik/siswa?${qs}`, { headers });
        const d = await r.json().catch(()=>({}));
        const arr = Array.isArray((d as any)?.items) ? (d as any).items : Array.isArray((d as any)?.data) ? (d as any).data : Array.isArray(d) ? d : [];
        setStudents(arr.map((s:any)=>({ id: Number(s.id), name: String(s.name||'') })));
      } catch {}
    })();
  }, []);

  // Permission guard untuk halaman Payment
  useEffect(() => {
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!tok) { setAllowed(false); return; }
    fetch(`${API_URL}/auth/permissions`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.json().catch(()=>({})))
      .then(d => {
        const perms: string[] = Array.isArray(d?.permissions) ? d.permissions : [];
        setAllowed(perms.includes('menu_payment') || perms.includes('manage'));
      })
      .catch(() => setAllowed(false));
  }, []);

  // Penjualan Produk telah dipindahkan ke halaman Payment/Penjualan.

  const submit = async () => {
    try {
      if (type === "spp_bulanan") {
        if (!studentId || !bulan || !form.amount) return Swal.fire({ title: "Validasi", text: "Siswa, bulan, dan jumlah wajib", icon: "warning" });
        const s = students.find(x=>x.id===studentId);
        const faktur = await nextInvoiceNo(new Date(tanggal));
        const ket = `FAKTUR ${faktur} - SPP BULANAN ${s?.name || ''} ${bulan}-${tahun}`;
        const iso = new Date(tanggal).toISOString();
        const rKas = await fetch(`${API_URL}/kas`, { method: "POST", headers, body: JSON.stringify({ jenis: "MASUK", tanggal: iso, jumlah: form.amount, keterangan: ket }) });
        const dKas = await rKas.json().catch(()=>({}));
        if (!rKas.ok) return Swal.fire({ title: "Gagal", text: dKas?.error || "Gagal simpan kas", icon: "error" });
        const rPay = await fetch(`${API_URL}/payments`, { method: "POST", headers, body: JSON.stringify({ amount: form.amount, currency: form.currency, method: form.method, description: ket, invoice_no: faktur }) });
        const dPay = await rPay.json().catch(()=>({}));
        if (!rPay.ok) return Swal.fire({ title: "Gagal", text: dPay?.error || "Gagal catat payment", icon: "error" });
        setForm({ amount: 0, currency: "IDR", method: form.method, description: "" }); setStudentId(null); setStudentName(""); setBulan("");
        await load();
        notifyBell("SPP Bulanan", `Pembayaran ${s?.name || ''} sukses (${fmtRupiah(form.amount)})`);
        return;
      }
      if (type === "daftar_ulang") {
        if (!studentId || !form.amount) return Swal.fire({ title: "Validasi", text: "Siswa dan jumlah wajib", icon: "warning" });
        const s = students.find(x=>x.id===studentId);
        const faktur = await nextInvoiceNo(new Date(tanggal));
        const ket = `FAKTUR ${faktur} - DAFTAR ULANG ${s?.name || ''} ${tahun}`;
        const iso = new Date(tanggal).toISOString();
        const rKas = await fetch(`${API_URL}/kas`, { method: "POST", headers, body: JSON.stringify({ jenis: "MASUK", tanggal: iso, jumlah: form.amount, keterangan: ket }) });
        const dKas = await rKas.json().catch(()=>({}));
        if (!rKas.ok) return Swal.fire({ title: "Gagal", text: dKas?.error || "Gagal simpan kas", icon: "error" });
        const rPay = await fetch(`${API_URL}/payments`, { method: "POST", headers, body: JSON.stringify({ amount: form.amount, currency: form.currency, method: form.method, description: ket, invoice_no: faktur }) });
        const dPay = await rPay.json().catch(()=>({}));
        if (!rPay.ok) return Swal.fire({ title: "Gagal", text: dPay?.error || "Gagal catat payment", icon: "error" });
        setForm({ amount: 0, currency: "IDR", method: form.method, description: "" }); setStudentId(null); setStudentName("");
        await load();
        notifyBell("Daftar Ulang", `Pembayaran ${s?.name || ''} sukses (${fmtRupiah(form.amount)})`);
        return;
      }
    } catch (e: any) { Swal.fire({ title: "Gagal", text: e?.message || "Kesalahan", icon: "error" }); }
  };

  const saveEdit = async () => {
    if (!editing?.id) return;
    try {
      const r = await fetch(`${API_URL}/payments/${editing.id}`, { method: "PUT", headers, body: JSON.stringify(editing) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || `Gagal update transaksi (${r.status})`);
      setEditing(null);
      await load();
    } catch (e: any) { alert(e?.message || "Gagal update transaksi"); }
  };

  const remove = async (id?: number) => {
    if (!id) return;
    if (!confirm("Hapus transaksi ini?")) return;
    try {
      const r = await fetch(`${API_URL}/payments/${id}`, { method: "DELETE", headers });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || `Gagal menghapus transaksi (${r.status})`);
      await load();
    } catch (e: any) { alert(e?.message || "Gagal menghapus transaksi"); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Transaksi Pembayaran</h2>
          <div className="flex items-center gap-2">
            <button onClick={load} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow">
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {!allowed && (
          <div className="rounded-xl border bg-white p-4 text-black mb-4">Anda tidak memiliki izin untuk melihat halaman ini.</div>
        )}

        {allowed && (
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <h3 className="text-black font-medium mb-2">Tambah Transaksi</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="text-sm text-gray-700">Jenis</label>
                <select value={type} onChange={e=>setType(e.target.value as any)} className="px-3 py-2 rounded border w-full">
                  <option value="spp_bulanan">SPP Bulanan</option>
                  <option value="daftar_ulang">Daftar Ulang</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700">Tanggal</label>
                <input type="datetime-local" value={tanggal} onChange={e=>setTanggal(e.target.value)} className="px-3 py-2 rounded border w-full" />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-700">Jumlah</label>
              <input type="number" value={form.amount} onChange={e=>setForm(s=>({ ...s, amount: Number(e.target.value) }))} className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Mata Uang</label>
              <input value={form.currency} onChange={e=>setForm(s=>({ ...s, currency: e.target.value }))} className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Metode</label>
              <input value={form.method} onChange={e=>setForm(s=>({ ...s, method: e.target.value }))} className="px-3 py-2 rounded border w-full" />
            </div>
            {/* Penjualan Produk dipindahkan ke halaman Payment/Penjualan */}
            {(type === "spp_bulanan" || type === "daftar_ulang") && (
              <>
                <div className="md:col-span-2">
                  <label className="text-sm text-gray-700">Siswa</label>
                  <select value={studentId||''} onChange={e=>{ const id = e.target.value? Number(e.target.value): null; setStudentId(id); const s = students.find(x=>x.id===id); setStudentName(s?.name || ''); }} className="px-3 py-2 rounded border w-full">
                    <option value="">Pilih Siswa</option>
                    {students.map(s=> (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
                {type === "spp_bulanan" && (
                  <>
                    <div>
                      <label className="text-sm text-gray-700">Bulan</label>
                      <select value={bulan} onChange={e=>setBulan(e.target.value)} className="px-3 py-2 rounded border w-full">
                        {['01','02','03','04','05','06','07','08','09','10','11','12'].map(b=> (<option key={b} value={b}>{b}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-700">Tahun</label>
                      <input value={tahun} onChange={e=>setTahun(e.target.value)} className="px-3 py-2 rounded border w-full" />
                    </div>
                  </>
                )}
              </>
            )}
            <div>
              <button onClick={submit} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow">
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </div>
        )}

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          {loading ? (
            <p className="text-gray-600">Memuat daftar transaksi...</p>
          ) : list.length === 0 ? (
            <p className="text-gray-600">Belum ada transaksi.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="py-2 px-2">Jumlah</th>
                  <th className="py-2 px-2">Mata Uang</th>
                  <th className="py-2 px-2">Metode</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2">Keterangan</th>
                  <th className="py-2 px-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 px-2">{p.amount?.toFixed?.(2) || p.amount}</td>
                    <td className="py-2 px-2">{p.currency}</td>
                    <td className="py-2 px-2">{p.method}</td>
                    <td className="py-2 px-2">
                      {(editing && editing.id === p.id) ? (
                        <select value={editing?.status ?? "pending"} onChange={e=>setEditing(s=>s?{...s,status:e.target.value}:s)} className="px-2 py-1 border rounded">
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                          <option value="failed">Failed</option>
                        </select>
                      ) : (
                        p.status || "pending"
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {(editing && editing.id === p.id) ? (
                        <input value={editing?.description ?? ""} onChange={e=>setEditing(s=>s?{...s,description:e.target.value}:s)} className="px-2 py-1 border rounded w-full" />
                      ) : (
                        p.description || "-"
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {(editing && editing.id === p.id) ? (
                        <>
                          <button onClick={saveEdit} className="text-xs px-2 py-1 bg-green-600 text-white rounded mr-2">Simpan</button>
                          <button onClick={()=>setEditing(null)} className="text-xs px-2 py-1 bg-gray-300 text-black rounded">Batal</button>
                        </>
                      ) : (
                        <>
                          <button onClick={()=>setEditing(p)} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded mr-2">Edit</button>
                          <button onClick={()=>remove(p.id)} className="text-xs px-2 py-1 bg-rose-600 text-white rounded">Hapus</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1.5 rounded border bg-white disabled:opacity-50">Prev</button>
              <span className="text-sm text-black">Halaman {page} dari {totalPages}</span>
              <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1.5 rounded border bg-white disabled:opacity-50">Next</button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Limit</label>
              <select value={limit} onChange={e=>{ setPage(1); setLimit(Number(e.target.value)); }} className="px-2 py-1 border rounded">
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}