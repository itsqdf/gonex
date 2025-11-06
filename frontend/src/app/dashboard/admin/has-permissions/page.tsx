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

  const loadBase = async () => {
    setLoading(true);
    const [rRes, pRes] = await Promise.all([
      fetchJson<PaginatedResponse<Role[]>>(`${API_URL}/roles`),
      fetchJson<PaginatedResponse<Perm[]>>(`${API_URL}/permissions`),
    ]);
    setRoles(Array.isArray(rRes.data) ? rRes.data : []);
    setPerms(Array.isArray(pRes.data) ? pRes.data : []);
    setLoading(false);
    const firstRole = (Array.isArray(rRes.data) ? rRes.data : [])[0]?.id || null;
    setSelectedRole(firstRole);
  };

  const loadRolePerms = async (roleId: number) => {
    const res = await fetchJson<{ data: Perm[] }>(`${API_URL}/permissions/by-role/${roleId}`);
    const ids = new Set<number>((res.data || []).map((p:Perm)=>p.id));
    const next: Record<number, boolean> = {};
    perms.forEach(p => { next[p.id] = ids.has(p.id); });
    setChecked(next);
  };

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (selectedRole) loadRolePerms(selectedRole); }, [selectedRole, perms.length]);

  const toggle = (id:number) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const allSelectedCount = useMemo(()=> Object.values(checked).filter(Boolean).length, [checked]);

  // Kelompok menu dan prefix permissions yang terkait
  const menuGroups = [
    { key: 'menu_master_data', label: 'Master Data', prefixes: ['view','create','edit','detail','delete','reset'] },
    { key: 'menu_hak_akses', label: 'Hak Akses', prefixes: ['manage'] },
    { key: 'menu_kas', label: 'Kas', prefixes: ['kas_masuk_','kas_keluar_','kas_flow_'] },
    { key: 'menu_produk', label: 'Produk', prefixes: ['produk_'] },
    { key: 'menu_setting', label: 'Setting', prefixes: ['rekening_','category_asset_','category_product_'] },
    { key: 'menu_asset_perusahaan', label: 'Asset Perusahaan', prefixes: ['assets_','maintenance_'] },
    { key: 'menu_ruangan', label: 'Ruangan', prefixes: ['warehouses_','racks_','rack_positions_','mutasi_'] },
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
                <button onClick={save} className="ml-auto text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:border-blue-500 dark:text-blue-500 dark:hover:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-800 inline-flex items-center justify-center gap-2" aria-label="Simpan" title="Simpan">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Simpan</span>
                </button>
              </div>

              {/* Kelompok berdasarkan Menu */}
              <div className="space-y-6">
                {menuGroups.map(group => {
                  const menuPerm = perms.find(p => p.code === group.key);
                  const related = getGroupPerms(group.prefixes);
                  return (
                    <div key={group.key}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-black font-medium">{group.label}</h3>
                        {menuPerm && (
                          <label className="flex items-center gap-2 px-2 py-1 rounded-lg border border-gray-200 bg-white text-black text-sm">
                            <input type="checkbox" checked={!!checked[menuPerm.id]} onChange={()=>toggle(menuPerm.id)} />
                            <span>Akses Menu</span>
                          </label>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {related.map(p => (
                          <label key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-black shadow-sm hover:border-indigo-300">
                            <input type="checkbox" checked={!!checked[p.id]} onChange={()=>toggle(p.id)} />
                            <span className="text-sm font-medium">{p.name || p.code}</span>
                            <span className="text-xs text-black/60">{p.description || (p.code !== (p.name||'') ? p.code : '')}</span>
                          </label>
                        ))}
                      </div>
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
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}