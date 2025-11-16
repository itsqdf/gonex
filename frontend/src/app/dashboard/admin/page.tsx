"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { authHeaders } from "@/lib/helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type CashPoint = { bulan: string; pemasukan: number; pengeluaran: number };

export default function AdminIndexPage() {
  const [loading, setLoading] = useState(true);
  const [companiesCount, setCompaniesCount] = useState(0);
  const [jabatanCount, setJabatanCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [studentsCount, setStudentsCount] = useState(0);
  const [teachersCount, setTeachersCount] = useState(0);
  const [cash, setCash] = useState<CashPoint[]>([]);
  const [me, setMe] = useState<any>(null);
  const [biometrics, setBiometrics] = useState<any>(null);
  const [savingBio, setSavingBio] = useState(false);
  const [bioMsg, setBioMsg] = useState<string>("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string>("");
  const [profileName, setProfileName] = useState<string>("");
  const [profileEmail, setProfileEmail] = useState<string>("");
  const [bioOpen, setBioOpen] = useState<boolean>(false);
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // Gunakan helper agar tipe konsisten dan hindari undefined
  const headers = useMemo<Record<string, string>>(() => authHeaders() as Record<string,string>, [token]);

  // Fallback: parse JWT agar nama/email tetap muncul jika /auth/me 401
  const parseJwt = (t?: string | null): any => {
    if (!t) return null;
    const parts = t.split(".");
    if (parts.length !== 3) return null;
    try { return JSON.parse(atob(parts[1])); } catch { return null; }
  };

  useEffect(() => {
    const run = async () => {
      try {
        // Profil pengguna & biometrik: hanya panggil jika token ada
        if (token) {
          const meRes = await fetch(`${API_URL}/auth/me`, { headers });
          if (meRes.status === 401 || meRes.status === 403) {
            const claims = parseJwt(token);
            setMe(claims);
            setBiometrics(null);
            setProfileName(claims?.nama || claims?.name || "");
            setProfileEmail(claims?.email || "");
          } else {
            const meData = await meRes.json().catch(() => null);
            setMe(meData);
            if (meData?.id) {
              const ubRes = await fetch(`${API_URL}/user-biometrics?user_id=${meData.id}`, { headers });
              const ubData = await ubRes.json().catch(() => ({}));
              const item = Array.isArray(ubData?.data) ? ubData.data[0] : (Array.isArray(ubData) ? ubData[0] : ubData?.data || null);
              setBiometrics(item || null);
              setProfileName(meData.nama || meData.name || "");
              setProfileEmail(meData.email || "");
            }
          }
        } else {
          setMe(null);
          setBiometrics(null);
          setProfileName("");
          setProfileEmail("");
        }
        // Companies & Jabatan: handle array langsung atau wrapped di data
        const [cRes, jRes] = await Promise.all([
          fetch(`${API_URL}/companies`, { headers }),
          fetch(`${API_URL}/jabatan`, { headers }),
        ]);
        const cData = await cRes.json().catch(() => ({}));
        const jData = await jRes.json().catch(() => ({}));
        const cArr = Array.isArray((cData as any)?.data) ? (cData as any).data : (Array.isArray(cData) ? (cData as any) : []);
        const jArr = Array.isArray((jData as any)?.data) ? (jData as any).data : (Array.isArray(jData) ? (jData as any) : []);
        setCompaniesCount(cArr.length || 0);
        setJabatanCount(jArr.length || 0);

        // Users: baca meta.total bila ada, fallback ke panjang array
        try {
          const uRes = await fetch(`${API_URL}/users?page=1&limit=1`, { headers });
          const uData = await uRes.json().catch(()=>({}));
          let uTotal = 0;
          if (typeof (uData as any)?.meta?.total === 'number') uTotal = (uData as any).meta.total;
          else {
            const uArr = Array.isArray((uData as any)?.data) ? (uData as any).data : (Array.isArray(uData) ? (uData as any) : []);
            uTotal = uArr.length || 0;
          }
          setUsersCount(uTotal);
        } catch {}

        // Murid & Guru: format fleksibel, gunakan meta.total bila ada
        try {
          const sRes = await fetch(`${API_URL}/akademik/siswa?page=1&limit=1`, { headers });
          const sData = await sRes.json().catch(()=>({}));
          let sTotal = 0;
          if (typeof (sData as any)?.meta?.total === 'number') sTotal = (sData as any).meta.total;
          else {
            const sArr = Array.isArray((sData as any)?.data) ? (sData as any).data : (Array.isArray(sData) ? (sData as any) : []);
            sTotal = sArr.length || 0;
          }
          setStudentsCount(sTotal);
        } catch {}
        try {
          const tRes = await fetch(`${API_URL}/akademik/guru?page=1&limit=1`, { headers });
          const tData = await tRes.json().catch(()=>({}));
          let tTotal = 0;
          if (typeof (tData as any)?.meta?.total === 'number') tTotal = (tData as any).meta.total;
          else {
            const tArr = Array.isArray((tData as any)?.data) ? (tData as any).data : (Array.isArray(tData) ? (tData as any) : []);
            tTotal = tArr.length || 0;
          }
          setTeachersCount(tTotal);
        } catch {}
        const uRes = await fetch(`${API_URL}/users?page=1&limit=1`, { headers });
        const uData = await uRes.json().catch(() => ({}));
        const metaTotal = (uData?.meta && typeof uData.meta.total === "number") ? uData.meta.total : undefined;
        const arrLen = Array.isArray(uData?.data) ? uData.data.length : 0;
        setUsersCount(metaTotal ?? arrLen ?? 0);

        // Siswa & Guru: gunakan total jika ada, fallback ke panjang items/data
        try {
          const sRes = await fetch(`${API_URL}/akademik/siswa?page=1&limit=1`, { headers });
          const sData = await sRes.json().catch(() => ({}));
          const sItems = Array.isArray((sData as any)?.items) ? (sData as any).items : Array.isArray((sData as any)?.data) ? (sData as any).data : (Array.isArray(sData) ? (sData as any) : []);
          const sTotal = Number((sData as any)?.total || sItems.length || 0);
          setStudentsCount(sTotal);
        } catch {}
        try {
          const gRes = await fetch(`${API_URL}/akademik/guru?page=1&limit=1`, { headers });
          const gData = await gRes.json().catch(() => ({}));
          const gItems = Array.isArray((gData as any)?.items) ? (gData as any).items : Array.isArray((gData as any)?.data) ? (gData as any).data : (Array.isArray(gData) ? (gData as any) : []);
          const gTotal = Number((gData as any)?.total || gItems.length || 0);
          setTeachersCount(gTotal);
        } catch {}

        // Kas arus: tampilkan 6 titik terakhir jika ada
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const params = new URLSearchParams({
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        });
        const kRes = await fetch(`${API_URL}/kas/arus?${params.toString()}`, { headers });
        const kData = await kRes.json().catch(() => ({}));
        const points: CashPoint[] = Array.isArray(kData?.data) ? kData.data : [];
        setCash(points);
      } catch {}
      setLoading(false);
    };
    run();
  }, [headers]);

  // Hitung total saldo per bulan
  const balances = useMemo(() => cash.map(p => ({ label: p.bulan, saldo: (p.pemasukan || 0) - (p.pengeluaran || 0) })), [cash]);
  const totalIncome = useMemo(() => cash.reduce((a, b) => a + (b.pemasukan || 0), 0), [cash]);
  const totalExpense = useMemo(() => cash.reduce((a, b) => a + (b.pengeluaran || 0), 0), [cash]);
  const totalBalance = useMemo(() => totalIncome - totalExpense, [totalIncome, totalExpense]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">Dashboard Admin</h2>
          <div className="text-sm text-gray-800">Selamat datang, {me?.nama || me?.name || me?.email || "Pengguna"}</div>
        </div>

        {/* Ringkasan kartu */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <SummaryCard title="Users" value={usersCount} loading={loading} color="bg-blue-600" />
          <SummaryCard title="Companies" value={companiesCount} loading={loading} color="bg-green-600" />
          <SummaryCard title="Jabatan" value={jabatanCount} loading={loading} color="bg-purple-600" />
          <SummaryCard title="Murid" value={studentsCount} loading={loading} color="bg-indigo-600" />
          <SummaryCard title="Guru" value={teachersCount} loading={loading} color="bg-pink-600" />
        </div>

        {/* Biometrik Saya */}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-black">Biometrik Saya</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Rekam wajah, perbarui sidik jari, QR satu kali</span>
              <button onClick={()=> setBioOpen(o=>!o)} className="px-3 py-1 rounded border bg-white text-sm">
                {bioOpen ? 'Tutup Edit Biometrik' : 'Edit Biometrik'}
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-700">Status</p>
              <ul className="text-sm text-gray-800 list-disc pl-5">
                <li>Wajah: {biometrics?.face_image_url ? "Terrekam" : "Belum ada"}</li>
                <li>Sidik Jari: {biometrics?.fingerprint_hash ? "Terdaftar" : "Belum ada"}</li>
                <li>QR: {biometrics?.qr_code ? "Sudah dibuat" : "Belum dibuat"}</li>
                {biometrics?.active ? <li>Aktif: Ya</li> : <li>Aktif: Tidak</li>}
              </ul>
              {bioMsg && <p className="text-xs text-green-700">{bioMsg}</p>}
            </div>

            {/* Kamera untuk rekam wajah */}
            {bioOpen && (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">Rekam Wajah</p>
              <div className="flex gap-2">
                <button onClick={async () => {
                  setBioMsg("");
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    if (videoRef.current) {
                      videoRef.current.srcObject = stream as any;
                      await videoRef.current.play();
                    }
                  } catch (e) {
                    setBioMsg("Gagal membuka kamera");
                  }
                }} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">Buka Kamera</button>
                <button onClick={async () => {
                  setBioMsg("");
                  const v = videoRef.current; const c = canvasRef.current;
                  if (!v || !c) { setBioMsg("Kamera belum aktif"); return; }
                  try {
                    c.width = v.videoWidth || 480; c.height = v.videoHeight || 360;
                    const ctx = c.getContext("2d"); if (!ctx) throw new Error("ctx");
                    ctx.drawImage(v, 0, 0, c.width, c.height);
                    const dataUrl = c.toDataURL("image/jpeg", 0.85);
                    setSavingBio(true);
                    const payload = {
                      user_id: me?.id,
                      face_image_url: dataUrl,
                      active: true
                    };
                    const res = await fetch(`${API_URL}/user-biometrics`, {
                      method: "POST",
                      headers: { ...headers, "Content-Type": "application/json" },
                      body: JSON.stringify(payload)
                    });
                    const out = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(out?.message || "Gagal simpan biometrik");
                    setBioMsg("Wajah berhasil direkam");
                    setBiometrics((prev: any) => ({ ...(prev||{}), face_image_url: dataUrl, active: true }));
                  } catch (e: any) {
                    setBioMsg(e?.message || "Gagal menyimpan wajah");
                  } finally { setSavingBio(false); }
                }} className="px-3 py-1 rounded bg-green-600 text-white text-sm">Simpan Wajah</button>
                <button onClick={() => {
                  const v = videoRef.current; if (v?.srcObject) { (v.srcObject as MediaStream).getTracks().forEach(t => t.stop()); v.srcObject = null; }
                }} className="px-3 py-1 rounded bg-gray-600 text-white text-sm">Tutup Kamera</button>
              </div>
              <div className="mt-2">
                <video ref={videoRef} className="w-full rounded border" muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>
            )}

            {/* Fingerprint WebAuthn */}
            {bioOpen && (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">Perbarui Sidik Jari</p>
              <button className="px-3 py-1 rounded bg-pink-600 text-white text-sm" onClick={async () => {
                setBioMsg("");
                try {
                  const rand = (len: number) => {
                    const arr = new Uint8Array(len);
                    crypto.getRandomValues(arr); return arr;
                  };
                  const challenge = rand(32);
                  const pubKey: PublicKeyCredentialCreationOptions = {
                    challenge,
                    rp: { name: "Gonex", id: window.location.hostname },
                    user: {
                      id: new TextEncoder().encode(String(me?.id || "0")),
                      name: me?.email || `user-${me?.id}`,
                      displayName: me?.name || `User ${me?.id}`,
                    },
                    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                    timeout: 60000,
                  };
                  const cred = await navigator.credentials.create({ publicKey: pubKey });
                  const att = cred as any;
                  const fingerprintHash = btoa(String(att?.rawId ? new Uint8Array(att.rawId).join(",") : ""));
                  setSavingBio(true);
                  const res = await fetch(`${API_URL}/user-biometrics`, {
                    method: "POST",
                    headers: { ...headers, "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: me?.id, fingerprint_hash: fingerprintHash, active: true })
                  });
                  const out = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(out?.message || "Gagal simpan fingerprint");
                  setBioMsg("Sidik jari berhasil diperbarui");
                  setBiometrics((prev: any) => ({ ...(prev||{}), fingerprint_hash: fingerprintHash, active: true }));
                } catch (e: any) {
                  setBioMsg(e?.message || "Perangkat tidak mendukung atau gagal WebAuthn");
                } finally { setSavingBio(false); }
              }}>Perbarui Sidik Jari</button>

              {/* Generate QR jika belum ada */}
              <div className="pt-3">
                <p className="text-sm text-gray-700">QR Presensi (hanya 1x)</p>
                <button disabled={!!biometrics?.qr_code} className={`px-3 py-1 rounded text-white text-sm ${biometrics?.qr_code ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600"}`} onClick={async () => {
                  setBioMsg("");
                  try {
                    if (biometrics?.qr_code) { setBioMsg("QR sudah ada dan tidak dapat diubah"); return; }
                    const code = `USER-${me?.id}-${Date.now()}`;
                    setSavingBio(true);
                    const res = await fetch(`${API_URL}/user-biometrics`, {
                      method: "POST",
                      headers: { ...headers, "Content-Type": "application/json" },
                      body: JSON.stringify({ user_id: me?.id, qr_code: code, active: true })
                    });
                    const out = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(out?.message || "Gagal generate QR");
                    setBioMsg("QR berhasil dibuat");
                    setBiometrics((prev: any) => ({ ...(prev||{}), qr_code: code, active: true }));
                  } catch (e: any) {
                    setBioMsg(e?.message || "Gagal membuat QR");
                  } finally { setSavingBio(false); }
                }}>Generate QR</button>
                {biometrics?.qr_code && <p className="text-xs text-gray-700 mt-1 break-all">Kode: {biometrics.qr_code}</p>}
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Edit Data Pribadi */}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-black">Edit Data Pribadi</h3>
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-600">Nama Saat Ini: {me?.name || me?.nama || '-'}</div>
              <div className="text-xs text-gray-600">Email Saat Ini: {me?.email || '-'}</div>
              <button onClick={()=> setProfileOpen(o=>!o)} className="px-3 py-1 rounded border bg-white text-sm">
                {profileOpen ? 'Tutup Edit' : 'Edit Data Pribadi'}
              </button>
            </div>
          </div>
          {profileOpen && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-700">Nama</label>
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Nama lengkap" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Email</label>
              <input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="email@contoh.com" />
            </div>
          </div>
          )}
          {profileOpen && (
          <div className="mt-3">
            <button className="px-3 py-1 rounded bg-blue-600 text-white text-sm" onClick={async () => {
              setProfileMsg(""); setUpdatingProfile(true);
              try {
                if (!me?.id) throw new Error("Tidak ada pengguna");
                // Cek email unik sebelum simpan
                const emailTrim = (profileEmail || "").trim();
                if (emailTrim) {
                  try {
                    const chk = await fetch(`${API_URL}/users?email=${encodeURIComponent(emailTrim)}&limit=1`, { headers });
                    const cd = await chk.json().catch(()=>({}));
                    const list = Array.isArray((cd as any)?.data) ? (cd as any).data : Array.isArray(cd) ? (cd as any) : [];
                    const exists = list.find((u:any)=> String(u.email||"").toLowerCase() === emailTrim.toLowerCase() && Number(u.id) !== Number(me.id));
                    if (exists) throw new Error("Email sudah digunakan oleh pengguna lain");
                  } catch {}
                }
                const res = await fetch(`${API_URL}/users/${me.id}`, {
                  method: "PUT",
                  headers: { ...headers, "Content-Type": "application/json" },
                  body: JSON.stringify({ name: profileName, email: profileEmail })
                });
                const out = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(out?.message || "Gagal memperbarui profil");
                setProfileMsg("Profil berhasil diperbarui");
                setMe((prev: any) => ({ ...(prev||{}), name: profileName, email: profileEmail }));
              } catch (e: any) {
                setProfileMsg(e?.message || "Gagal simpan profil");
              } finally { setUpdatingProfile(false); }
            }}>Simpan Profil</button>
            {profileMsg && <p className="text-xs text-green-700 mt-2">{profileMsg}</p>}
          </div>
          )}
        </div>

        {/* Ringkasan lain di bawah dapat ditambahkan di sini bila diperlukan */}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, loading, color }: { title: string; value: number | string; loading: boolean; color: string }) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
      <p className="text-sm text-gray-700">{title}</p>
      <div className="mt-2 flex items-end gap-2">
        <div className={`text-xl font-semibold text-white rounded px-3 py-1 ${color}`}>{loading ? "..." : value}</div>
      </div>
    </div>
  );
}

function Chart({ balances }: { balances: { label: string; saldo: number }[] }) {
  const max = Math.max(1, ...balances.map(b => Math.abs(b.saldo)));
  const height = 160;
  const barW = 32;
  const gap = 16;
  const width = balances.length * (barW + gap) + gap;
  const toY = (v: number) => height - Math.round((Math.abs(v) / max) * height);

  return (
    <svg width={width} height={height + 32} role="img" aria-label="Grafik kas">
      {balances.map((b, i) => {
        const x = gap + i * (barW + gap);
        const y = toY(b.saldo);
        const h = height - y;
        const pos = b.saldo >= 0;
        return (
          <g key={i}>
            <rect x={x} y={pos ? y : height - h} width={barW} height={h} fill={pos ? "#16a34a" : "#dc2626"} rx={6} />
            <text x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize="10" fill="#111827">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function formatIDR(n: number) {
  try { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0); } catch { return String(n); }
}
