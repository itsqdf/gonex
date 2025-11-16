"use client";

 import React, { useEffect, useMemo, useState } from "react";
import { success, error, warn, notifyBell } from "@/lib/alerts";
import Toggle from "@/components/Toggle";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Announcement = {
  id: number;
  title: string;
  content: string;
  days: string[]; // e.g., ["Senin","Selasa",...]
  time: string; // HH:MM
  date?: string | null; // YYYY-MM-DD (opsional)
  target: "Semua" | "Per Jabatan" | "Per Role";
  jabatan?: string[]; // optional list
  jabatan_all?: boolean; // semua jabatan saat target Per Jabatan
  roles?: string[]; // optional list
  active: boolean;
  company_id?: number | null;
  company_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  global_company?: boolean; // seluruh perusahaan
};

const dayOpts = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];

export default function PengumumanPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [form, setForm] = useState<Partial<Announcement>>({ active: true, days: ["Senin"], time: "08:00", target: "Semua", global_company: false, jabatan_all: false });
  const [query, setQuery] = useState("");
  const [allowed, setAllowed] = useState<boolean>(false);
  const [profile, setProfile] = useState<any>(null);
  const [companies, setCompanies] = useState<{ id:number; nama:string }[]>([]);
  const [productLookup, setProductLookup] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openDetail, setOpenDetail] = useState<Record<number, boolean>>({});

  // Load/save to localStorage for simple persistence
  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("announcements") : null;
    const arr = raw ? JSON.parse(raw) as Announcement[] : [];
    setList(arr);
    // permissions & profile
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (tok) {
      fetch(`${API_URL}/auth/permissions`, { headers: { Authorization: `Bearer ${tok}` } })
        .then(r => r.json())
        .then(d => {
          const perms: string[] = Array.isArray(d.permissions) ? d.permissions : [];
          setAllowed(perms.includes('menu_pengumuman') || perms.includes('manage'));
        })
        .catch(() => setAllowed(false));
      fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${tok}` } })
        .then(r => r.json())
        .then(u => setProfile(u))
        .catch(() => setProfile(null));
      // companies
      fetch(`${API_URL}/companies`, { headers: { Authorization: `Bearer ${tok}` } })
        .then(r => r.json())
        .then(d => {
          const arr = Array.isArray(d) ? d : Array.isArray(d?.companies) ? d.companies : [];
          const list = arr.map((c:any)=>({ id: Number(c.id), nama: String(c.name || c.nama || '') }));
          setCompanies(list);
        })
        .catch(()=>{});
    }
  }, []);

  const saveStorage = (arr: Announcement[]) => {
    localStorage.setItem("announcements", JSON.stringify(arr));
  };

  const setListAndPersist = (updater: (prev: Announcement[]) => Announcement[]) => {
    setList(prev => {
      const next = updater(prev);
      saveStorage(next);
      return next;
    });
  };

  const save = () => {
    try {
      if (!form.title || !form.content) {
        warn("Lengkapi data", "Judul dan isi pengumuman wajib diisi");
        return;
      }
      const baseCompanyName = (() => {
        if (form.global_company) return "Semua Perusahaan";
        const idNum = Number(form.company_id||0);
        const c = companies.find(cc=>cc.id === idNum);
        return c ? c.nama : null;
      })();

      const item: Announcement = {
        id: editingId || Date.now(),
        title: String(form.title),
        content: String(form.content),
        days: Array.isArray(form.days) ? form.days as string[] : [],
        time: String(form.time || "08:00"),
        date: form.date ? String(form.date) : null,
        target: (form.target as any) || "Semua",
        jabatan: Array.isArray(form.jabatan) ? form.jabatan as string[] : [],
        jabatan_all: !!form.jabatan_all,
        roles: Array.isArray(form.roles) ? form.roles as string[] : [],
        active: !!form.active,
        company_id: form.global_company ? null : (form.company_id ? Number(form.company_id as any) : null),
        company_name: form.global_company ? "Semua Perusahaan" : (form.company_name ? String(form.company_name) : baseCompanyName),
        product_code: form.product_code ? String(form.product_code) : null,
        product_name: form.product_name ? String(form.product_name) : null,
        global_company: !!form.global_company,
      };
      const nextList = editingId
        ? list.map(x => x.id === editingId ? item : x)
        : [item, ...list];
      setList(nextList);
      saveStorage(nextList);
      setForm({ active: true, days: ["Senin"], time: "08:00", target: "Semua", global_company: false, jabatan_all: false });
      setEditingId(null);
      success(editingId ? "Pengumuman diperbarui" : "Pengumuman disimpan");
    } catch (e: any) {
      error("Gagal menyimpan", e?.message || "Error");
    }
  };

  const remove = (id: number) => {
    const arr = list.filter(x => x.id !== id);
    setList(arr);
    saveStorage(arr);
    success("Pengumuman dihapus");
  };

  const toggleActive = (id: number, next: boolean) => {
    setListAndPersist(prev => prev.map(it => it.id === id ? { ...it, active: next } : it));
    success(next ? "Pengumuman diaktifkan" : "Pengumuman dimatikan");
  };

  // Client-side scheduler: check every minute; show alert when time matches
  useEffect(() => {
    const key = "announcements_last";
    const timer = setInterval(() => {
      try {
        const arrRaw = localStorage.getItem("announcements");
        const arr: Announcement[] = arrRaw ? JSON.parse(arrRaw) : [];
        if (!Array.isArray(arr) || arr.length === 0) return;
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const timeStr = `${hh}:${mm}`;
        const dayNames = dayOpts;
        const today = dayNames[now.getDay() === 0 ? 6 : now.getDay()-1]; // convert JS day (Sun=0) to array index
        const lastRaw = localStorage.getItem(key);
        const last: Record<string,string> = lastRaw ? JSON.parse(lastRaw) : {};
        for (const it of arr) {
          if (!it.active) continue;
          if (it.days && !it.days.includes(today)) continue;
          if (String(it.time) !== timeStr) continue;
          // RBAC targeting berdasarkan profile
          const userRole = profile?.role;
          const userJabatan = profile?.jabatan;
          let canNotify = it.target === 'Semua';
          if (!canNotify && it.target === 'Per Role') {
            const roles = (it.roles||[]).map(x=>String(x).toLowerCase());
            if (userRole && roles.includes(String(userRole).toLowerCase())) canNotify = true;
          }
          if (!canNotify && it.target === 'Per Jabatan') {
            const all = !!it.jabatan_all;
            if (all) {
              canNotify = true;
            } else {
              const jabs = (it.jabatan||[]).map(x=>String(x).toLowerCase());
              const userJabs = Array.isArray(userJabatan) ? userJabatan : (userJabatan ? [userJabatan] : []);
              if (userJabs.some((j:string)=> jabs.includes(String(j).toLowerCase()))) canNotify = true;
            }
          }
          if (!canNotify) continue;
          const mark = `${it.id}|${timeStr}`;
          if (last[mark]) continue; // already alerted this minute
          // show beautified bell alert including company/product info
          const companyLine = it.company_name ? `<div class="mt-2 text-sm text-gray-700"><strong>Perusahaan:</strong> ${it.company_name}</div>` : "";
          const productLine = it.product_name || it.product_code ? `<div class="mt-1 text-sm text-gray-700"><strong>Produk:</strong> ${it.product_name || ''} ${it.product_code ? `(${it.product_code})` : ''}</div>` : "";
          const body = `<div class="text-sm text-gray-900">${it.content}</div>${companyLine}${productLine}`;
          notifyBell(it.title, body);
          last[mark] = new Date().toISOString();
        }
        localStorage.setItem(key, JSON.stringify(last));
      } catch {}
    }, 60_000);
    return () => clearInterval(timer);
  }, [profile]);

  const filtered = query.trim()
    ? list.filter(x => (`${x.title} ${x.content}`).toLowerCase().includes(query.toLowerCase()))
    : list;

  if (!allowed) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold">Pengumuman</h1>
        <p className="text-sm text-red-600">Akses ditolak. Anda tidak memiliki permission untuk melihat modul ini.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Pengumuman</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <input value={query} onChange={e=>setQuery(e.target.value)} className="px-3 py-2 rounded border w-full" placeholder="Cari pengumuman..." />
          </div>
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Judul</th>
                  <th className="p-2">Hari</th>
                  <th className="p-2">Jam</th>
                  <th className="p-2">Target</th>
                  <th className="p-2">Aktif</th>
                  <th className="p-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(it => (
                  <React.Fragment key={it.id}>
                  <tr className="border-b">
                    <td className="p-2">{it.title}</td>
                    <td className="p-2">{(it.days||[]).join(', ')}</td>
                    <td className="p-2">{it.time}</td>
                    <td className="p-2">{it.target}</td>
                    <td className="p-2">
                      <Toggle
                        checked={!!it.active}
                        size="md"
                        confirmOnDeactivate={true}
                        confirmOnActivate={true}
                        confirmText="Matikan pengumuman ini?"
                        confirmTextActivate="Nyalakan pengumuman ini?"
                        onChange={(next)=>toggleActive(it.id, next)}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <button onClick={()=>setOpenDetail(s=>({ ...s, [it.id]: !s[it.id] }))} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-sky-600 text-white text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"/></svg>
                          <span>Detail</span>
                        </button>
                        <button onClick={()=>{
                          setForm({
                            title: it.title,
                            content: it.content,
                            days: it.days,
                            time: it.time,
                            date: it.date || undefined,
                            target: it.target,
                            jabatan: it.jabatan,
                            jabatan_all: !!it.jabatan_all,
                            roles: it.roles,
                            active: it.active,
                            company_id: it.company_id || undefined,
                            company_name: it.company_name || undefined,
                            product_code: it.product_code || undefined,
                            product_name: it.product_name || undefined,
                            global_company: !!it.global_company,
                          });
                          setEditingId(it.id);
                        }} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500 text-white text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M4 16.5V20h3.5l10-10-3.5-3.5-10 10ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
                          <span>Edit</span>
                        </button>
                        <button onClick={()=>remove(it.id)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-600 text-white text-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 7h12v2H6V7Zm2 3h8l-.7 8.4a2 2 0 0 1-2 1.6H10.7a2 2 0 0 1-2-1.6L8 10Zm3-5h2a2 2 0 0 1 2 2H9a2 2 0 0 1 2-2Z"/></svg>
                          <span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {openDetail[it.id] && (
                    <tr className="bg-indigo-50/40">
                      <td colSpan={6} className="p-3 text-sm text-gray-800">
                        <div className="grid md:grid-cols-3 gap-3">
                          <div>
                            <div className="font-medium">Isi</div>
                            <div className="text-gray-700">{it.content}</div>
                          </div>
                          <div>
                            <div className="font-medium">Perusahaan / Produk</div>
                            <div className="text-gray-700">{it.company_name || '-'}</div>
                            <div className="text-gray-700">{it.product_name || ''} {it.product_code ? `(${it.product_code})` : ''}</div>
                          </div>
                          <div>
                            <div className="font-medium">Target</div>
                            <div className="text-gray-700">{it.target === 'Per Jabatan' ? (it.jabatan_all ? 'Semua Jabatan' : (it.jabatan||[]).join(', ') || '-') : it.target === 'Per Role' ? (it.roles||[]).join(', ') || '-' : 'Semua'}</div>
                            <div className="text-gray-700">Hari: {(it.days||[]).join(', ')}</div>
                            <div className="text-gray-700">Jam: {it.time} {it.date ? `• Tanggal ${it.date}` : ''}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow space-y-2">
            <h2 className="font-semibold">Tambah Pengumuman</h2>
            <input value={form.title || ''} onChange={e=>setForm(f=>({ ...f, title: e.target.value }))} className="border px-2 py-2 rounded w-full" placeholder="Judul" />
            <textarea value={form.content || ''} onChange={e=>setForm(f=>({ ...f, content: e.target.value }))} className="border px-2 py-2 rounded w-full" placeholder="Isi pengumuman" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="relative">
                <select value={String(form.company_id||'')} onChange={e=>{
                  const id = e.target.value ? Number(e.target.value) : null;
                  const nm = companies.find(c=>c.id===id||0)?.nama || null;
                  setForm(f=>({ ...f, company_id: id as any, company_name: nm || undefined }));
                }} className="border px-2 py-2 rounded w-full">
                  <option value="">Pilih perusahaan (opsional)</option>
                  {companies.map(c=> <option key={c.id} value={String(c.id)}>{c.nama}</option>)}
                </select>
              </div>
              <div className="relative">
                <input
                  value={form.product_code || ''}
                  onChange={e=>setForm(f=>({ ...f, product_code: e.target.value }))}
                  onBlur={async ()=>{
                    const tok = localStorage.getItem('token') || '';
                    const code = String(form.product_code||'').trim();
                    if (!code) { setForm(f=>({ ...f, product_name: undefined })); return; }
                    try {
                      const r = await fetch(`${API_URL}/products?q=${encodeURIComponent(code)}`, { headers: { Authorization: `Bearer ${tok}` } });
                      const d = await r.json().catch(()=>({}));
                      const list = Array.isArray(d?.data) ? d.data : (Array.isArray(d) ? d : []);
                      const prd = list.find((p:any)=> String(p.kode||'').toLowerCase() === code.toLowerCase());
                      if (prd) setForm(f=>({ ...f, product_name: prd.nama || '' })); else setForm(f=>({ ...f, product_name: undefined }));
                    } catch {}
                  }}
                  className="border px-2 py-2 rounded w-full"
                  placeholder="Kode produk (opsional)"
                />
                {form.product_name && (<div className="mt-1 text-xs text-gray-600">{form.product_name}</div>)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form.global_company} onChange={e=>setForm(f=>({ ...f, global_company: e.target.checked, company_id: e.target.checked ? null : f.company_id }))} />
                <span>Pengumuman untuk seluruh perusahaan</span>
              </label>
            </div>
            <label className="font-medium text-sm">Hari</label>
            <div className="flex flex-wrap gap-2">
              {dayOpts.map(d => {
                const arr = Array.isArray(form.days) ? form.days as string[] : [];
                const checked = arr.includes(d);
                return (
                  <label key={d} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={checked} onChange={(e)=>{
                      const current = new Set(arr);
                      if (e.target.checked) current.add(d); else current.delete(d);
                      setForm(f=>({ ...f, days: Array.from(current) }));
                    }} />
                    <span>{d}</span>
                  </label>
                );
              })}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm">Jam</label>
                <input type="time" value={form.time || '08:00'} onChange={e=>setForm(f=>({ ...f, time: e.target.value }))} className="border px-2 py-1 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm">Tanggal (opsional)</label>
                <input type="date" value={form.date || ''} onChange={e=>setForm(f=>({ ...f, date: e.target.value }))} className="border px-2 py-1 rounded" />
              </div>
            </div>
            <select value={form.target as any || 'Semua'} onChange={e=>setForm(f=>({ ...f, target: e.target.value as any }))} className="border px-2 py-2 rounded w-full">
              <option>Semua</option>
              <option>Per Jabatan</option>
              <option>Per Role</option>
            </select>
            {form.target === 'Per Jabatan' && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!form.jabatan_all} onChange={e=>setForm(f=>({ ...f, jabatan_all: e.target.checked }))} />
                  <span>Semua Jabatan</span>
                </label>
                {!form.jabatan_all && (
                  <input value={(form.jabatan||[]).join(',')} onChange={e=>setForm(f=>({ ...f, jabatan: e.target.value.split(',').map(x=>x.trim()).filter(Boolean) }))} className="border px-2 py-2 rounded w-full" placeholder="Masukkan daftar jabatan, pisahkan dengan koma" />
                )}
              </div>
            )}
            {form.target === 'Per Role' && (
              <input value={(form.roles||[]).join(',')} onChange={e=>setForm(f=>({ ...f, roles: e.target.value.split(',').map(x=>x.trim()).filter(Boolean) }))} className="border px-2 py-2 rounded w-full" placeholder="Masukkan daftar role, pisahkan dengan koma" />
            )}
            <select value={(form.active ?? true) ? 'Aktif' : 'Tidak Aktif'} onChange={e=>setForm(f=>({ ...f, active: e.target.value === 'Aktif' }))} className="border px-2 py-2 rounded w-full">
              <option>Aktif</option>
              <option>Tidak Aktif</option>
            </select>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={()=>{ setForm({ active: true, days: ["Senin"], time: "08:00", target: "Semua", global_company: false, jabatan_all: false }); setEditingId(null); }} className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center justify-center gap-2">
                <span>Bersihkan</span>
              </button>
              <button type="button" onClick={save} className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{editingId ? 'Update' : 'Simpan'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}