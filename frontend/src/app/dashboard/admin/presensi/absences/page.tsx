"use client";

import { useEffect, useState } from "react";
import { Datepicker, Button } from "flowbite-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Absence = {
  id?: number;
  user_id?: number;
  date?: string;
  reason?: string;
  status?: string;
};

export default function PresensiAbsencesPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Absence[]>([]);
  const [form, setForm] = useState({ date: "", reason: "" });
  const [editing, setEditing] = useState<{ id: number; reason: string; status: string } | null>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/absences`, { headers });
      const d = await r.json().catch(() => ({}));
      const items = Array.isArray((d as any).items) ? (d as any).items : Array.isArray(d) ? d : [];
      setList(items);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const submit = async () => {
    try {
      const r = await fetch(`${API_URL}/absences`, { method: "POST", headers, body: JSON.stringify(form) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `Gagal mengajukan absensi (${r.status})`);
      setForm({ date: "", reason: "" });
      await load();
    } catch (e: any) { alert(e?.message || "Gagal mengajukan absensi"); }
  };

  const startEdit = (a: Absence) => {
    setEditing({ id: a.id!, reason: a.reason || "", status: a.status || "pending" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const r = await fetch(`${API_URL}/absences/${editing.id}`, { method: "PUT", headers, body: JSON.stringify({ reason: editing.reason, status: editing.status }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || `Gagal mengubah absensi (${r.status})`);
      setEditing(null);
      await load();
    } catch (e: any) { alert(e?.message || "Gagal mengubah absensi"); }
  };

  const deleteAbsence = async (id?: number) => {
    if (!id) return;
    if (!confirm("Hapus pengajuan absensi ini?")) return;
    try {
      const r = await fetch(`${API_URL}/absences/${id}`, { method: "DELETE", headers });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || `Gagal menghapus absensi (${r.status})`);
      await load();
    } catch (e: any) { alert(e?.message || "Gagal menghapus absensi"); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Absensi</h2>
          <div className="flex items-center gap-2">
            <Button onClick={load} color="blue" outline size="sm" className="inline-flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 6V3l-4 4 4 4V8c3.309 0 6 2.691 6 6 0 1.271-.398 2.451-1.074 3.418l1.5 1.5A7.958 7.958 0 0 0 20 14c0-4.411-3.589-8-8-8Zm-6 8c0-1.271.398-2.451 1.074-3.418l-1.5-1.5A7.958 7.958 0 0 0 4 14c0 4.411 3.589 8 8 8v3l4-4-4-4v3c-3.309 0-6-2.691-6-6Z"/></svg>
              Refresh
            </Button>
          </div>
        </div>
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <h3 className="text-black font-medium mb-2">Ajukan Absensi</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-sm text-gray-700">Tanggal</label>
          {/* Flowbite Datepicker untuk tanggal absen */}
          <Datepicker
            className="w-full"
            value={form.date ? new Date(form.date) : null}
            onChange={(d) => {
              const toYMD = (dd: Date) => {
                const y = dd.getFullYear();
                const m = String(dd.getMonth() + 1).padStart(2, '0');
                const day = String(dd.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
              };
              let selected: Date | null = null;
              if (d instanceof Date) {
                selected = d;
              } else if (typeof d === 'string') {
                const parsed = new Date(d);
                if (!isNaN(parsed.getTime())) selected = parsed;
              } else if (d && typeof d === 'object' && 'target' in (d as any)) {
                const v = (d as any).target?.value;
                if (typeof v === 'string') {
                  const parsed = new Date(v);
                  if (!isNaN(parsed.getTime())) selected = parsed;
                }
              }
              if (selected) {
                setForm(s => ({ ...s, date: toYMD(selected!) }));
              }
            }}
          />
            </div>
            <div className="md:col-span-2 relative">
              <input value={form.reason} onChange={e=>setForm(s=>({ ...s, reason: e.target.value }))} id="absen_reason" placeholder=" "
                className="peer block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600" />
              <label htmlFor="absen_reason" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-3">Alasan</label>
            </div>
            <div>
              <Button onClick={submit} color="blue" outline size="sm" className="inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M13.293 4.293a1 1 0 0 1 1.414 0l6 6a1 1 0 0 1 0 1.414l-6 6a1 1 0 1 1-1.414-1.414L17.586 12l-4.293-4.293a1 1 0 0 1 0-1.414Z"/><path d="M3 12a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Z"/></svg>
                Kirim
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          {loading ? (
            <p className="text-gray-600">Memuat daftar absensi...</p>
          ) : list.length === 0 ? (
            <p className="text-gray-600">Belum ada pengajuan absensi.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="py-2 px-2">Tanggal</th>
                  <th className="py-2 px-2">Alasan</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 px-2">{a.date || "-"}</td>
                    <td className="py-2 px-2">
                      {(editing && editing.id === a.id) ? (
                        <input value={editing?.reason ?? ""} onChange={e=>setEditing(s=>s ? { ...s, reason: e.target.value } : s)} className="px-2 py-1 border rounded w-full" />
                      ) : (
                        a.reason || "-"
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {(editing && editing.id === a.id) ? (
                        <select value={editing?.status ?? "pending"} onChange={e=>setEditing(s=>s ? { ...s, status: e.target.value } : s)} className="px-2 py-1 border rounded">
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      ) : (
                        a.status || "Menunggu"
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {editing?.id === a.id ? (
                        <>
                          <Button onClick={saveEdit} color="green" outline size="xs" className="mr-2 inline-flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3"><path d="M10 15.172 6.414 11.586 5 13l5 5 9-9-1.414-1.414z"/></svg>
                            Simpan
                          </Button>
                          <Button onClick={()=>setEditing(null)} color="gray" outline size="xs" className="inline-flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3"><path d="M6.225 4.811a1 1 0 0 0-1.414 1.414L10.586 12l-5.775 5.775a1 1 0 0 0 1.414 1.414L12 13.414l5.775 5.775a1 1 0 0 0 1.414-1.414L13.414 12l5.775-5.775a1 1 0 0 0-1.414-1.414L12 10.586 6.225 4.811Z"/></svg>
                            Batal
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button onClick={()=>startEdit(a)} color="purple" outline size="xs" className="mr-2 inline-flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3"><path d="M15.232 5.232a2.5 2.5 0 1 1 3.536 3.536L8.5 19.036l-4 1 1-4z"/></svg>
                            Edit
                          </Button>
                          <Button onClick={()=>deleteAbsence(a.id)} color="red" outline size="xs" className="inline-flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3"><path d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm2 4h2v10h-2V7Z"/></svg>
                            Hapus
                          </Button>
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