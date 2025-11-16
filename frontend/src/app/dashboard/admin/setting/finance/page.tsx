"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { authHeaders } from "@/lib/helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

type FinanceSettings = {
  discount_enabled: boolean;
  discount_percent: number; // 0-100
  discount_apply_to: string[]; // ["penjualan","spp_bulanan","daftar_ulang"]
  vat_enabled: boolean;
  vat_percent: number; // 0-100
  vat_apply_to: string[]; // ["penjualan","spp_bulanan","daftar_ulang"]
  admin_only: boolean; // hanya admin (manage) yang boleh edit
  valid_from?: string | null;
  valid_until?: string | null;
};

const defaultSettings: FinanceSettings = {
  discount_enabled: false,
  discount_percent: 0,
  discount_apply_to: ["penjualan"],
  vat_enabled: false,
  vat_percent: 0,
  vat_apply_to: ["penjualan"],
  admin_only: false,
};

export default function FinanceSettingsPage() {
  const [allowed, setAllowed] = useState<boolean>(true);
  const [canEdit, setCanEdit] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [form, setForm] = useState<FinanceSettings>(defaultSettings);
  const [discountInput, setDiscountInput] = useState<string>("0");
  const [vatInput, setVatInput] = useState<string>("0");
  const [validFrom, setValidFrom] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { ...authHeaders(), "Content-Type": "application/json" } as any;

  useEffect(() => {
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!tok) { setAllowed(false); return; }
    Promise.all([
      fetch(`${API_URL}/auth/permissions`, { headers: { Authorization: `Bearer ${tok}` } }).then(r=>r.json().catch(()=>({}))).catch(()=>({})),
      fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${tok}` } }).then(r=>r.json().catch(()=>null)).catch(()=>null)
    ]).then(([permResp, meResp]) => {
      const perms: string[] = Array.isArray(permResp?.permissions) ? permResp.permissions : [];
      const canMenu = perms.includes('menu_setting') || perms.includes('manage');
      let allow = canMenu;
      let admin = perms.includes('manage');
      // Fallback dev: jika superadmin terdeteksi dari /auth/me, izinkan
      const role = (meResp as any)?.role || (meResp as any)?.roles?.[0] || '';
      if (!allow && typeof role === 'string' && role.toLowerCase().includes('superadmin')) {
        allow = true; admin = true;
      }
      setAllowed(allow);
      setCanEdit(admin);
    }).catch(() => { setAllowed(false); setCanEdit(false); });
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/settings/finance`, { headers });
      const d = await r.json().catch(()=>({}));
      if (d && typeof d === 'object' && (d.discount_enabled !== undefined || d.vat_enabled !== undefined)) {
        const next = { ...defaultSettings, ...d } as FinanceSettings;
        setForm(next);
        setDiscountInput(String(Math.max(0, Math.min(100, Number(next.discount_percent||0)))));
        setVatInput(String(Math.max(0, Math.min(100, Number(next.vat_percent||0)))));
        setValidFrom(next.valid_from ? String(next.valid_from).substring(0,16) : "");
        setValidUntil(next.valid_until ? String(next.valid_until).substring(0,16) : "");
      } else {
        // fallback: localStorage
        const s = typeof window !== 'undefined' ? localStorage.getItem('finance_settings') : null;
        if (s) {
          const j = { ...defaultSettings, ...JSON.parse(s) } as FinanceSettings;
          setForm(j);
          setDiscountInput(String(Math.max(0, Math.min(100, Number(j.discount_percent||0)))));
          setVatInput(String(Math.max(0, Math.min(100, Number(j.vat_percent||0)))));
          setValidFrom(j.valid_from ? String(j.valid_from).substring(0,16) : "");
          setValidUntil(j.valid_until ? String(j.valid_until).substring(0,16) : "");
        }
      }
    } catch {
      const s = typeof window !== 'undefined' ? localStorage.getItem('finance_settings') : null;
      if (s) {
        const j = { ...defaultSettings, ...JSON.parse(s) } as FinanceSettings;
        setForm(j);
        setDiscountInput(String(Math.max(0, Math.min(100, Number(j.discount_percent||0)))));
        setVatInput(String(Math.max(0, Math.min(100, Number(j.vat_percent||0)))));
        setValidFrom(j.valid_from ? String(j.valid_from).substring(0,16) : "");
        setValidUntil(j.valid_until ? String(j.valid_until).substring(0,16) : "");
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!canEdit && form.admin_only) {
      return Swal.fire({ title: "Tidak Diizinkan", text: "Hanya admin yang boleh menyimpan pengaturan ini.", icon: "warning" });
    }
    const discountVal = Math.max(0, Math.min(100, Number(discountInput==='' ? 0 : discountInput)));
    const vatVal = Math.max(0, Math.min(100, Number(vatInput==='' ? 0 : vatInput)));
    const payload: FinanceSettings = {
      ...form,
      discount_percent: discountVal,
      vat_percent: vatVal,
      valid_from: validFrom ? new Date(validFrom).toISOString() : null,
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
    };
    try {
      const r = await fetch(`${API_URL}/settings/finance`, { method: "PUT", headers, body: JSON.stringify(payload) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(d?.error || `Gagal menyimpan (${r.status})`);
      Swal.fire({ title: "Tersimpan", text: "Pengaturan Diskon & PPN disimpan.", icon: "success", timer: 1200, showConfirmButton: false });
    } catch (e:any) {
      // fallback localStorage
      if (typeof window !== 'undefined') localStorage.setItem('finance_settings', JSON.stringify(payload));
      Swal.fire({ title: "Tersimpan Lokal", text: e?.message || "Disimpan di localStorage (server tidak tersedia)", icon: "info" });
    }
  };

  const toggleApply = (key: 'discount_apply_to'|'vat_apply_to', val: string) => {
    setForm(s => {
      const cur = new Set(s[key]);
      if (cur.has(val)) cur.delete(val); else cur.add(val);
      return { ...s, [key]: Array.from(cur) } as FinanceSettings;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Setting Diskon & PPN</h2>
          <div className="flex items-center gap-2">
            <button onClick={load} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow">Refresh</button>
          </div>
        </div>

        {!allowed && (
          <div className="rounded-xl border bg-white p-4 text-black mb-4">Anda tidak memiliki izin untuk melihat halaman ini.</div>
        )}

        {allowed && (
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <h3 className="text-black font-medium mb-2">Konfigurasi</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3 flex items-center gap-3">
              <label className="flex items-center gap-2 px-2 py-1 rounded-lg border bg-white text-black text-sm">
                <input type="checkbox" checked={form.admin_only} onChange={e=>setForm(s=>({ ...s, admin_only: e.target.checked }))} />
                <span>Hanya Admin boleh edit</span>
              </label>
              <span className="text-xs text-black/60">Admin terdeteksi dari permission 'manage'</span>
            </div>

            <div className="md:col-span-3">
              <div className="rounded-xl border bg-white p-3">
                <h4 className="text-black font-medium mb-2">Diskon</h4>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.discount_enabled} onChange={e=>setForm(s=>({ ...s, discount_enabled: e.target.checked }))} />
                  <span>Aktifkan Diskon</span>
                </label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="text-sm text-gray-700">Diskon (%)</label>
                    <input type="number" min={0} max={100} value={discountInput} onChange={e=>setDiscountInput(e.target.value)} onBlur={()=>{
                      const v = Math.max(0, Math.min(100, Number(discountInput===''?0:discountInput)));
                      setDiscountInput(String(v));
                      setForm(s=>({ ...s, discount_percent: v }));
                    }} className="px-3 py-2 rounded border w-full" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-700">Terapkan ke</label>
                    <div className="flex flex-wrap gap-2">
                      {['penjualan','spp_bulanan','daftar_ulang'].map(t=> (
                        <label key={t} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={form.discount_apply_to.includes(t)} onChange={()=>toggleApply('discount_apply_to', t)} />
                          <span>{t.replace('_',' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-3">
              <div className="rounded-xl border bg-white p-3">
                <h4 className="text-black font-medium mb-2">PPN</h4>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.vat_enabled} onChange={e=>setForm(s=>({ ...s, vat_enabled: e.target.checked }))} />
                  <span>Aktifkan PPN</span>
                </label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="text-sm text-gray-700">PPN (%)</label>
                    <input type="number" min={0} max={100} value={vatInput} onChange={e=>setVatInput(e.target.value)} onBlur={()=>{
                      const v = Math.max(0, Math.min(100, Number(vatInput===''?0:vatInput)));
                      setVatInput(String(v));
                      setForm(s=>({ ...s, vat_percent: v }));
                    }} className="px-3 py-2 rounded border w-full" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-700">Terapkan ke</label>
                    <div className="flex flex-wrap gap-2">
                      {['penjualan','spp_bulanan','daftar_ulang'].map(t=> (
                        <label key={t} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={form.vat_apply_to.includes(t)} onChange={()=>toggleApply('vat_apply_to', t)} />
                          <span>{t.replace('_',' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="md:col-span-3 mt-3">
            <div className="rounded-xl border bg-white p-3">
              <h4 className="text-black font-medium mb-2">Masa Berlaku</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-sm text-gray-700">Berlaku Dari</label>
                  <input type="datetime-local" value={validFrom} onChange={e=>setValidFrom(e.target.value)} className="px-3 py-2 rounded border w-full mt-1" />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Berakhir Pada</label>
                  <input type="datetime-local" value={validUntil} onChange={e=>setValidUntil(e.target.value)} className="px-3 py-2 rounded border w-full mt-1" />
                </div>
              </div>
              <p className="text-xs text-black/70 mt-2">Diskon & PPN diterapkan hanya untuk transaksi penjualan dalam rentang waktu ini.</p>
            </div>
          </div>

          <div className="mt-4">
            <button disabled={form.admin_only && !canEdit} onClick={save} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow disabled:opacity-60">Simpan</button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}