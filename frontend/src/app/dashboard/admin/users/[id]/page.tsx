"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { authHeaders } from "@/lib/helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type DetailUser = {
  id: number;
  nama: string;
  email: string;
  status: string;
  jabatan?: string;
  role?: string;
};

export default function DetailUserPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<DetailUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    const id = params?.id as string;
    if (!id) return;
    setLoading(true);
    fetch(`${API_URL}/users/${id}`, { headers: authHeaders() })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Tidak dapat memuat pengguna");
        const u = j?.user || j;
        setUser({ id: u.id, nama: u.nama, email: u.email, status: u.status, jabatan: u.jabatan, role: u.role });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params]);

  // Muat roles assignment (readonly) dari user-roles
  useEffect(() => {
    const id = params?.id as string;
    if (!id) return;
    fetch(`${API_URL}/roles-user?user_id=${id}&limit=100`, { headers: authHeaders() })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => {
        const arr = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
        const list = (arr as any[]).map((x) => x.role || x.name).filter(Boolean);
        setRoles(list as string[]);
      })
      .catch(() => {});
  }, [params]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Detail Pengguna</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/dashboard/admin/users')} className="px-3 py-1.5 rounded bg-gray-600 hover:bg-gray-700 text-white text-sm">Kembali</button>
            <button onClick={() => router.push(`/dashboard/admin/users/${user?.id}/edit`)} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">Edit</button>
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          {loading ? (
            <p className="text-sm text-black">Memuat...</p>
          ) : user ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <label className="text-xs text-gray-500">Nama</label>
                <div className="text-black font-medium">{user.nama || '-'}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Email</label>
                <div className="text-black font-medium">{user.email || '-'}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Status</label>
                <div className="inline-flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${ (user.status||'').toLowerCase() === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{ (user.status||'').toLowerCase() === 'aktif' ? 'Aktif' : 'Tidak Aktif' }</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Jabatan</label>
                <div className="text-black font-medium">{user.jabatan || '-'}</div>
              </div>
              {user.role ? (
                <div>
                  <label className="text-xs text-gray-500">Role</label>
                  <div className="text-black font-medium">{user.role}</div>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500">Roles (readonly)</label>
                {roles.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {roles.map((r, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800 border border-gray-200">{r}</span>
                    ))}
                  </div>
                ) : (
                  <div className="text-black text-sm">Tidak ada roles terpasang.</div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-black">Data tidak ditemukan.</p>
          )}
        </div>
      </div>
    </div>
  );
}