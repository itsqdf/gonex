"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Activity = {
  id?: number;
  company_id?: number | null;
  name?: string;
  is_daily?: boolean;
  day_of_week?: number | null;
  description?: string | null;
};

export default function PresensiActivitiesPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Activity[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ name: string; is_daily: boolean; day_of_week: string; description: string }>({ name: "", is_daily: true, day_of_week: "", description: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const load = async () => {
    setLoading(true);
    try {
      const qs = q ? `?day_of_week=${encodeURIComponent(q)}` : "";
      const r = await fetch(`${API_URL}/activities${qs}`, { headers });
      const d = await r.json().catch(() => ({}));
      const items = Array.isArray((d as any).items) ? (d as any).items : Array.isArray(d) ? d : [];
      setList(items);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const createActivity = async () => {
    try {
      const payload = {
        name: form.name,
        is_daily: !!form.is_daily,
        day_of_week: form.day_of_week ? parseInt(form.day_of_week, 10) : null,
        description: form.description || null,
      };
      const r = await fetch(`${API_URL}/activities`, { method: "POST", headers, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || `Gagal membuat aktivitas (${r.status})`);
      setForm({ name: "", is_daily: true, day_of_week: "", description: "" });
      await load();
    } catch (e: any) { alert(e?.message || "Gagal membuat aktivitas"); }
  };

  const updateActivity = async (id: number, patch: Partial<Activity>) => {
    try {
      const r = await fetch(`${API_URL}/activities/${id}`, { method: "PUT", headers, body: JSON.stringify(patch) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || `Gagal mengubah aktivitas (${r.status})`);
      setEditId(null);
      await load();
    } catch (e: any) { alert(e?.message || "Gagal mengubah aktivitas"); }
  };

  const deleteActivity = async (id: number) => {
    if (!confirm("Hapus aktivitas ini?")) return;
    try {
      const r = await fetch(`${API_URL}/activities/${id}`, { method: "DELETE", headers });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || `Gagal menghapus aktivitas (${r.status})`);
      await load();
    } catch (e: any) { alert(e?.message || "Gagal menghapus aktivitas"); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Jadwal & Aktivitas</h2>
          <div className="flex items-center gap-2">
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filter day_of_week (angka 0-6)" className="px-3 py-2 rounded border w-64" />
            <button onClick={load} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow">
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <h3 className="text-black font-medium mb-2">Tambah Aktivitas</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="text-sm text-gray-700">Nama</label>
              <input value={form.name} onChange={e=>setForm(s=>({ ...s, name: e.target.value }))} placeholder="Nama aktivitas" className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Harian</label>
              <select value={form.is_daily ? "1" : "0"} onChange={e=>setForm(s=>({ ...s, is_daily: e.target.value === "1" }))} className="px-3 py-2 rounded border w-full">
                <option value="1">Ya</option>
                <option value="0">Tidak</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-700">Hari (0-6)</label>
              <input value={form.day_of_week} onChange={e=>setForm(s=>({ ...s, day_of_week: e.target.value }))} placeholder="Kosongkan jika harian" className="px-3 py-2 rounded border w-full" />
            </div>
            <div className="md:col-span-4">
              <label className="text-sm text-gray-700">Deskripsi</label>
              <input value={form.description} onChange={e=>setForm(s=>({ ...s, description: e.target.value }))} placeholder="Deskripsi (opsional)" className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <button onClick={createActivity} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow">
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          {loading ? (
            <p className="text-gray-600">Memuat aktivitas...</p>
          ) : list.length === 0 ? (
            <p className="text-gray-600">Belum ada aktivitas.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="py-2 px-2">Nama</th>
                  <th className="py-2 px-2">Harian</th>
                  <th className="py-2 px-2">Hari</th>
                  <th className="py-2 px-2">Deskripsi</th>
                  <th className="py-2 px-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="py-2 px-2">
                      {editId === a.id ? (
                        <input defaultValue={a.name || ""} onBlur={e=>updateActivity(a.id!, { name: e.target.value })} className="px-2 py-1 border rounded w-full" />
                      ) : (
                        a.name || "-"
                      )}
                    </td>
                    <td className="py-2 px-2">{a.is_daily ? "Ya" : "Tidak"}</td>
                    <td className="py-2 px-2">{a.day_of_week ?? "-"}</td>
                    <td className="py-2 px-2">{a.description || "-"}</td>
                    <td className="py-2 px-2">
                      <button onClick={()=>setEditId(a.id!)} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded mr-2">Edit</button>
                      <button onClick={()=>deleteActivity(a.id!)} className="text-xs px-2 py-1 bg-rose-600 text-white rounded">Hapus</button>
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