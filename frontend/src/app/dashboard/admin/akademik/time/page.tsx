"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { authHeaders, fetchJson } from "@/lib/helpers";
import { confirmDelete, error, success, warn } from "@/lib/alerts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type TimeSlot = {
  id: number;
  name?: string | null;
  company_id?: number | null;
  company_name?: string | null;
  hari?: string | null; // Senin..Jumat
  start_hour?: string | null; // HH:MM
  end_hour?: string | null; // HH:MM
  break_male_start?: string | null;
  break_male_end?: string | null;
  break_female_start?: string | null;
  break_female_end?: string | null;
  break_mixed_start?: string | null;
  break_mixed_end?: string | null;
};
type Company = { id: number; nama: string };

export default function TimePage() {
  const [list, setList] = useState<TimeSlot[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<Partial<TimeSlot>>({});
  const [showForm, setShowForm] = useState<boolean>(false);
  const [useLunchPreset, setUseLunchPreset] = useState<boolean>(true);
  const [presetStart, setPresetStart] = useState<string>("11:50");
  const [presetEnd, setPresetEnd] = useState<string>("13:00");
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = useMemo(() => ({ ...authHeaders(), "x-role": "admin" }), [token]);

  const loadCompanies = async () => {
    try {
      const r = await fetch(`${API_URL}/companies`, { headers });
      const d = await r.json().catch(() => []);
      if (Array.isArray(d)) setCompanies(d.map((c: any) => ({ id: Number(c.id), nama: String(c.name || c.nama || "") })));
    } catch {}
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<{ items: TimeSlot[] } | TimeSlot[]>("/akademik/time", { headers });
      const arr = Array.isArray((data as any).items) ? (data as any).items : (Array.isArray(data) ? (data as any) : []);
      const filtered = query.trim()
        ? arr.filter((x: TimeSlot) => `${x.name || ''} ${x.company_name || ''} ${x.hari || ''}`.toLowerCase().includes(query.toLowerCase()))
        : arr;
      setList(filtered);
    } catch (e: any) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCompanies();
    load();
  }, []);

  useEffect(() => { load(); }, [query]);

  const save = async () => {
    try {
      if (!form.name) return warn("Validasi", "Nama time slot wajib diisi");
      const payload: any = { ...form };
      if (payload.company_id && !payload.company_name) {
        const comp = companies.find((c) => c.id === payload.company_id);
        if (comp) payload.company_name = comp.nama;
      }
      const res = await fetch(`${API_URL}/akademik/time`, { method: "POST", headers, body: JSON.stringify(payload) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) return error("Gagal", data?.error || "Gagal menyimpan");
      setForm({});
      await load();
      success("Berhasil", "Time slot disimpan");
      setShowForm(false);
    } catch (e: any) {
      error("Gagal", e?.message || "Gagal menyimpan");
    }
  };

  const applyLunchPreset = (checked: boolean) => {
    setUseLunchPreset(checked);
    if (checked) {
      setForm((prev) => ({
        ...prev,
        break_male_start: presetStart,
        break_male_end: presetEnd,
        break_female_start: presetStart,
        break_female_end: presetEnd,
        break_mixed_start: presetStart,
        break_mixed_end: presetEnd,
      }));
    }
  };

  const update = async (id: number, payload: Partial<TimeSlot>) => {
    try {
      const res = await fetch(`${API_URL}/akademik/time/${id}`, { method: "PUT", headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: any) {
      Swal.fire({ icon: "error", title: "Gagal update", text: e?.message || "Error" });
    }
  };

  const remove = async (it: TimeSlot) => {
    const ok = await confirmDelete("Hapus Time Slot?", it.name || undefined, "Ya, hapus");
    if (!ok) return;
    try {
      const r = await fetch(`${API_URL}/akademik/time/${it.id}`, { method: "DELETE", headers });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) return error("Gagal", d?.error || "Tidak bisa dihapus");
      success("Berhasil", "Time slot dihapus");
      await load();
    } catch (e: any) {
      error("Gagal", e?.message || "Tidak bisa dihapus");
    }
  };

  const showDetail = (it: TimeSlot) => {
    const html = `
      <div style="text-align:left">
        <div><strong>Nama</strong>: ${it.name || '-'} </div>
        <div><strong>Perusahaan</strong>: ${it.company_name || '-'} </div>
        <div><strong>Hari</strong>: ${it.hari || '-'} </div>
        <div><strong>Slot</strong>: ${(it.start_hour || '-')} s/d ${(it.end_hour || '-')}</div>
        <hr/>
        <div><strong>Istirahat Laki-Laki</strong>: ${(it.break_male_start || '-')} s/d ${(it.break_male_end || '-')}</div>
        <div><strong>Istirahat Perempuan</strong>: ${(it.break_female_start || '-')} s/d ${(it.break_female_end || '-')}</div>
        <div><strong>Istirahat Gabungan</strong>: ${(it.break_mixed_start || '-')} s/d ${(it.break_mixed_end || '-')}</div>
      </div>`;
    Swal.fire({ title: 'Detail Time Slot', html, width: 600, confirmButtonText: 'Tutup' });
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Akademik - Time</h1>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button onClick={()=> setShowForm(s=> !s)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow">
            <span>{showForm ? "Tutup" : "Tambah"}</span>
          </button>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} className="px-3 py-2 rounded border w-64" placeholder="Cari time slot" />
      </div>

      {showForm && (
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <h3 className="text-black font-medium mb-2">Tambah Time Slot</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent normal-case" placeholder="Nama Slot" />
            <select value={form.company_id || ''} onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value ? Number(e.target.value) : undefined }))} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
              <option value="">Pilih Perusahaan</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.nama}</option>
              ))}
            </select>
            <select value={form.hari || ''} onChange={(e) => setForm((f) => ({ ...f, hari: e.target.value }))} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
              <option value="">Pilih Hari</option>
              <option>Senin</option>
              <option>Selasa</option>
              <option>Rabu</option>
              <option>Kamis</option>
              <option>Jumat</option>
            </select>
            <input value={form.start_hour || ''} onChange={(e) => setForm((f) => ({ ...f, start_hour: e.target.value }))} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full" placeholder="Mulai (HH:MM)" />
            <input value={form.end_hour || ''} onChange={(e) => setForm((f) => ({ ...f, end_hour: e.target.value }))} className="px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full" placeholder="Selesai (HH:MM)" />
          </div>
          <div className="flex items-center gap-2 text-sm mt-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={useLunchPreset} onChange={(e) => applyLunchPreset(e.target.checked)} />
              <span>Gunakan preset istirahat siang seragam</span>
            </label>
            <input type="time" value={presetStart} onChange={(e)=>{ setPresetStart(e.target.value); if (useLunchPreset) applyLunchPreset(true); }} className="px-2 py-1 rounded border" />
            <span>s/d</span>
            <input type="time" value={presetEnd} onChange={(e)=>{ setPresetEnd(e.target.value); if (useLunchPreset) applyLunchPreset(true); }} className="px-2 py-1 rounded border" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div>
              <label className="font-medium text-black">Istirahat Laki-Laki</label>
              <div className="flex gap-2">
                <input value={form.break_male_start || ''} onChange={(e) => setForm((f) => ({ ...f, break_male_start: e.target.value }))} className="px-3 py-2 rounded border w-full" placeholder="Mulai (HH:MM)" />
                <input value={form.break_male_end || ''} onChange={(e) => setForm((f) => ({ ...f, break_male_end: e.target.value }))} className="px-3 py-2 rounded border w-full" placeholder="Selesai (HH:MM)" />
              </div>
            </div>
            <div>
              <label className="font-medium text-black">Istirahat Perempuan</label>
              <div className="flex gap-2">
                <input value={form.break_female_start || ''} onChange={(e) => setForm((f) => ({ ...f, break_female_start: e.target.value }))} className="px-3 py-2 rounded border w-full" placeholder="Mulai (HH:MM)" />
                <input value={form.break_female_end || ''} onChange={(e) => setForm((f) => ({ ...f, break_female_end: e.target.value }))} className="px-3 py-2 rounded border w-full" placeholder="Selesai (HH:MM)" />
              </div>
            </div>
            <div>
              <label className="font-medium text-black">Istirahat Gabungan</label>
              <div className="flex gap-2">
                <input value={form.break_mixed_start || ''} onChange={(e) => setForm((f) => ({ ...f, break_mixed_start: e.target.value }))} className="px-3 py-2 rounded border w-full" placeholder="Mulai (HH:MM)" />
                <input value={form.break_mixed_end || ''} onChange={(e) => setForm((f) => ({ ...f, break_mixed_end: e.target.value }))} className="px-3 py-2 rounded border w-full" placeholder="Selesai (HH:MM)" />
              </div>
            </div>
          </div>
          <div className="bg-gray-50 border rounded p-2 text-sm mt-3">
            <div className="font-medium mb-1">Preview Data</div>
            <div>Nama: {form.name || '-'}</div>
            <div>Perusahaan: {companies.find(c=>c.id===form.company_id)?.nama || '-'}</div>
            <div>Hari: {form.hari || '-'}</div>
            <div>Slot: {(form.start_hour || '-') + ' s/d ' + (form.end_hour || '-')}</div>
            <div>Istirahat Laki-Laki: {(form.break_male_start || '-') + ' s/d ' + (form.break_male_end || '-')}</div>
            <div>Istirahat Perempuan: {(form.break_female_start || '-') + ' s/d ' + (form.break_female_end || '-')}</div>
            <div>Istirahat Gabungan: {(form.break_mixed_start || '-') + ' s/d ' + (form.break_mixed_end || '-')}</div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={save} className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>Simpan</span>
            </button>
            <button onClick={()=>{ setShowForm(false); }} className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Batal</span>
            </button>
          </div>
        </div>
      )}
      <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
        {loading ? (
            <div>Memuat...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Nama</th>
                  <th className="p-2">Perusahaan</th>
                  <th className="p-2">Hari</th>
                  <th className="p-2">Mulai</th>
                  <th className="p-2">Selesai</th>
                  <th className="p-2">Istirahat Laki-Laki</th>
                  <th className="p-2">Istirahat Perempuan</th>
                  <th className="p-2">Istirahat Gabungan</th>
                  <th className="p-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {list.map((it) => (
                  <tr key={it.id} className="border-b">
                    <td className="p-2">
                      <input defaultValue={it.name || ""} onBlur={(e) => update(it.id, { name: e.target.value })} className="border p-1 rounded w-full" />
                    </td>
                    <td className="p-2">{it.company_name || '-'}</td>
                    <td className="p-2">
                      <select defaultValue={it.hari || ''} onChange={(e) => update(it.id, { hari: e.target.value })} className="border p-1 rounded">
                        <option value="">-</option>
                        <option>Senin</option>
                        <option>Selasa</option>
                        <option>Rabu</option>
                        <option>Kamis</option>
                        <option>Jumat</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input defaultValue={it.start_hour || ''} onBlur={(e) => update(it.id, { start_hour: e.target.value })} className="border p-1 rounded w-full" placeholder="HH:MM" />
                    </td>
                    <td className="p-2">
                      <input defaultValue={it.end_hour || ''} onBlur={(e) => update(it.id, { end_hour: e.target.value })} className="border p-1 rounded w-full" placeholder="HH:MM" />
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <input defaultValue={it.break_male_start || ''} onBlur={(e) => update(it.id, { break_male_start: e.target.value })} className="border p-1 rounded w-20" placeholder="Mulai" />
                        <input defaultValue={it.break_male_end || ''} onBlur={(e) => update(it.id, { break_male_end: e.target.value })} className="border p-1 rounded w-20" placeholder="Selesai" />
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <input defaultValue={it.break_female_start || ''} onBlur={(e) => update(it.id, { break_female_start: e.target.value })} className="border p-1 rounded w-20" placeholder="Mulai" />
                        <input defaultValue={it.break_female_end || ''} onBlur={(e) => update(it.id, { break_female_end: e.target.value })} className="border p-1 rounded w-20" placeholder="Selesai" />
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <input defaultValue={it.break_mixed_start || ''} onBlur={(e) => update(it.id, { break_mixed_start: e.target.value })} className="border p-1 rounded w-20" placeholder="Mulai" />
                        <input defaultValue={it.break_mixed_end || ''} onBlur={(e) => update(it.id, { break_mixed_end: e.target.value })} className="border p-1 rounded w-20" placeholder="Selesai" />
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => showDetail(it)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-600 text-white text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"/></svg>
                          <span>Detail</span>
                        </button>
                        <button onClick={() => remove(it)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-600 text-white text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 7h12v2H6V7Zm2 3h8l-.7 8.4a2 2 0 0 1-2 1.6H10.7a2 2 0 0 1-2-1.6L8 10Zm3-5h2a2 2 0 0 1 2 2H9a2 2 0 0 1 2-2Z"/></svg>
                          <span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </div>
    </div>
  );
}