"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Assignment = { id: number; user_id: number; role_id?: number; role: string };
type Role = { id: number; name: string };
type User = { id: number; nama: string; email: string; role?: string };

export default function RolesUserPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assign, setAssign] = useState<{ user_id: string; role_id: string }>({ user_id: "", role_id: "" });
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const userMap = useMemo(() => {
    const m = new Map<number, string>();
    users.forEach(u => m.set(u.id, `${u.nama}`));
    return m;
  }, [users]);

  const load = () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg("");
    const qs: string[] = [];
    if (query) qs.push(`q=${encodeURIComponent(query)}`);
    if (userIdFilter) qs.push(`user_id=${encodeURIComponent(userIdFilter)}`);
    qs.push(`page=${page}`);
    qs.push(`limit=${limit}`);
    fetch(`${API_URL}/roles-user?${qs.join("&")}`, { headers: { Authorization: `Bearer ${token}` }})
      .then(async (r) => {
        const j = await r.json().catch(()=>({}));
        if (!r.ok) throw new Error((j as any)?.error || "Tidak dapat memuat roles-user");
        return j;
      })
      .then(d=>{
        const arr: any[] = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? (d as any[]) : [];
        const items: Assignment[] = arr.map((x:any)=>({ id: x.id, user_id: x.user_id, role_id: x.role_id, role: x.role || '-' }));
        setItems(items);
        const meta = (d as any)?.meta || {};
        if (typeof meta.total === 'number') setTotal(meta.total);
        if (typeof meta.pages === 'number') setPages(meta.pages);
      })
      .catch((e:any)=>{ setErrorMsg(e?.message || "Gagal memuat data"); setItems([]); setTotal(0); setPages(0); })
      .finally(()=>setLoading(false));
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [page, limit, query, userIdFilter]);

  useEffect(() => {
    if (!token) return;
    // load roles for dropdown
    fetch(`${API_URL}/roles?limit=100`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r=>r.json().catch(()=>({})))
      .then(d=>{ if (Array.isArray(d.data)) setRoles(d.data.map((x:any)=>({ id:x.id, name:x.name })) as Role[]); });
    // load users for dropdown and mapping
    fetch(`${API_URL}/users?limit=200`, { headers: { Authorization: `Bearer ${token}` }})
      .then(r=>r.json().catch(()=>({})))
      .then(d=>{ if (Array.isArray(d.data)) setUsers(d.data.map((x:any)=>({ id:x.id, nama:x.nama, email:x.email })) as User[]); });
  }, []);

  const onAssign = async () => {
    if (!token) return;
    const uid = parseInt(assign.user_id||"0", 10);
    const rid = parseInt(assign.role_id||"0", 10);
    if (!uid || !rid) return Swal.fire({ title: "Validasi", text: "Pilih user dan role", icon: "warning" });
    const res = await fetch(`${API_URL}/roles-user`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ user_id: uid, role_id: rid }) });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) return Swal.fire({ title: "Gagal", text: data?.error || "Gagal menambahkan role user", icon: "error" });
    Swal.fire({ title: "Berhasil", text: "Role user ditambahkan", icon: "success" });
    setAssign({ user_id: "", role_id: "" });
    load();
  };

  const remove = async (it: Assignment) => {
    const ok = await Swal.fire({ title: "Hapus Role User?", text: `${userMap.get(it.user_id) || 'User'} • ${it.role}`, icon: "warning", showCancelButton: true, confirmButtonText: "Ya, hapus" });
    if (!ok.isConfirmed || !token) return;
    const res = await fetch(`${API_URL}/roles-user/${it.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) return Swal.fire({ title: "Gagal", text: data?.error || "Gagal menghapus role user", icon: "error" });
    Swal.fire({ title: "Berhasil", text: "Role user dihapus", icon: "success" });
    load();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Roles User</h2>
          <div className="flex items-center gap-2">
            <input value={query} onChange={e=>{ setQuery(e.target.value); setPage(1);} } placeholder="Cari role" className="px-3 py-2 rounded border w-64" />
          </div>
        </div>

        {errorMsg && (
          <div className="mb-3 rounded-lg bg-white/80 backdrop-blur border border-rose-200 p-3 text-sm text-rose-700 shadow">
            {errorMsg}
          </div>
        )}

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <h3 className="text-black font-medium mb-2">Assign Role ke User</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="relative">
              <select value={assign.user_id} onChange={e=>setAssign(a=>({ ...a, user_id: e.target.value }))} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
                <option value="">Pilih User</option>
                {users.map(u=> (<option key={u.id} value={String(u.id)}>{u.nama}</option>))}
              </select>
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 transition-all">User</label>
            </div>
            <div className="relative">
              <select value={assign.role_id} onChange={e=>setAssign(a=>({ ...a, role_id: e.target.value }))} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full">
                <option value="">Pilih Role</option>
                {roles.map(r=> (<option key={r.id} value={String(r.id)}>{r.name}</option>))}
              </select>
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 transition-all">Role</label>
            </div>
            <div>
              <button onClick={onAssign} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-white bg-green-400 hover:bg-green-500 shadow border border-green-500/40 focus:outline-none focus:ring-2 focus:ring-green-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z" />
              </svg>
              <span>Assign</span>
            </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-black">Filter User</label>
              <select value={userIdFilter} onChange={e=>{ setUserIdFilter(e.target.value); setPage(1);} } className="px-2 py-1 rounded border text-sm">
                <option value="">Semua</option>
                {users.map(u=> (<option key={u.id} value={String(u.id)}>{u.nama}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-black">Tampil</label>
                <select value={limit} onChange={e=>{ setLimit(parseInt(e.target.value,10)); setPage(1); }} className="px-2 py-1 rounded border text-sm">
                  {[5,10,20,50].map(n=> (<option key={n} value={n}>{n}</option>))}
                </select>
                <span className="text-sm text-black">per halaman</span>
              </div>
              <div className="text-sm text-black">Total: {total} • Halaman {page} dari {pages || 1}</div>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-black">Memuat...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-black/70">Tidak ada data untuk filter/kriteria saat ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-black">
                    <th className="py-2">User</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it=> (
                    <tr key={it.id} className="border-t border-gray-100">
                      <td className="py-2 text-black">{userMap.get(it.user_id) || it.user_id}</td>
                      <td className="py-2 text-black">{it.role}</td>
                      <td className="py-2">
                        <button onClick={()=>remove(it)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm border border-red-700/40 focus:outline-none focus:ring-2 focus:ring-red-400" title="Hapus">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 7h12v2H6V7Zm2 3h8l-.7 8.4a2 2 0 0 1-2 1.6H10.7a2 2 0 0 1-2-1.6L8 10Zm3-5h2a2 2 0 0 1 2 2H9a2 2 0 0 1 2-2Z"/></svg>
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between mt-3">
                <div className="text-sm text-black">Menampilkan {(items?.length||0)} dari {total}</div>
                <div className="flex items-center gap-2">
                  <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1, p-1))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50 border border-gray-600/40">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M15.5 19a1 1 0 0 1-.7-.3l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 1 1 1.4 1.4L10.9 12l5.3 5.3a1 1 0 0 1-.7 1.7Z"/></svg>
                    Prev
                  </button>
                  <span className="text-sm text-black">{page} / {pages || 1}</span>
                  <button disabled={pages>0 && page>=pages} onClick={()=>setPage(p=>p+1)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50 border border-gray-600/40">
                    Next
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8.5 5a1 1 0 0 1 .7.3l6 6a1 1 0  0 1 0 1.4l-6 6a1 1 0 1 1-1.4-1.4L13.1 12 7.8 6.7A1 1 0 0 1 8.5 5Z"/></svg>
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