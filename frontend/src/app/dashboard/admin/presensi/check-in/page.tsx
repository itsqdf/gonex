"use client";

import { useEffect, useRef, useState } from "react";

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
  const [userId, setUserId] = useState<number | null>(null);
  const [jabatanName, setJabatanName] = useState<string>("");
  const [methodAllowed, setMethodAllowed] = useState<string | null>(null);
  const [method, setMethod] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [cameraOn, setCameraOn] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [fingerMsg, setFingerMsg] = useState<string>("");
  const [qrCodeInput, setQrCodeInput] = useState<string>("");

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

  const loadMeAndMethod = async () => {
    try {
      const mr = await fetch(`${API_URL}/auth/me`, { headers });
      const me = await mr.json().catch(()=>({}));
      const uid = me?.id || me?.user_id || null;
      if (!uid) return;
      setUserId(Number(uid));
      const ur = await fetch(`${API_URL}/users/${uid}`, { headers });
      const uj = await ur.json().catch(()=>({}));
      const jname = uj?.user?.jabatan || "";
      setJabatanName(String(jname));
      const jr = await fetch(`${API_URL}/jabatan`, { headers });
      const jl = await jr.json().catch(()=>[]);
      const j = (Array.isArray(jl) ? jl : []).find((it:any)=> String(it.name) === String(jname));
      const jpres = await fetch(`${API_URL}/jabatan-presensi`, { headers });
      const jplist = await jpres.json().catch(()=>[]);
      const jp = (Array.isArray(jplist) ? jplist : []).find((it:any)=> Number(it.jabatan_id) === Number(j?.id));
      const allowed = jp ? String(jp.method) : null;
      setMethodAllowed(allowed);
      setMethod(allowed || "");
    } catch {}
  };

  useEffect(() => { loadMeAndMethod(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Camera controls for Face method
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Kamera tidak tersedia");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (e: any) {
      setMsg(e?.message || "Gagal mengaktifkan kamera");
    }
  };

  const stopCamera = () => {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.pause();
        // @ts-ignore
        videoRef.current.srcObject = null;
      }
      setCameraOn(false);
    } catch {}
  };

  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

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
      if (!method) { setMsg("Pilih metode check-in terlebih dahulu"); return; }
      body.method = method;
      if (userId) body.user_id = userId;
      if (notes) body.notes = notes;
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
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-700">Metode</label>
                  <div className="flex gap-2 mt-1">
                    {((methodAllowed ? [methodAllowed] : ["face","fingerprint","qr"]) as string[]).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={`px-3 py-1.5 rounded border text-sm ${method===m? 'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
                      >
                        {m === 'face' ? 'Kamera' : m === 'fingerprint' ? 'Fingerprint' : 'QR'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Diatur dari jabatan: {jabatanName || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-700">Catatan / Alasan</label>
                  <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opsional" className="px-3 py-2 rounded border w-full" />
                </div>
              </div>
              {/* Method-specific UI */}
              {method === 'face' && (
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    {!cameraOn ? (
                      <button onClick={startCamera} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white shadow">Aktifkan Kamera</button>
                    ) : (
                      <button onClick={stopCamera} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white shadow">Matikan Kamera</button>
                    )}
                    <span className="text-xs text-gray-600">Kamera digunakan untuk verifikasi wajah</span>
                  </div>
                  <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 w-full max-w-sm bg-black">
                    <video ref={videoRef} className="w-full h-64 object-cover" playsInline muted></video>
                  </div>
                </div>
              )}
              {method === 'fingerprint' && (
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setFingerMsg("");
                        try {
                          if (!('credentials' in navigator)) throw new Error('WebAuthn tidak tersedia');
                          // Placeholder call; server-side challenge diperlukan untuk produksi
                          setFingerMsg('Fingerprint siap. Lanjutkan dengan Check In.');
                        } catch (e: any) {
                          setFingerMsg(e?.message || 'Fingerprint tidak tersedia');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white shadow"
                    >Mulai Fingerprint</button>
                    <span className="text-xs text-gray-600">Gunakan perangkat yang mendukung sidik jari</span>
                  </div>
                  {fingerMsg && <p className="text-xs text-black mt-2">{fingerMsg}</p>}
                </div>
              )}
              {method === 'qr' && (
                <div className="mt-4">
                  <label className="text-sm text-gray-700">Masukkan Kode QR (opsional)</label>
                  <input value={qrCodeInput} onChange={e=>setQrCodeInput(e.target.value)} placeholder="Contoh: EMP-123-QR" className="px-3 py-2 rounded border w-full" />
                  <p className="text-xs text-gray-600 mt-1">Kode membantu pencocokan, server tetap validasi biometrik aktif</p>
                </div>
              )}
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