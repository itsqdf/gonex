"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Biometrics = {
  id: number;
  user_id: number;
  face_vector?: any;
  fingerprint_hash?: string | null;
  qr_code?: string | null;
  face_image_url?: string | null;
  active: boolean;
  created_at: string;
};

export default function UserBiometricsPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Biometrics[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState<string>("");
  const [userDropdownOpen, setUserDropdownOpen] = useState<boolean>(false);
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users.slice(0, 20);
    return users.filter((u:any)=>{
      const name = (u.nama || u.username || u.email || "").toLowerCase();
      return name.includes(q);
    }).slice(0, 20);
  }, [userSearch, users]);
  const [form, setForm] = useState<{ user_id: string; fingerprint_hash: string; qr_code: string; face_vector: string; face_image_url: string; active: boolean }>({ user_id: "", fingerprint_hash: "", qr_code: "", face_vector: "", face_image_url: "", active: true });
  const [formVisible, setFormVisible] = useState<boolean>(false);
  const [camOpen, setCamOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [captures, setCaptures] = useState<string[]>([]);
  const [enrollUserId, setEnrollUserId] = useState<number | null>(null);
  const [userLocked, setUserLocked] = useState<boolean>(false);
  // Tabel: pencarian dan pagination
  const [tableSearch, setTableSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const loadUsers = async () => {
    try {
      const qp = `?page=1&limit=200`;
      const r = await fetch(`${API_URL}/users${qp}`, { headers });
      const d = await r.json().catch(()=>({ users: [] }));
      const arr = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : (Array.isArray(d.users) ? d.users : []);
      setUsers(arr);
    } catch {}
  };

  const loadList = async () => {
    setLoading(true);
    setMsg(null);
    try {
      let r = await fetch(`${API_URL}/user-biometrics`, { headers });
      if (r.status === 404) {
        // fallback ke auth-user-service langsung bila gateway belum terupdate
        r = await fetch(`http://localhost:3000/user-biometrics`, { headers });
      }
      const d = await r.json().catch(()=>[]);
      if (Array.isArray(d)) setList(d as Biometrics[]);
    } catch (e:any) { setMsg(e?.message || "Gagal memuat data biometrik"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); loadList(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const genQR = () => {
    const val = `QR-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    setForm(s=>({ ...s, qr_code: val }));
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxW = 640; const maxH = 640;
          let w = img.width, h = img.height;
          const ratio = Math.min(maxW / w, maxH / h, 1);
          w = Math.round(w * ratio); h = Math.round(h * ratio);
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas unsupported')); return; }
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  };

  const submit = async () => {
    setMsg(null);
    try {
      const uid = parseInt(form.user_id || "0", 10);
      if (!uid) throw new Error("Pilih user terlebih dahulu");
      let faceVec: any = undefined;
      if (form.face_vector) {
        try { faceVec = JSON.parse(form.face_vector); } catch { throw new Error("Format face_vector bukan JSON valid"); }
      }
      const payload: any = {
        user_id: uid,
        face_vector: faceVec,
        fingerprint_hash: form.fingerprint_hash || null,
        qr_code: form.qr_code || null,
        face_image_url: form.face_image_url || null,
        active: !!form.active,
      };
      let r = await fetch(`${API_URL}/user-biometrics`, { method: "POST", headers, body: JSON.stringify(payload) });
      if (r.status === 404) {
        r = await fetch(`http://localhost:3000/user-biometrics`, { method: "POST", headers, body: JSON.stringify(payload) });
      }
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.error || `Gagal menyimpan biometrik (${r.status})`);
      setMsg("Biometrik disimpan/diupdate");
      setForm({ user_id: "", fingerprint_hash: "", qr_code: "", face_vector: "", face_image_url: "", active: true });
      await loadList();
    } catch (e:any) { setMsg(e?.message || "Gagal menyimpan"); }
  };

  const toggleActive = async (id: number, active: boolean) => {
    try {
      let r = await fetch(`${API_URL}/user-biometrics/${id}`, { method: "PATCH", headers, body: JSON.stringify({ active }) });
      if (r.status === 404) {
        r = await fetch(`http://localhost:3000/user-biometrics/${id}`, { method: "PATCH", headers, body: JSON.stringify({ active }) });
      }
      const d = await r.json().catch(()=>({}));
      if (r.ok) await loadList(); else setMsg(d?.error || "Gagal update status");
    } catch {}
  };

  // Hapus input manual face image; capture dilakukan via kamera

  const userNameById = useMemo(() => {
    const m: Record<number, string> = {};
    users.forEach((u: any) => { m[Number(u.id)] = u.nama || u.username || u.email || `User ${u.id}`; });
    return m;
  }, [users]);

  const filteredList = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((b)=>{
      const name = (userNameById[b.user_id] || `User ${b.user_id}`).toLowerCase();
      return name.includes(q) || String(b.user_id).includes(q) || String(b.id).includes(q);
    });
  }, [list, tableSearch, userNameById]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const pagedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page]);

  useEffect(() => { setPage(1); }, [tableSearch, list.length]);

  const startCamera = async (uid: number) => {
    try {
      setEnrollUserId(uid);
      // buka modal terlebih dahulu agar elemen video ada di DOM
      setCamOpen(true);
      await new Promise(r => setTimeout(r, 80));
      // hentikan stream lama jika ada
      const old = (videoRef.current?.srcObject as MediaStream | null);
      old?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream as any;
        v.muted = true;
        (v as any).playsInline = true;
        await new Promise<void>(resolve => {
          const handler = () => { resolve(); };
          v.onloadedmetadata = handler;
          setTimeout(resolve, 400);
        });
        await v.play().catch(()=>{});
      }
      setCaptures([]);
      // tunggu video siap (videoWidth > 0) sebelum auto-capture
      setTimeout(()=> {
        const vv = videoRef.current; if (vv && vv.videoWidth > 0) captureFrame();
      }, 600);
    } catch (err:any) {
      setMsg(err?.message || "Tidak dapat mengakses kamera");
    }
  };

  const captureFrame = () => {
    const video = videoRef.current; if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCaptures(arr => arr.length >= 3 ? arr : [...arr, dataUrl]);
  };

  const stopCamera = () => {
    const v = videoRef.current; const s = v?.srcObject as MediaStream | null;
    s?.getTracks().forEach(t => t.stop());
    if (v) v.srcObject = null;
    setCamOpen(false);
  };

  // Tutup kamera saat Escape ditekan
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && camOpen) { stopCamera(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [camOpen]);

  const saveFaceEnrollment = async () => {
    if (!enrollUserId || captures.length === 0) return;
    try {
      // gunakan capture pertama sebagai face_image_url; simpan ke form agar terlihat di bawah tombol
      const url = await compressImage(dataUrlToFile(captures[0], `face_${enrollUserId}.jpg`));
      setForm({ user_id: String(enrollUserId), fingerprint_hash: form.fingerprint_hash || "", qr_code: form.qr_code || "", face_vector: "", face_image_url: url, active: true });
      stopCamera();
      setMsg("Face direkam. Klik Simpan untuk menyimpan.");
      setFormVisible(true);
      setUserSearch(userNameById[enrollUserId] || `User ${enrollUserId}`);
      setUserLocked(true);
    } catch (e:any) { setMsg(e?.message || "Gagal menangkap face"); }
  };

  // Enroll fingerprint via WebAuthn (meminta autentikasi Touch ID/Face ID; tidak menyimpan template fingerprint di browser)
  const enrollFingerprintWebAuthn = async (uid: number) => {
    try {
      if (!window.isSecureContext) { setMsg("WebAuthn membutuhkan context HTTPS/localhost"); return; }
      const challenge = new Uint8Array(32); crypto.getRandomValues(challenge);
      const userIdBytes = new Uint8Array(String(uid).length);
      for (let i=0;i<String(uid).length;i++) userIdBytes[i] = String(uid).charCodeAt(i);
      const publicKey: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: { name: "Gonex", id: window.location.hostname },
        user: { id: userIdBytes, name: `user-${uid}`, displayName: `User ${uid}` },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "preferred" },
        timeout: 60000,
      };
      const cred = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
      const credId = cred.id;
      setForm({ user_id: String(uid), fingerprint_hash: credId, qr_code: "", face_vector: "", face_image_url: "", active: true });
      await submit();
      setMsg("Fingerprint didaftarkan via WebAuthn");
    } catch (e:any) { setMsg(e?.message || "Gagal mendaftarkan fingerprint"); }
  };

  const dataUrlToFile = (dataUrl: string, filename: string) => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length; const u8arr = new Uint8Array(n);
    while (n--) { u8arr[n] = bstr.charCodeAt(n); }
    return new File([u8arr], filename, { type: mime });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-lg font-semibold text-black mb-3">Presensi: User Biometrics</h2>
        {msg && (
          <div className="mb-3 rounded-lg bg-white/80 backdrop-blur border border-white/60 p-3 text-sm text-black shadow">{msg}</div>
        )}

        {formVisible && (
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-700">Tambah/Update Biometrik User</p>
            <button onClick={()=> setFormVisible(false)} className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50">Tutup Form</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-sm text-gray-700">User</label>
              <div className="mt-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    value={userSearch}
                    disabled={userLocked}
                    onFocus={()=> !userLocked && setUserDropdownOpen(true)}
                    onBlur={()=> setTimeout(()=> setUserDropdownOpen(false), 120)}
                    onChange={e=> { setUserSearch(e.target.value); setUserDropdownOpen(true); }}
                    placeholder="Ketik nama user…"
                    className="px-3 py-2 rounded border w-full disabled:bg-gray-100"
                  />
                  {userDropdownOpen && !userLocked && (
                    <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg border bg-white shadow max-h-60 overflow-auto">
                      {filteredUsers.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-600">Tidak ada hasil</div>
                      ) : (
                        filteredUsers.map((u:any)=> {
                          const label = u.nama || u.username || u.email || `User ${u.id}`;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onMouseDown={e=> e.preventDefault()}
                              onClick={()=> { setUserSearch(label); setForm(s=>({ ...s, user_id: String(u.id) })); setUserDropdownOpen(false); setUserLocked(true); }}
                              className="block w-full text-left px-3 py-2 hover:bg-indigo-50"
                            >
                              <span className="text-sm text-black">{label}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                <button onClick={()=> setUserLocked(l=> !l)} className="px-3 py-2 rounded border bg-white hover:bg-gray-50 text-xs whitespace-nowrap">{userLocked ? 'Buka Kunci' : 'Kunci'}</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Aktif</label>
              <input type="checkbox" checked={!!form.active} onChange={e=>setForm(s=>({ ...s, active: e.target.checked }))} />
            </div>
            <div className="md:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button disabled={!form.user_id} onClick={()=> startCamera(parseInt(form.user_id,10))} className="w-full rounded-lg px-3 py-2 h-10 text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">Aktifkan Kamera (Face)</button>
                <button disabled={!form.user_id} onClick={async ()=> {
                  const uid = parseInt(form.user_id, 10); if (!uid) return;
                  try {
                    if (!window.isSecureContext) { setMsg("WebAuthn membutuhkan HTTPS/localhost"); return; }
                    const challenge = new Uint8Array(32); crypto.getRandomValues(challenge);
                    const userIdBytes = new Uint8Array(String(uid).length);
                    for (let i=0;i<String(uid).length;i++) userIdBytes[i] = String(uid).charCodeAt(i);
                    const publicKey: PublicKeyCredentialCreationOptions = {
                      challenge,
                      rp: { name: "Gonex", id: window.location.hostname },
                      user: { id: userIdBytes, name: `user-${uid}`, displayName: `User ${uid}` },
                      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "preferred" },
                      timeout: 60000,
                    };
                    const cred = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
                    const credId = cred.id;
                    setForm(s=> ({ ...s, fingerprint_hash: credId }));
                    setMsg("Fingerprint dibaca. Klik Simpan untuk menyimpan.");
                  } catch (e:any) { setMsg(e?.message || "Gagal membaca fingerprint"); }
                }} className="w-full rounded-lg px-3 py-2 h-10 text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">Aktifkan Fingerprint</button>
                <button disabled={!form.user_id} onClick={()=> { genQR(); }} className="w-full rounded-lg px-3 py-2 h-10 text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50">Generate QR</button>
              </div>
              {(form.fingerprint_hash || form.qr_code || form.face_image_url) && (
                <div className="mt-2 flex flex-col gap-2">
                  {form.face_image_url && (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Hasil Face:</p>
                      <img src={form.face_image_url} alt="face" className="h-24 w-auto rounded border" />
                    </div>
                  )}
                  {form.fingerprint_hash && (
                    <div className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">FP: {form.fingerprint_hash}</div>
                  )}
                  {form.qr_code && (
                    <div className="text-xs px-2 py-1 rounded bg-sky-50 text-sky-700 border border-sky-200 w-fit">QR: {form.qr_code}</div>
                  )}
                </div>
              )}
            </div>
            <div className="md:col-span-2 mt-1">
              <label className="text-sm text-gray-700">Status Data</label>
              <div className="mt-1 flex items-center gap-6 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={!!form.face_vector || !!form.face_image_url} readOnly />
                  <span>Face</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={!!form.fingerprint_hash} readOnly />
                  <span>Fingerprint</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={!!form.qr_code} readOnly />
                  <span>QR</span>
                </label>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <button onClick={submit} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow">
              <span>Simpan Biometrik</span>
            </button>
          </div>
        </div>
        )}

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-700">Daftar Biometrik</p>
            <button onClick={()=> { setFormVisible(true); setMsg(null); }} className="rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700">Tambah</button>
          </div>
          <div className="mb-3 flex items-center gap-2">
            <input value={tableSearch} onChange={e=>setTableSearch(e.target.value)} placeholder="Cari nama/ID…" className="px-3 py-2 rounded border w-full max-w-sm" />
          </div>
          {loading ? (
            <p className="text-gray-600">Memuat...</p>
          ) : (
            <>
            <div className="rounded border bg-white/70 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-indigo-50">
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">User</th>
                    <th className="px-3 py-2 text-left">Face Vector</th>
                    <th className="px-3 py-2 text-left">Fingerprint</th>
                    <th className="px-3 py-2 text-left">QR Code</th>
                    <th className="px-3 py-2 text-left">Aktif</th>
                    <th className="px-3 py-2 text-left">Created</th>
                    <th className="px-3 py-2 text-left">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-2 text-center text-gray-600">Belum ada data</td></tr>
                  ) : (
                    pagedList.map(b => (
                      <tr key={b.id} className="border-t">
                        <td className="px-3 py-2">{b.id}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {b.face_image_url ? (<img src={b.face_image_url} alt="face" className="h-8 w-8 object-cover rounded" />) : (<div className="h-8 w-8 rounded bg-gray-200" />)}
                            <div>
                              <div className="text-sm font-medium text-black">{userNameById[b.user_id] || `User ${b.user_id}`}</div>
                              <div className="text-xs text-gray-600">ID: {b.user_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">{b.face_vector ? 'Ada' : '-'}</td>
                        <td className="px-3 py-2">{b.fingerprint_hash ? 'Ada' : '-'}</td>
                        <td className="px-3 py-2">{b.qr_code ? 'Ada' : '-'}</td>
                        <td className="px-3 py-2">
                          <div className="inline-flex items-center gap-2">
                            <button onClick={()=>toggleActive(b.id, true)} className={`px-2 py-1 rounded text-xs ${b.active ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>ON</button>
                            <button onClick={()=>toggleActive(b.id, false)} className={`px-2 py-1 rounded text-xs ${!b.active ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}>OFF</button>
                          </div>
                        </td>
                        <td className="px-3 py-2">{b.created_at}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button onClick={()=> { setUserSearch(userNameById[b.user_id] || `User ${b.user_id}`); setUserLocked(true); startCamera(b.user_id); }} className="px-2 py-1 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-700">Face</button>
                            <button onClick={async ()=> { setFormVisible(true); setUserSearch(userNameById[b.user_id] || `User ${b.user_id}`); setUserLocked(true); setForm(s=>({ ...s, user_id: String(b.user_id) })); try {
                              if (!window.isSecureContext) { setMsg("WebAuthn membutuhkan HTTPS/localhost"); return; }
                              const challenge = new Uint8Array(32); crypto.getRandomValues(challenge);
                              const userIdBytes = new Uint8Array(String(b.user_id).length);
                              for (let i=0;i<String(b.user_id).length;i++) userIdBytes[i] = String(b.user_id).charCodeAt(i);
                              const publicKey: PublicKeyCredentialCreationOptions = {
                                challenge,
                                rp: { name: "Gonex", id: window.location.hostname },
                                user: { id: userIdBytes, name: `user-${b.user_id}`, displayName: `User ${b.user_id}` },
                                pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                                authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "preferred" },
                                timeout: 60000,
                              };
                              const cred = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
                              const credId = cred.id;
                              setForm(s=> ({ ...s, user_id: String(b.user_id), fingerprint_hash: credId }));
                              setMsg("Fingerprint dibaca. Klik Simpan untuk menyimpan.");
                            } catch (e:any) { setMsg(e?.message || "Gagal membaca fingerprint"); } }} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-700">Fingerprint</button>
                            <button onClick={()=> { const code = `QR-${Date.now()}-${Math.random().toString(36).slice(2,10)}`; setFormVisible(true); setUserSearch(userNameById[b.user_id] || `User ${b.user_id}`); setUserLocked(true); setForm({ user_id: String(b.user_id), fingerprint_hash: '', qr_code: code, face_vector: '', face_image_url: '', active: true }); }} className="px-2 py-1 rounded bg-sky-600 text-white text-xs hover:bg-sky-700">QR</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <div>Menampilkan {(Math.min((page-1)*pageSize+1, filteredList.length))}–{Math.min(page*pageSize, filteredList.length)} dari {filteredList.length} data</div>
              <div className="flex items-center gap-2">
                <button onClick={()=> setPage(p=> Math.max(1, p-1))} disabled={page<=1} className="px-3 py-1 rounded border bg-white disabled:opacity-50">Prev</button>
                <span>Hal {page} / {totalPages}</span>
                <button onClick={()=> setPage(p=> Math.min(totalPages, p+1))} disabled={page>=totalPages} className="px-3 py-1 rounded border bg-white disabled:opacity-50">Next</button>
              </div>
            </div>
            </>
          )}
        </div>

        {camOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={stopCamera}>
            <div className="bg-white rounded-2xl shadow-lg w-full max-w-2xl overflow-hidden" onClick={(e)=> e.stopPropagation()}>
              <div className="p-4 flex items-center justify-between border-b">
                <h3 className="text-black font-medium">Rekam Wajah</h3>
                <button onClick={stopCamera} className="text-sm text-gray-600 hover:text-black">Tutup</button>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full rounded border bg-black" />
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={captureFrame} className="px-3 py-2 rounded bg-indigo-600 text-white text-sm">Ambil Frame</button>
                    <span className="text-sm text-gray-600">Ambil minimal 1–3 frame dengan pencahayaan baik.</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-700 mb-2">Preview Frame</p>
                  <div className="grid grid-cols-3 gap-2">
                    {captures.map((c, i)=> (
                      <img key={i} src={c} alt={`cap-${i}`} className="h-24 w-full object-cover rounded border" />
                    ))}
                    {captures.length === 0 && <div className="text-sm text-gray-600">Belum ada frame</div>}
                  </div>
                  <div className="mt-3">
                    <button disabled={captures.length===0} onClick={saveFaceEnrollment} className="px-3 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50">Simpan Wajah</button>
                  </div>
                </div>
              </div>
              <div className="px-4 pb-4 text-xs text-gray-600">Tips: Pastikan wajah menghadap kamera, pencahayaan cukup, dan tidak blur untuk mengurangi salah identifikasi.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}