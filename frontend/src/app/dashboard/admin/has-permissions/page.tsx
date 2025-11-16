"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { authHeaders, fetchJson, PaginatedResponse } from "@/lib/helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Role = { id:number; name:string; description?:string };
type Perm = { id:number; code:string; name?:string; description?:string };

export default function HasPermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [selectedRole, setSelectedRole] = useState<number | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [roleLoading, setRoleLoading] = useState<boolean>(false);
  const [roleError, setRoleError] = useState<string>("");

  const loadBase = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [rRes, pRes] = await Promise.all([
        fetchJson<PaginatedResponse<Role[]>>(`/roles`),
        fetchJson<PaginatedResponse<Perm[]>>(`/permissions`),
      ]);
      const rData = Array.isArray((rRes as any)?.data)
        ? (rRes as any).data
        : Array.isArray(rRes as any)
        ? (rRes as any)
        : [];
      const pData = Array.isArray((pRes as any)?.data)
        ? (pRes as any).data
        : Array.isArray(pRes as any)
        ? (pRes as any)
        : [];
      setRoles(rData as Role[]);
      setPerms(pData as Perm[]);
      const firstRole = (rData as Role[])[0]?.id || null;
      setSelectedRole(firstRole);
      if ((pData as Perm[]).length === 0) {
        setErrorMsg("Permissions kosong atau endpoint tidak tersedia. Cek /permissions.");
      }
    } catch (e: any) {
      const msg = e?.message || 'Tidak dapat memuat roles/permissions';
      setErrorMsg(msg);
      Swal.fire({ title: 'Gagal', text: msg, icon: 'error' });
      setRoles([]);
      setPerms([]);
      setSelectedRole(null);
    } finally {
      setLoading(false);
    }
  };

  const loadRolePerms = async (roleId: number) => {
    setRoleLoading(true);
    setRoleError("");
    try {
      const res = await fetchJson<{ data: Perm[] }>(`/permissions/by-role/${roleId}`);
      const ids = new Set<number>((res.data || []).map((p:Perm)=>p.id));
      const next: Record<number, boolean> = {};
      perms.forEach(p => { next[p.id] = ids.has(p.id); });
      setChecked(next);
    } catch (e: any) {
      const msg = e?.message || 'Tidak dapat memuat permissions untuk role';
      setRoleError(msg);
      Swal.fire({ title: 'Gagal', text: msg, icon: 'error' });
      const next: Record<number, boolean> = {};
      perms.forEach(p => { next[p.id] = false; });
      setChecked(next);
    } finally {
      setRoleLoading(false);
    }
  };

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (selectedRole) loadRolePerms(selectedRole); }, [selectedRole, perms.length]);

  const toggle = (id:number) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const allSelectedCount = useMemo(()=> Object.values(checked).filter(Boolean).length, [checked]);

  // Kelompok menu dan prefix permissions yang terkait (sinkron dengan Sidebar)
  const menuGroups = [
    { key: 'menu_master_data', label: 'Master Data', prefixes: [] },
    { key: 'menu_hak_akses', label: 'Hak Akses', prefixes: ['manage'] },
    { key: 'menu_kas', label: 'Kas', prefixes: ['kas_masuk_','kas_keluar_','kas_flow_'] },
    { key: 'menu_produk', label: 'Produk', prefixes: ['produk_'] },
    { key: 'menu_setting', label: 'Setting', prefixes: ['rekening_','category_asset_','category_product_'] },
    { key: 'menu_asset_perusahaan', label: 'Asset Perusahaan', prefixes: ['assets_','maintenance_'] },
    { key: 'menu_ruangan', label: 'Ruangan', prefixes: ['warehouses_','racks_','rack_positions_','mutasi_'] },
    { key: 'menu_payment', label: 'Payment', prefixes: [] },
    { key: 'menu_chat', label: 'Chat', prefixes: [] },
    { key: 'menu_ml', label: 'Rekomendasi', prefixes: [] },
    { key: 'menu_presensi', label: 'Presensi', prefixes: [] },
    { key: 'menu_user_biometrics', label: 'User Biometrics', prefixes: [] },
    { key: 'menu_client', label: 'Client', prefixes: [] },
    { key: 'menu_akademik', label: 'Akademik', prefixes: ['akademik.'] },
  ];

  const permsByCode = useMemo(() => {
    const map = new Map<string, Perm>();
    perms.forEach(p => map.set(p.code, p));
    return map;
  }, [perms]);

  const getGroupPerms = (prefixes: string[]) => {
    return perms.filter(p => prefixes.some(pref => p.code.startsWith(pref)));
  };

  const save = async () => {
    if (!selectedRole) return;
    const perm_ids = Object.keys(checked).filter(k => checked[Number(k)]).map(Number);
    try {
      const res = await fetch(`${API_URL}/permissions/assign/${selectedRole}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ perm_ids }) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        return Swal.fire({ title: 'Gagal', text: data?.error || 'Tidak dapat menyimpan permissions', icon: 'error' });
      }
      Swal.fire({ title: 'Berhasil', text: 'Permissions disimpan', icon: 'success' });
      await loadRolePerms(selectedRole);
    } catch (e: any) {
      Swal.fire({ title: 'Gagal', text: e?.message || 'Kesalahan jaringan', icon: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Has Permissions</h2>
          <div className="text-sm text-black/80">Dipilih: {allSelectedCount}</div>
        </div>
        {errorMsg && (
          <div className="mb-3 rounded-lg bg-white/80 backdrop-blur border border-rose-200 p-3 text-sm text-rose-700 shadow">
            {errorMsg}
          </div>
        )}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          {loading ? (
            <p className="text-sm text-black">Memuat...</p>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-3">
                <label className="text-sm text-black">Role:</label>
                <select value={selectedRole ?? ''} onChange={(e)=>setSelectedRole(Number(e.target.value))} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-black">
                  {roles.map(r => (<option key={r.id} value={r.id}>{r.name}</option>))}
                </select>
                {roleLoading && <span className="text-sm text-black/60">Memuat permissions role...</span>}
                {roleError && (
                  <span className="text-sm text-rose-700">{roleError}</span>
                )}
                <button onClick={save} className="ml-auto text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:border-blue-500 dark:text-blue-500 dark:hover:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-800 inline-flex items-center justify-center gap-2" aria-label="Simpan" title="Simpan">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Simpan</span>
                </button>
              </div>

              {/* Kelompok berdasarkan Menu dengan collapse & badge jumlah */}
              <div className="space-y-4">
                {menuGroups.map(group => {
                  const menuPerm = perms.find(p => p.code === group.key);
                  const related = getGroupPerms(group.prefixes);
                  const [open, setOpen] = [true, () => {}]; // static open; dapat diubah ke state lokal jika perlu
                  return (
                    <div key={group.key} className="rounded-xl border border-gray-200 bg-white/80">
                      <div className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-black font-medium">{group.label}</h3>
                          <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">{related.length}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {menuPerm && (
                            <label className="flex items-center gap-2 px-2 py-1 rounded-lg border border-gray-200 bg-white text-black text-xs">
                              <input type="checkbox" checked={!!checked[menuPerm.id]} onChange={()=>toggle(menuPerm.id)} />
                              <span>Akses Menu</span>
                            </label>
                          )}
                        </div>
                      </div>
                      {open && (
                        <div className="px-3 pb-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                          {related.map(p => (
                            <label key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-black shadow-sm hover:border-indigo-300">
                              <input type="checkbox" checked={!!checked[p.id]} onChange={()=>toggle(p.id)} />
                              <span className="text-sm font-medium">{p.name || p.code}</span>
                              <span className="text-xs text-black/60">{p.description || (p.code !== (p.name||'') ? p.code : '')}</span>
                            </label>
                          ))}
                          {related.length === 0 && (
                            <div className="text-sm text-black/70">Tidak ada permissions di grup ini.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Lainnya (yang tidak terkelompok) */}
              <div className="mt-6">
                <h3 className="text-black font-medium mb-2">Lainnya</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {perms.filter(p=> {
                    if (p.code.startsWith('menu_')) return false;
                    return !menuGroups.some(g => g.prefixes.some(pref => p.code.startsWith(pref)));
                  }).map(p => (
                    <label key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-black shadow-sm hover:border-indigo-300">
                      <input type="checkbox" checked={!!checked[p.id]} onChange={()=>toggle(p.id)} />
                      <span className="text-sm font-medium">{p.name || p.code}</span>
                      <span className="text-xs text-black/60">{p.description || (p.code !== (p.name||'') ? p.code : '')}</span>
                    </label>
                  ))}
                  {perms.filter(p=> {
                    if (p.code.startsWith('menu_')) return false;
                    return !menuGroups.some(g => g.prefixes.some(pref => p.code.startsWith(pref)));
                  }).length === 0 && (
                    <div className="text-sm text-black/70">Tidak ada permissions lainnya.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}