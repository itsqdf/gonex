"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { authHeaders, buildQueryParams, fetchJson, PaginatedResponse } from "@/lib/helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type User = {
  id: number;
  nama: string;
  email: string;
  status: string;
  jabatan: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const router = useRouter();

  const loadUsers = () => {
    setLoading(true);
    const qs = buildQueryParams({ page, limit, q: query.trim() });
    fetchJson<PaginatedResponse<User[]>>(`${API_URL}/users${qs}`)
      .then((data) => {
        setUsers(Array.isArray(data.data) ? data.data : []);
        const m = data.meta || { page: 1, pages: 0, total: 0, limit };
        setTotal(Number(m.total || 0));
        setPages(Number(m.pages || 0));
      })
      .catch((e) => {
        Swal.fire({ title: "Gagal", text: e?.message || "Tidak dapat memuat pengguna", icon: "error" });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  // Alihkan ke halaman create
  const goCreateUser = () => {
    router.push(`/dashboard/admin/users/create`);
  };

  // Alihkan ke halaman edit tersendiri
  const goEditUser = (u: User) => {
    router.push(`/dashboard/admin/users/${u.id}/edit`);
  };

  const deleteUser = async (u: User) => {
    const ok = await Swal.fire({ title: "Hapus Pengguna?", text: `${u.nama} akan dihapus.`, icon: "warning", showCancelButton: true, confirmButtonText: "Ya, hapus" });
    if (!ok.isConfirmed) return;
    const res = await fetch(`${API_URL}/users/${u.id}`, { method: "DELETE", headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return Swal.fire({ title: "Gagal", text: data?.error || "Gagal menghapus", icon: "error" });
    Swal.fire({ title: "Berhasil", text: "Pengguna dihapus", icon: "success" });
    loadUsers();
  };

  const resetPassword = async (u: User) => {
    const ok = await Swal.fire({ title: "Reset Password?", text: `Password ${u.nama} akan di-reset.`, icon: "question", showCancelButton: true, confirmButtonText: "Ya, reset" });
    if (!ok.isConfirmed) return;
    const res = await fetch(`${API_URL}/users/${u.id}/reset-password`, { method: "POST", headers: authHeaders() });
    let data: any = null;
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        data = await res.text();
      }
    } catch (_) {
      data = null;
    }
    if (!res.ok) {
      const msg = typeof data === "string" && data ? data : data?.error || "Gagal mereset";
      return Swal.fire({ title: "Gagal", text: msg, icon: "error" });
    }
    const defaultPwd = (data && typeof data === "object" ? data.default : null) || "12345678";
    Swal.fire({ title: "Berhasil", text: `Password default: ${defaultPwd}`, icon: "success" });
  };

  const goDetailUser = (u: User) => {
    router.push(`/dashboard/admin/users/${u.id}`);
  };

  const toggleActive = async (u: User) => {
    const active = (u.status || "").toLowerCase().includes("aktif");
    try {
      const res = await fetch(`${API_URL}/users/${u.id}/active`, { method: "PUT", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ active: !active }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return Swal.fire({ title: "Gagal", text: data?.error || "Tidak dapat mengubah status.", icon: "error" });
      }
      Swal.fire({ title: "Berhasil", text: `Status ${u.nama} diubah.`, icon: "success", timer: 800, showConfirmButton: false });
      loadUsers();
    } catch {
      Swal.fire({ title: "Gagal", text: "Tidak dapat terhubung ke server.", icon: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Manajemen Pengguna</h2>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              placeholder="Cari ...."
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-black bg-white"
              aria-label="Cari pengguna"
            />
            <button
              onClick={() => { setPage(1); loadUsers(); }}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-yellow-500 hover:bg-yellow-600 shadow border border-yellow-600/40 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              aria-label="Terapkan filter"
              title="Cari"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm8.7 15.3-3.2-3.2a9.5 9.5 0 0 1-1.4 1.4l3.2 3.2a1 1 0 0 0 1.4-1.4Z"/></svg>
              <span>Cari</span>
            </button>
            <select
              value={limit}
              onChange={(e)=>{ setLimit(parseInt(e.target.value,10)); setPage(1); }}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-black bg-white"
              aria-label="Jumlah per halaman"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <button
              onClick={goCreateUser}
              aria-label="Tambah pengguna"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-400 hover:bg-green-500 shadow border border-green-500/40 focus:outline-none focus:ring-2 focus:ring-green-300"
              title="Tambah"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z" />
              </svg>
              <span>Tambah</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          {loading ? (
            <p className="text-sm text-black">Memuat...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-black">
                    <th className="py-2">Nama</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Jabatan</th>
                    <th className="py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-gray-100">
                      <td className="py-2 text-black">{u.nama}</td>
                      <td className="py-2 text-black">{u.email}</td>
                      <td className="py-2 text-black">{u.status}</td>
                      <td className="py-2 text-black">{u.jabatan || '-'}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => goDetailUser(u)}
                            aria-label="Detail pengguna"
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm border border-gray-300"
                            title="Detail"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"/></svg>
                            <span>Detail</span>
                          </button>
                          <button
                            onClick={() => toggleActive(u)}
                            aria-label="Toggle aktif"
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm border ${ (u.status||'').toLowerCase().includes('aktif') ? 'bg-green-600 hover:bg-green-700 text-white border-green-700/40' : 'bg-gray-500 hover:bg-gray-600 text-white border-gray-600/40'}`}
                            title={(u.status||'').toLowerCase().includes('aktif') ? 'Matikan' : 'Nyalakan'}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              <path d="M12 2a1 1 0 0 1 1 1v7a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 22A8 8 0 1 1 12 6a8 8 0 0 1 0 18Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => goEditUser(u)}
                            aria-label="Edit pengguna"
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm border border-blue-700/40 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            title="Edit"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm14.71-9.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.99-1.67Z" />
                            </svg>
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => deleteUser(u)}
                            aria-label="Hapus pengguna"
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm border border-red-700/40 focus:outline-none focus:ring-2 focus:ring-red-400"
                            title="Hapus"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              <path d="M6 7h12v2H6V7Zm2 3h8l-.7 8.4a2 2 0 0 1-2 1.6H10.7a2 2 0 0 1-2-1.6L8 10Zm3-5h2a2 2 0 0 1 2 2H9a2 2 0 0 1 2-2Z" />
                            </svg>
                            <span>Hapus</span>
                          </button>
                          <button
                            onClick={() => resetPassword(u)}
                            aria-label="Reset password"
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm border border-purple-700/40 focus:outline-none focus:ring-2 focus:ring-purple-400"
                            title="Reset"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              <path d="M12 6a6 6 0 1 1-5.33 3.2 1 1 0 1 0-1.74-.98A8 8 0 1 0 12 4v2Zm1 1a1 1 0 1 0-2 0v5a1 1 0 0 0 .55.89l3 1.5a1 1 0 0 0 .9-1.78L13 11.82V7Z" />
                            </svg>
                            <span>Reset</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination Controls */}
              <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-black">Total: {total} • Halaman: {page}/{Math.max(pages, 1)}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p-1))}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50 border border-gray-600/40"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M15.5 19a1 1 0 0 1-.7-.3l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 1 1 1.4 1.4L10.9 12l5.3 5.3a1 1 0 0 1-.7 1.7Z"/></svg>
                    Prev
                  </button>
                  <button
                    onClick={() => setPage(p => (pages ? Math.min(pages, p+1) : p+1))}
                    disabled={pages ? page >= pages : false}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50 border border-gray-600/40"
                  >
                    Next
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8.5 5a1 1 0 0 1 .7.3l6 6a1 1 0 0 1 0 1.4l-6 6a1 1 0 1 1-1.4-1.4L13.1 12 7.8 6.7A1 1 0 0 1 8.5 5Z"/></svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}