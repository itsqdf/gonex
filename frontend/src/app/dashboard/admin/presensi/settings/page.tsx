"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, Label, TextInput, Alert } from "flowbite-react";
import Swal from "sweetalert2";
import { authHeaders } from "@/lib/helpers";

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

type Company = { id: number; nama: string };

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
  // Draft lokasi baru (belum tersimpan ke server)
  type LocationItem = { tempId?: string; id?: number; company_id: number; name: string; latitude: number; longitude: number; radius_m: number; active?: boolean };
  const [draftLocations, setDraftLocations] = useState<LocationItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editingLocId, setEditingLocId] = useState<number | null>(null);
  const [locForm, setLocForm] = useState<{name:string; latitude:string; longitude:string; radius_m:string}>({ name: "", latitude: "", longitude: "", radius_m: "50" });
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editModalField, setEditModalField] = useState<"name"|"radius">("name");
  const [editModalValue, setEditModalValue] = useState<string>("");
  const [jabatan, setJabatan] = useState<any[]>([]);
  const [methodMap, setMethodMap] = useState<Record<number, string>>({});
  const [selectedCoords, setSelectedCoords] = useState<{lat:number; lng:number} | null>(null);
  const [mapCenter, setMapCenter] = useState<{lat:number; lng:number}>({ lat: -6.9175, lng: 107.6191 });
  const [mapZoom, setMapZoom] = useState<number>(15);
  const [mapsEnabled, setMapsEnabled] = useState<boolean>(false);

  const headers = authHeaders("application/json");

  // Setup default icon untuk Leaflet agar marker tampil benar
  useEffect(() => {
    (async () => {
      try {
        const L = await import("leaflet");
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });
      } catch {}
    })();
  }, []);

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

  const loadCompanies = async () => {
    try {
      const r = await fetch(`${API_URL}/companies`, { headers });
      const d = await r.json().catch(() => []);
      const arr = Array.isArray(d) ? d : Array.isArray((d as any)?.data) ? (d as any).data : [];
      const list: Company[] = arr.map((c:any)=> ({ id: Number(c.id), nama: String(c.name || c.nama || '') }));
      setCompanies(list);
    } catch {}
  };

  const loadJabatan = async () => {
    try {
      const jr = await fetch(`${API_URL}/jabatan`, { headers });
      const jl = await jr.json().catch(()=>[]);
      if (Array.isArray(jl)) setJabatan(jl);
      const mr = await fetch(`${API_URL}/jabatan-presensi`, { headers });
      const ml = await mr.json().catch(()=>[]);
      const map: Record<number, string> = {};
      (Array.isArray(ml) ? ml : []).forEach((it:any)=>{ map[Number(it.jabatan_id)] = String(it.method); });
      setMethodMap(map);
    } catch {}
  };

  // Set initial map center using device geolocation when available
  useEffect(() => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (isFinite(lat) && isFinite(lng)) {
            const c = { lat, lng };
            setMapCenter(c);
            setSelectedCoords(c);
            setMapZoom(17);
            setLocForm((s) => ({ ...s, latitude: String(lat), longitude: String(lng) }));
          }
        },
        () => {
          // keep default center if user denies or unavailable
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );
    }
  }, []);

  // Pencarian dihapus sesuai permintaan: tidak ada fungsi search atau form

  useEffect(() => { load(); loadLocations(); loadJabatan(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [companyId]);
  useEffect(() => { loadCompanies(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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
      Swal.fire({ icon: "success", title: "Berhasil", text: "Pengaturan presensi disimpan." });
      await Promise.all([load(), loadLocations()]);
    } catch (e: any) {
      const msg = e?.message || "Gagal menyimpan pengaturan";
      setMsg(msg);
      Swal.fire({ icon: "error", title: "Gagal", text: msg });
    }
  };

  // Tambah lokasi sebagai draft (tidak menyimpan ke server sampai tombol Simpan diklik)
  const addLocationDraft = () => {
    setMsg(null);
    const name = (locForm.name || '').trim();
    const latitude = parseFloat(locForm.latitude);
    const longitude = parseFloat(locForm.longitude);
    const radius = parseInt(locForm.radius_m || "50", 10);
    if (!name || !isFinite(latitude) || !isFinite(longitude) || !isFinite(radius)) {
      const msg = 'name, latitude, longitude, radius_m required';
      setMsg(msg);
      Swal.fire({ icon: 'warning', title: 'Data tidak lengkap', text: msg });
      return;
    }
    const tempId = `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const draft: LocationItem = { tempId, company_id: companyId, name, latitude, longitude, radius_m: radius, active: true };
    setDraftLocations(s => [draft, ...s]);
    setLocForm({ name: "", latitude: "", longitude: "", radius_m: "50" });
    setMsg("Lokasi ditambahkan ke draft. Klik Simpan untuk menyimpan.");
  };

  // Simpan semua draft lokasi ke server
  const saveDraftLocations = async () => {
    if (draftLocations.length === 0) {
      Swal.fire({ icon: 'info', title: 'Tidak ada draft', text: 'Tambahkan lokasi terlebih dahulu.' });
      return;
    }
    setMsg(null);
    try {
      for (const dl of draftLocations) {
        const payload = {
          company_id: dl.company_id,
          name: dl.name,
          latitude: dl.latitude,
          longitude: dl.longitude,
          radius_m: dl.radius_m,
        };
        const r = await fetch(`${API_URL}/settings/locations`, { method: "POST", headers, body: JSON.stringify(payload) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error || `Gagal menambah lokasi (${r.status})`);
      }
      setDraftLocations([]);
      await loadLocations();
      setMsg('Draft lokasi berhasil disimpan');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Semua draft lokasi disimpan.' });
    } catch (e: any) {
      const msg = e?.message || 'Gagal menyimpan draft lokasi';
      setMsg(msg);
      Swal.fire({ icon: 'error', title: 'Gagal', text: msg });
    }
  };

  // Simpan seluruh data (pengaturan + draft lokasi)
  const saveAll = async () => {
    // Simpan pengaturan harian, jam, dll.
    await save();
    // Simpan semua draft lokasi jika ada
    if (draftLocations.length > 0) {
      await saveDraftLocations();
    } else {
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pengaturan presensi disimpan.' });
    }
  };

  const toggleActive = async (id: number, active: boolean) => {
    try {
      const r = await fetch(`${API_URL}/settings/locations/${id}`, { method: "PATCH", headers, body: JSON.stringify({ active }) });
      if (r.ok) await loadLocations();
    } catch {}
  };

  const updateMethod = async (jid: number, method: string) => {
    setMsg(null);
    try {
      const r = await fetch(`${API_URL}/jabatan-presensi/${jid}`, { method: "PUT", headers, body: JSON.stringify({ method }) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.error || `Gagal menyimpan metode (${r.status})`);
      setMethodMap(s=>({ ...s, [jid]: method }));
      setMsg("Metode presensi diperbarui untuk jabatan");
    } catch (e:any) {
      setMsg(e?.message || "Gagal memperbarui metode");
    }
  };

  const updateLocation = async (id: number, payload: { name?: string; latitude?: number; longitude?: number; radius_m?: number; active?: boolean }) => {
    try {
      const r = await fetch(`${API_URL}/settings/locations/${id}`, { method: "PUT", headers, body: JSON.stringify(payload) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.error || `Gagal mengubah lokasi (${r.status})`);
      await loadLocations();
      setMsg("Lokasi diperbarui");
      Swal.fire({ icon: "success", title: "Berhasil", text: "Lokasi presensi diperbarui." });
    } catch (e:any) { setMsg(e?.message || "Gagal mengubah lokasi"); }
  };

  // Hapus lokasi di database
  const deleteLocation = async (id: number) => {
    setMsg(null);
    try {
      const baseHeaders = authHeaders();
      const { ['Content-Type']: _omit, ...headersDel } = (baseHeaders as any);
      const r = await fetch(`${API_URL}/settings/locations/${id}`, { method: "DELETE", headers: headersDel });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.error || `Gagal menghapus lokasi (${r.status})`);
      setLocations(prev => prev.filter(l => l.id !== id));
      await loadLocations();
      setMsg("Lokasi dihapus dari database");
      Swal.fire({ icon: "success", title: "Berhasil", text: "Lokasi presensi dihapus dari database." });
    } catch (e:any) {
      const msg = e?.message || "Gagal menghapus lokasi";
      setMsg(msg);
      Swal.fire({ icon: "error", title: "Gagal", text: msg });
    }
  };

  // Hapus draft lokasi (lokal)
  const deleteDraftLocation = (tempId: string) => {
    setDraftLocations(prev => prev.filter(l => l.tempId !== tempId));
  };

  const MapContainer = dynamic(() => import("react-leaflet").then(m => m.MapContainer), { ssr: false });
  const TileLayer = dynamic(() => import("react-leaflet").then(m => m.TileLayer), { ssr: false });
  const Marker = dynamic(() => import("react-leaflet").then(m => m.Marker), { ssr: false });
  const Circle = dynamic(() => import("react-leaflet").then(m => m.Circle), { ssr: false });
  const Popup = dynamic(() => import("react-leaflet").then(m => m.Popup), { ssr: false });

  // Tidak ada integrasi Google Maps lagi; marker draggable diatur di komponen Leaflet

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Setting Presensi</h2>
          <div className="flex items-center gap-2">
            <select value={String(companyId)} onChange={e=>{
              const id = parseInt(e.target.value || "1", 10);
              setCompanyId(id);
            }} className="px-3 py-2 rounded border w-56">
              {companies.length === 0 && <option value={String(companyId)}>Memuat perusahaan…</option>}
              {companies.map(c=> (
                <option key={c.id} value={String(c.id)}>{c.nama}</option>
              ))}
            </select>
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

              {/* Tombol Simpan dipindahkan ke bagian paling bawah untuk menyimpan seluruh data */}

                <div className="pt-4 border-t mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-black font-medium">Lokasi Presensi</p>
                  <div className="flex items-center gap-2">
                    <Button color="indigo" className="text-white" onClick={()=>{ setMapsEnabled(true); }}>Open Maps</Button>
                    {mapsEnabled && (
                      <Button color="gray" onClick={()=> setMapsEnabled(false)}>Tutup Maps</Button>
                    )}
                  </div>
                </div>
                <div className="mb-2">
                  <div>
                    {!mapsEnabled && (
                      <div className="mt-1">
                        <Alert color="warning">Maps belum aktif. Gunakan tombol Open Maps di atas.</Alert>
                      </div>
                    )}
                    {mapsEnabled && (
                      <>
                        <div className="rounded border bg-white/70 overflow-hidden mt-2">
                          <MapContainer
                            center={selectedCoords ? [selectedCoords.lat, selectedCoords.lng] : [mapCenter.lat, mapCenter.lng]}
                            zoom={mapZoom}
                            style={{ width: "100%,", height: "300px" }}
                          >
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            {selectedCoords && (
                              <>
                                <Marker position={[selectedCoords.lat, selectedCoords.lng] as any} draggable eventHandlers={{
                                  dragend: (e: any) => {
                                    try {
                                      const ll = e.target.getLatLng();
                                      const lat = ll?.lat; const lng = ll?.lng;
                                      if (typeof lat === 'number' && typeof lng === 'number') {
                                        setSelectedCoords({ lat, lng });
                                        setLocForm(s=>({ ...s, latitude: String(lat), longitude: String(lng) }));
                                      }
                                    } catch {}
                                  }
                                }} >
                                  {editingLocId && (
                                    <Popup>
                                      <span className="text-black">{locForm.name || 'Lokasi'}</span>
                                    </Popup>
                                  )}
                                </Marker>
                                <Circle {...({ center: [selectedCoords.lat, selectedCoords.lng], radius: parseInt(locForm.radius_m || "50", 10), pathOptions: { color: "#2563eb" } } as any)} />
                              </>
                            )}
                          </MapContainer>
                        </div>
                        {editingLocId && (
                          <div className="mt-2">
                            <Alert color="info">Geser marker untuk ubah titik lokasi, lalu klik Simpan Perubahan.</Alert>
                            <div className="mt-2">
                              <Button size="sm" color="success" className="text-white" onClick={()=>{
                                if (!editingLocId || !selectedCoords) return;
                                updateLocation(editingLocId, { latitude: selectedCoords.lat, longitude: selectedCoords.lng });
                              }}>Simpan Perubahan</Button>
                            </div>
                          </div>
                        )}
                        <div className="mt-2">
                          <Button size="xs" color="gray" onClick={()=> setMapsEnabled(false)}>Tutup Maps</Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
                  <div className="flex gap-2">
                    <input value={locForm.name} onChange={e=>setLocForm(s=>({ ...s, name: e.target.value }))} placeholder="Nama lokasi" className="px-3 py-2 rounded border w-full" />
                  </div>
                  <input value={locForm.latitude} onChange={e=>setLocForm(s=>({ ...s, latitude: e.target.value }))} placeholder="Latitude" className="px-3 py-2 rounded border w-full" />
                  <input value={locForm.longitude} onChange={e=>setLocForm(s=>({ ...s, longitude: e.target.value }))} placeholder="Longitude" className="px-3 py-2 rounded border w-full" />
                  <input value={locForm.radius_m} onChange={e=>setLocForm(s=>({ ...s, radius_m: e.target.value }))} placeholder="Radius (m)" className="px-3 py-2 rounded border w-full" />
                </div>
                {/* Tambah lokasi sebagai draft berdasarkan perusahaan terpilih - disembunyikan saat sedang edit titik */}
                {!editingLocId && (
                  <Button color="indigo" onClick={addLocationDraft} className="text-white mb-3">Tambah Lokasi (Draft)</Button>
                )}

                {/* Daftar Draft Lokasi */}
                {draftLocations.length > 0 && (
                  <div className="rounded border bg-white/70 mb-3">
                    <div className="p-3 border-b flex items-center justify-between">
                      <p className="text-black font-medium">Draft Lokasi Baru</p>
                      <Button size="xs" color="success" onClick={saveDraftLocations}>Simpan Lokasi Baru</Button>
                    </div>
                    <ul>
                      {draftLocations.map((l)=> (
                        <li key={l.tempId} className="p-3 border-b flex items-center justify-between">
                          <div>
                            <p className="text-sm text-black font-medium">{l.name}</p>
                            <p className="text-xs text-gray-700">Lat: {l.latitude} • Lng: {l.longitude} • Radius: {l.radius_m}m</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="xs" color="failure" onClick={()=> deleteDraftLocation(l.tempId!)}>Hapus Draft</Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded border bg-white/70">
                  <div className="p-3 border-b">
                    <p className="text-black font-medium">Lokasi Tersimpan (Perusahaan {companyId})</p>
                  </div>
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
                          <div className="flex items-center gap-2">
                            <Button size="xs" color="sky" onClick={()=> { setSelectedCoords({ lat: Number(l.latitude), lng: Number(l.longitude) }); setMapCenter({ lat: Number(l.latitude), lng: Number(l.longitude) }); setMapZoom(17); setEditingLocId(l.id); setMapsEnabled(true); setMsg("Geser marker untuk ubah titik, lalu klik Simpan Perubahan."); }}>Ubah Titik</Button>
                            <Button size="xs" color="light" className="bg-white border border-gray-300 text-gray-800 hover:bg-gray-50" onClick={()=> { setEditModalField('radius'); setEditModalValue(String(l.radius_m)); setEditingLocId(l.id); setEditModalOpen(true); }}>Ubah Radius</Button>
                            <Button size="xs" color="light" className="bg-white border border-gray-300 text-gray-800 hover:bg-gray-50" onClick={()=> { setEditModalField('name'); setEditModalValue(String(l.name)); setEditingLocId(l.id); setEditModalOpen(true); }}>Ubah Nama</Button>
                            <Button size="xs" color="failure" onClick={async ()=> {
                              const res = await Swal.fire({
                                icon: 'warning',
                                title: 'Hapus lokasi?',
                                text: 'Lokasi akan dihapus dari database. Tindakan ini tidak dapat dibatalkan.',
                                showCancelButton: true,
                                confirmButtonColor: '#d33',
                                cancelButtonColor: '#6b7280',
                                confirmButtonText: 'Hapus',
                                cancelButtonText: 'Batal'
                              });
                              if (res.isConfirmed) deleteLocation(l.id);
                            }}>Hapus</Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Modal show={editModalOpen} onClose={()=>{ setEditModalOpen(false); }}>
                  <ModalHeader className="bg-white">{editModalField === 'name' ? 'Ubah Nama Lokasi' : 'Ubah Radius Lokasi'}</ModalHeader>
                  <ModalBody className="bg-white">
                    <div className="space-y-2">
                      <div>
                        <Label>{editModalField === 'name' ? 'Nama' : 'Radius (meter)'}</Label>
                        <TextInput value={editModalValue} onChange={e=>setEditModalValue(e.target.value)} className="bg-white text-black border-gray-300 placeholder-gray-500" />
                      </div>
                    </div>
                  </ModalBody>
                  <ModalFooter className="bg-white">
                    <Button color="light" className="bg-white border border-gray-300 text-gray-800 hover:bg-gray-50" onClick={()=> setEditModalOpen(false)}>Batal</Button>
                    <Button color="light" className="bg-white border border-gray-300 text-gray-800 hover:bg-gray-50" onClick={()=>{
                      if (!editingLocId) return;
                      if (editModalField === 'name') {
                        updateLocation(editingLocId, { name: editModalValue });
                      } else {
                        const rv = parseInt(editModalValue, 10);
                        if (!isNaN(rv)) updateLocation(editingLocId, { radius_m: rv });
                      }
                      setEditModalOpen(false);
                    }}>Simpan</Button>
                  </ModalFooter>
                </Modal>
              </div>

              <div className="pt-4 border-t mt-4">
                <p className="text-black font-medium mb-2">Metode Presensi per Jabatan</p>
                <div className="rounded border bg-white/70">
                  {jabatan.length === 0 ? (
                    <p className="p-3 text-sm text-gray-600">Belum ada jabatan terdaftar.</p>
                  ) : (
                    <ul>
                      {jabatan.map((j:any)=> (
                        <li key={j.id} className="p-3 border-b flex items-center justify-between">
                          <div>
                            <p className="text-sm text-black font-medium">{j.name}</p>
                            <p className="text-xs text-gray-700">ID: {j.id}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <select value={methodMap[j.id] || ''} onChange={e=>updateMethod(j.id, e.target.value)} className="px-3 py-2 rounded border">
                              <option value="">Pilih metode…</option>
                              <option value="face">Face Recognition</option>
                              <option value="qr">QR Generator</option>
                              <option value="fingerprint">Fingerprint</option>
                            </select>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Tombol Simpan Absen / Simpan Semua Data ditempatkan di paling bawah */}
        <div className="mt-4 flex justify-end">
          <Button color="success" onClick={saveAll} className="text-white">Simpan Semua</Button>
        </div>
      </div>
    </div>
  );
}