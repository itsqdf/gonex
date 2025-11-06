"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Settings = {
  id?: number;
  company_id?: number;
  mon_enabled?: boolean;
  tue_enabled?: boolean;
  wed_enabled?: boolean;
  thu_enabled?: boolean;
  fri_enabled?: boolean;
  sat_enabled?: boolean;
  sun_enabled?: boolean;
  allow_free_checkin?: boolean;
  default_check_in?: string | null;
  default_check_out?: string | null;
};

export default function PresensiSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<number>(1);
  const [form, setForm] = useState<Settings>({
    mon_enabled: true,
    tue_enabled: true,
    wed_enabled: true,
    thu_enabled: true,
    fri_enabled: true,
    sat_enabled: false,
    sun_enabled: false,
    allow_free_checkin: false,
    default_check_in: "09:00",
    default_check_out: "17:00",
  });
  const [locations, setLocations] = useState<any[]>([]);
  const [locForm, setLocForm] = useState<{name:string; latitude:string; longitude:string; radius_m:string}>({ name: "", latitude: "", longitude: "", radius_m: "50" });

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch(`${API_URL}/settings/company/${companyId}`, { headers });
      const ct = r.headers.get("content-type") || "";
      const d = ct.includes("application/json") ? await r.json().catch(() => ({})) : {};
      if (!r.ok) throw new Error((d as any)?.error || `Gagal memuat settings (${r.status})`);
      const data = (d as any).data || d;
      setForm({
        mon_enabled: !!data.mon,
        tue_enabled: !!data.tue,
        wed_enabled: !!data.wed,
        thu_enabled: !!data.thu,
        fri_enabled: !!data.fri,
        sat_enabled: !!data.sat,
        sun_enabled: !!data.sun,
        allow_free_checkin: !!data.allow_free_checkin,
        default_check_in: data.default_check_in || "",
        default_check_out: data.default_check_out || "",
      });
    } catch (e: any) {
      setMsg(e?.message || "Gagal memuat settings");
    } finally { setLoading(false); }
  };

  const loadLocations = async () => {
    try {
      const r = await fetch(`${API_URL}/settings/locations?company_id=${companyId}`, { headers });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setLocations(d.items || []);
    } catch {}
  };

  useEffect(() => { load(); loadLocations(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [companyId]);

  const save = async () => {
    setMsg(null);
    try {
      const payload = {
        mon: !!form.mon_enabled,
        tue: !!form.tue_enabled,
        wed: !!form.wed_enabled,
        thu: !!form.thu_enabled,
        fri: !!form.fri_enabled,
        sat: !!form.sat_enabled,
        sun: !!form.sun_enabled,
        allow_free_checkin: !!form.allow_free_checkin,
        default_check_in: form.default_check_in || null,
        default_check_out: form.default_check_out || null,
      };
      const r = await fetch(`${API_URL}/settings/company/${companyId}`, { method: "PUT", headers, body: JSON.stringify(payload) });
      const ct = r.headers.get("content-type") || "";
      const d = ct.includes("application/json") ? await r.json().catch(() => ({})) : {};
      if (!r.ok) throw new Error((d as any)?.error || `Gagal menyimpan settings (${r.status})`);
      setMsg("Berhasil menyimpan pengaturan presensi");
      await Promise.all([load(), loadLocations()]);
    } catch (e: any) {
      setMsg(e?.message || "Gagal menyimpan pengaturan");
    }
  };

  const addLocation = async () => {
    setMsg(null);
    try {
      const payload = {
        company_id: companyId,
        name: locForm.name,
        latitude: parseFloat(locForm.latitude),
        longitude: parseFloat(locForm.longitude),
        radius_m: parseInt(locForm.radius_m || "50", 10)
      };
      const r = await fetch(`${API_URL}/settings/locations`, { method: "POST", headers, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `Gagal menambah lokasi (${r.status})`);
      setLocForm({ name: "", latitude: "", longitude: "", radius_m: "50" });
      await loadLocations();
      setMsg("Lokasi ditambahkan");
    } catch (e: any) {
      setMsg(e?.message || "Gagal menambah lokasi");
    }
  };

  const toggleActive = async (id: number, active: boolean) => {
    try {
      const r = await fetch(`${API_URL}/settings/locations/${id}`, { method: "PATCH", headers, body: JSON.stringify({ active }) });
      if (r.ok) await loadLocations();
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Setting Presensi</h2>
          <div className="flex items-center gap-2">
            <input type="number" value={companyId} onChange={e=>setCompanyId(parseInt(e.target.value||"1",10))} className="px-3 py-2 rounded border w-28" placeholder="Company ID" />
            <button onClick={load} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow">
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {msg && (
          <div className="mb-3 rounded-lg bg-white/80 backdrop-blur border border-white/60 p-3 text-sm text-black shadow">{msg}</div>
        )}

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          {loading ? (
            <p className="text-gray-600">Memuat pengaturan...</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-black font-medium mb-2">Hari Aktif</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {([
                    ["Sen", "mon_enabled"],
                    ["Sel", "tue_enabled"],
                    ["Rab", "wed_enabled"],
                    ["Kam", "thu_enabled"],
                    ["Jum", "fri_enabled"],
                    ["Sab", "sat_enabled"],
                    ["Min", "sun_enabled"],
                  ] as const).map(([label, key]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={(form as any)[key] || false} onChange={e=>setForm(s=>({ ...s, [key]: e.target.checked }))} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Default Check-in</label>
                  <input value={form.default_check_in || ""} onChange={e=>setForm(s=>({ ...s, default_check_in: e.target.value }))} placeholder="HH:MM" className="px-3 py-2 rounded border w-full" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Default Check-out</label>
                  <input value={form.default_check_out || ""} onChange={e=>setForm(s=>({ ...s, default_check_out: e.target.value }))} placeholder="HH:MM" className="px-3 py-2 rounded border w-full" />
                </div>
              </div>

              <div className="mt-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!form.allow_free_checkin} onChange={e=>setForm(s=>({ ...s, allow_free_checkin: e.target.checked }))} />
                  <span>Bebas presensi (rekam lokasi saja)</span>
                </label>
              </div>

              <div>
                <button onClick={save} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow">
                  <span>Simpan</span>
                </button>
              </div>

              <div className="pt-4 border-t mt-4">
                <p className="text-black font-medium mb-2">Lokasi Presensi</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
                  <input value={locForm.name} onChange={e=>setLocForm(s=>({ ...s, name: e.target.value }))} placeholder="Nama lokasi" className="px-3 py-2 rounded border w-full" />
                  <input value={locForm.latitude} onChange={e=>setLocForm(s=>({ ...s, latitude: e.target.value }))} placeholder="Latitude" className="px-3 py-2 rounded border w-full" />
                  <input value={locForm.longitude} onChange={e=>setLocForm(s=>({ ...s, longitude: e.target.value }))} placeholder="Longitude" className="px-3 py-2 rounded border w-full" />
                  <input value={locForm.radius_m} onChange={e=>setLocForm(s=>({ ...s, radius_m: e.target.value }))} placeholder="Radius (m)" className="px-3 py-2 rounded border w-full" />
                </div>
                <button onClick={addLocation} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow mb-3">
                  <span>Tambah Lokasi</span>
                </button>

                <div className="rounded border bg-white/70">
                  {locations.length === 0 ? (
                    <p className="p-3 text-sm text-gray-600">Belum ada lokasi terdaftar.</p>
                  ) : (
                    <ul>
                      {locations.map((l:any)=> (
                        <li key={l.id} className="p-3 border-b flex items-center justify-between">
                          <div>
                            <p className="text-sm text-black font-medium">{l.name}</p>
                            <p className="text-xs text-gray-700">Lat: {l.latitude} • Lng: {l.longitude} • Radius: {l.radius_m}m</p>
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={!!l.active} onChange={e=>toggleActive(l.id, e.target.checked)} />
                            <span>Aktif</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}