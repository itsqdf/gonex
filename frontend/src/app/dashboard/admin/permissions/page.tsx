"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function PermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [perms, setPerms] = useState<string[]>([]);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_URL}/auth/permissions`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json().catch(()=>({})))
      .then(d => { if (Array.isArray(d.permissions)) setPerms(d.permissions); })
      .finally(()=> setLoading(false));
  }, [token]);

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg md:text-xl font-semibold text-black">Permissions</h1>
        <span className="text-sm text-black/60">Read-only dari <code className="font-mono">/auth/permissions</code></span>
      </div>
      {loading ? (
        <div className="text-black">Memuat permissions...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {perms.map(code => (
            <div key={code} className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-black shadow-sm">
              <div className="font-mono text-sm">{code}</div>
              <div className="text-xs text-black/60">Tidak dapat diubah dari UI ini</div>
            </div>
          ))}
          {perms.length === 0 && (
            <div className="text-black/70">Tidak ada permissions</div>
          )}
        </div>
      )}
    </div>
  );
}