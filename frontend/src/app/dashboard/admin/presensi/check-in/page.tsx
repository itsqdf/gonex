"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type TodayStatus = {
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  activities?: any[];
};

export default function PresensiCheckInPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TodayStatus | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [coords, setCoords] = useState<{lat:number; lng:number} | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const loadToday = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch(`${API_URL}/presensi/me/today`, { headers });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setStatus(d);
      else setMsg(d?.error || `Gagal memuat status (${r.status})`);
    } catch (e: any) {
      setMsg(e?.message || "Gagal memuat status hari ini");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadToday(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const getLocation = async (): Promise<{lat:number; lng:number} | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const c = { lat: latitude, lng: longitude };
          setCoords(c);
          resolve(c);
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  };

  const doCheckIn = async () => {
    setMsg(null);
    try {
      const c = await getLocation();
      const body: any = {};
      if (c) { body.latitude = c.lat; body.longitude = c.lng; }
      const r = await fetch(`${API_URL}/presensi/check-in`, { method: "POST", headers, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `Gagal check-in (${r.status})`);
      setMsg("Berhasil check-in");
      await loadToday();
    } catch (e: any) { setMsg(e?.message || "Gagal check-in"); }
  };

  const doCheckOut = async () => {
    setMsg(null);
    try {
      const c = await getLocation();
      const body: any = {};
      if (c) { body.latitude = c.lat; body.longitude = c.lng; }
      const r = await fetch(`${API_URL}/presensi/check-out`, { method: "POST", headers, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `Gagal check-out (${r.status})`);
      setMsg("Berhasil check-out");
      await loadToday();
    } catch (e: any) { setMsg(e?.message || "Gagal check-out"); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-lg font-semibold text-black mb-3">Presensi: Check In / Out</h2>
        {msg && (
          <div className="mb-3 rounded-lg bg-white/80 backdrop-blur border border-white/60 p-3 text-sm text-black shadow">{msg}</div>
        )}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-4">
          {loading ? (
            <p className="text-gray-600">Memuat status hari ini...</p>
          ) : (
            <div>
              <p className="text-sm text-gray-700">Tanggal: {status?.date || "-"}</p>
              <p className="text-sm text-gray-700">Check-in: {status?.check_in || "-"}</p>
              <p className="text-sm text-gray-700">Check-out: {status?.check_out || "-"}</p>
            </div>
          )}
          <div className="mt-4 flex items-center gap-2">
            <button onClick={doCheckIn} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow">
              <span>Check In</span>
            </button>
            <button onClick={doCheckOut} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-rose-600 hover:bg-rose-700 shadow">
              <span>Check Out</span>
            </button>
            <button onClick={loadToday} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 shadow">
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}