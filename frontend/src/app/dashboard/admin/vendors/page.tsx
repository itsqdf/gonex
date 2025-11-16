"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Vendor = {
  id: number;
  name: string;
  email?: string | null;
  address?: string | null;
  no_npwp?: string | null;
  domisili?: string | null;
  no_rekening?: string | null;
  note?: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string | null;
};

export default function VendorsPage() {
  const [items, setItems] = useState<Vendor[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(false);

  const headers = useMemo(() => {
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return { Authorization: tok ? `Bearer ${tok}` : "", "x-role": "admin", "Content-Type": "application/json" } as HeadersInit;
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/vendors`, { headers });
      const d = await r.json().catch(() => []);
      if (Array.isArray(d)) setItems(d as Vendor[]);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((x: Vendor) =>
      [x.name, x.email, x.address, x.no_npwp, x.domisili, x.no_rekening, x.note]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(qq))
    );
  }, [items, q]);

  const resetForm = () => setForm({ id: 0, name: "", email: "", address: "", no_npwp: "", domisili: "", no_rekening: "", note: "", active: true });

  const save = async () => {
    if (!form) return;
    if (!String(form.name || '').trim()) {
      await Swal.fire({ icon: 'warning', title: 'Lengkapi data', text: 'Nama vendor/supplier wajib diisi' });
      return;
    }
    const body = JSON.stringify({
      name: form.name,
      email: form.email || null,
      address: form.address || null,
      no_npwp: form.no_npwp || null,
      domisili: form.domisili || null,
      no_rekening: form.no_rekening || null,
      note: form.note || null,
      active: !!form.active,
    });
    const isNew = !form.id;
    const url = isNew ? `${API_URL}/vendors` : `${API_URL}/vendors/${form.id}`;
    const method = isNew ? "POST" : "PUT";
    const r = await fetch(url, { method, headers, body });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { await Swal.fire({ icon: 'error', title: 'Gagal menyimpan', text: d.error || 'Terjadi kesalahan' }); return; }
    setForm(null);
    load();
    await Swal.fire({ icon: 'success', title: 'Tersimpan' });
  };

  const remove = async (id: number) => {
    const ok = await Swal.fire({ icon: 'warning', title: 'Hapus vendor/supplier ini?', showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal' }).then(r=>r.isConfirmed);
    if (!ok) return;
    const r = await fetch(`${API_URL}/vendors/${id}`, { method: "DELETE", headers });
    if (r.ok) {
      setItems(items.filter(i => i.id !== id));
      await Swal.fire({ icon: 'success', title: 'Terhapus' });
    } else {
      const t = await r.text().catch(()=>"Gagal menghapus");
      await Swal.fire({ icon: 'error', title: 'Gagal menghapus', text: t });
    }
  };

  return (
    <div className="p-4 md:p-6 text-black">
      <h1 className="text-lg md:text-xl font-semibold mb-3">Vendor / Supplier</h1>
      <div className="flex gap-2 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari…" className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-black bg-white w-full" />
        <button onClick={resetForm} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow" title="Tambah">Tambah</button>
      </div>

      {form && (
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1"><span>Nama <span className="text-red-600">*</span></span><input value={form.name} onChange={(e)=>setForm({ ...form, name: e.target.value })} className="border px-2 py-1 rounded" /></label>
            <label className="flex flex-col gap-1"><span>Email</span><input value={form.email||""} onChange={(e)=>setForm({ ...form, email: e.target.value })} className="border px-2 py-1 rounded" /></label>
            <label className="flex flex-col gap-1"><span>Alamat</span><input value={form.address||""} onChange={(e)=>setForm({ ...form, address: e.target.value })} className="border px-2 py-1 rounded" /></label>
            <label className="flex flex-col gap-1"><span>No NPWP</span><input value={form.no_npwp||""} onChange={(e)=>setForm({ ...form, no_npwp: e.target.value })} className="border px-2 py-1 rounded" /></label>
            <label className="flex flex-col gap-1"><span>Domisili</span><input value={form.domisili||""} onChange={(e)=>setForm({ ...form, domisili: e.target.value })} className="border px-2 py-1 rounded" /></label>
            <label className="flex flex-col gap-1"><span>No Rekening</span><input value={form.no_rekening||""} onChange={(e)=>setForm({ ...form, no_rekening: e.target.value })} className="border px-2 py-1 rounded" /></label>
            <label className="flex flex-col gap-1 md:col-span-2"><span>Catatan</span><textarea value={form.note||""} onChange={(e)=>setForm({ ...form, note: e.target.value })} className="border px-2 py-1 rounded" /></label>
            <div className="flex items-center gap-2">
              <span>Status Aktif</span>
              <label className="inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={!!form.active} onChange={(e)=>setForm({ ...form, active: e.target.checked })} />
                <div className="w-10 h-5 bg-gray-200 peer-checked:bg-green-400 rounded-full relative transition-colors">
                  <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow" />
                </div>
              </label>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2 pt-2">
            <button type="button" onClick={()=>setForm(null)} className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center justify-center gap-2">
              <span>Batal</span>
            </button>
            <button type="button" onClick={save} className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center justify-center gap-2">
              <span>Simpan</span>
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left">Nama</th>
              <th className="px-2 py-2 text-left">Email</th>
              <th className="px-2 py-2 text-left">Alamat</th>
              <th className="px-2 py-2 text-left">No NPWP</th>
              <th className="px-2 py-2 text-left">Domisili</th>
              <th className="px-2 py-2 text-left">No Rekening</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-2 py-3 text-center">Memuat…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-2 py-3 text-center">Tidak ada data</td></tr>
            )}
            {filtered.map((it: Vendor) => (
              <tr key={it.id} className="border-t">
                <td className="px-2 py-2">{it.name}</td>
                <td className="px-2 py-2">{it.email || '-'}</td>
                <td className="px-2 py-2">{it.address || '-'}</td>
                <td className="px-2 py-2">{it.no_npwp || '-'}</td>
                <td className="px-2 py-2">{it.domisili || '-'}</td>
                <td className="px-2 py-2">{it.no_rekening || '-'}</td>
                <td className="px-2 py-2"><span className={`px-2 py-0.5 rounded text-xs ${it.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{it.active ? 'Aktif' : 'Tidak Aktif'}</span></td>
                <td className="px-2 py-2 flex gap-2">
                  <button className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-600 text-white text-sm" onClick={()=>setForm({ ...it })}>Edit</button>
                  <button className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-600 text-white text-sm" onClick={()=>remove(it.id)}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}