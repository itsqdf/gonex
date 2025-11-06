"use client";

import { useEffect, useState } from "react";

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

export default function PaymentPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Payment[]>([]);
  const [form, setForm] = useState<Payment>({ amount: 0, currency: "IDR", method: "cash", description: "" });
  const [editing, setEditing] = useState<Payment | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/payments`, { headers });
      const d = await r.json().catch(() => ({}));
      const items = Array.isArray((d as any).items) ? (d as any).items : Array.isArray(d) ? d : [];
      setList(items);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const submit = async () => {
    try {
      const r = await fetch(`${API_URL}/payments`, { method: "POST", headers, body: JSON.stringify(form) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || `Gagal membuat transaksi (${r.status})`);
      setForm({ amount: 0, currency: "IDR", method: "cash", description: "" });
      await load();
    } catch (e: any) { alert(e?.message || "Gagal membuat transaksi"); }
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

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <h3 className="text-black font-medium mb-2">Tambah Transaksi</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
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
            <div>
              <label className="text-sm text-gray-700">Keterangan</label>
              <input value={form.description||""} onChange={e=>setForm(s=>({ ...s, description: e.target.value }))} className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <button onClick={submit} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow">
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </div>

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
        </div>
      </div>
    </div>
  );
}