"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";


function EnrollContent() {
  const sp = useSearchParams();
  const userIdStr = sp.get("user_id") || "";
  const userId = useMemo(()=> parseInt(userIdStr || "0", 10), [userIdStr]);
  const [msg, setMsg] = useState<string | null>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string,string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  useEffect(() => {
    setMsg(null);
  }, [userId]);

  const enroll = async () => {
    setMsg(null);
    try {
      if (!userId) { setMsg("User ID tidak valid"); return; }
      if (!window.isSecureContext) { setMsg("WebAuthn membutuhkan HTTPS/localhost"); return; }

      const challenge = new Uint8Array(32); crypto.getRandomValues(challenge);
      const userIdBytes = new Uint8Array(String(userId).length);
      for (let i=0;i<String(userId).length;i++) userIdBytes[i] = String(userId).charCodeAt(i);
      const publicKey: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: { name: "Gonex", id: window.location.hostname },
        user: { id: userIdBytes, name: `user-${userId}`, displayName: `User ${userId}` },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "preferred" },
        timeout: 60000,
      };
      const cred = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
      const credId = cred.id;

      const payload = { user_id: userId, fingerprint_hash: credId, face_vector: null, qr_code: null, face_image_url: null, active: true };
      let r = await fetch(`${API_URL}/user-biometrics`, { method: "POST", headers, body: JSON.stringify(payload) });
      if (r.status === 404) {
        r = await fetch(`http://localhost:3000/user-biometrics`, { method: "POST", headers, body: JSON.stringify(payload) });
      }
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.error || `Gagal menyimpan (${r.status})`);
      setMsg("Fingerprint berhasil didaftarkan untuk user " + userId);
    } catch (e:any) { setMsg(e?.message || "Gagal mendaftarkan fingerprint"); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-lg font-semibold text-black mb-3">Enroll Fingerprint</h1>
        {msg && (<div className="mb-3 rounded-lg bg-white/80 backdrop-blur border border-white/60 p-3 text-sm text-black shadow">{msg}</div>)}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          <p className="text-sm text-gray-700 mb-3">User ID: <span className="font-medium text-black">{userId || '-'}</span></p>
          <p className="text-xs text-gray-600 mb-4">Buka halaman ini di perangkat milik user yang akan didaftarkan (Mac/iPhone/Android), lalu tekan tombol di bawah untuk memunculkan prompt Touch ID / Face ID.</p>
          <button onClick={enroll} className="rounded-lg px-3 py-2 text-white bg-emerald-600 hover:bg-emerald-700">Daftarkan Fingerprint</button>
        </div>
      </div>
    </div>
  );
}

export default function EnrollFingerprintPage() {
  return (
    <Suspense fallback={<div className="p-6">Memuat…</div>}>
      <EnrollContent />
    </Suspense>
  );
}