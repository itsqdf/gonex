"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authHeaders, fetchJson, toInputDate } from "@/lib/helpers";
import { notifyBell, warn, error } from "@/lib/alerts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Company = { id:number; nama:string };
type Jenjang = { id:number; name:string };
type Kelas = { id:number; name:string; jenjang_id?:number|null; jenjang_name?:string|null };
type Student = {
  id:number;
  name:string;
  nisn?:string|null;
  gender?:"Laki-Laki"|"Perempuan"|"";
  birthdate?:string|null;
  email?:string|null;
  phone?:string|null;
  address?:string|null;
  company_id?:number|null;
  company_name?:string|null;
  jenjang_id?:number|null;
  jenjang_name?:string|null;
  kelas_id?:number|null;
  kelas_name?:string|null;
  nilai?:number|null;
  details?:Record<string, any> | null;
  active?:boolean;
};

export default function TambahSiswaPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jenjangOpts, setJenjangOpts] = useState<Jenjang[]>([]);
  const [kelasOpts, setKelasOpts] = useState<Kelas[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Student>>({ active: true, gender: "", birthdate: toInputDate(new Date()) });
  const headers = useMemo(() => ({ ...authHeaders(), "x-role": "admin" }), []);

  const loadRefs = async () => {
    try {
      const c = await fetchJson<any>("/companies", { headers });
      const raw = Array.isArray(c?.data) ? c.data : Array.isArray(c?.items) ? c.items : Array.isArray(c?.rows) ? c.rows : Array.isArray(c?.results) ? c.results : (Array.isArray(c) ? c : []);
      setCompanies(raw.map((x:any)=> ({ id: Number(x.id), nama: String(x.nama ?? x.name ?? x.title ?? "") })));
    } catch {}
    try {
      const j = await fetchJson<{ items: Jenjang[] } | Jenjang[]>("/akademik/jenjang", { headers });
      const jarr = Array.isArray((j as any)?.items) ? (j as any).items : (Array.isArray(j) ? (j as any) : []);
      setJenjangOpts(jarr);
    } catch {}
    try {
      const k = await fetchJson<{ items: Kelas[] } | Kelas[]>("/akademik/kelas", { headers });
      const karr = Array.isArray((k as any)?.items) ? (k as any).items : (Array.isArray(k) ? (k as any) : []);
      setKelasOpts(karr);
    } catch {}
  };

  useEffect(() => { loadRefs(); }, []);

  const saveStudent = async () => {
    try {
      if (!form.name) { warn("Validasi", "Nama siswa wajib"); return; }
      setSaving(true);
      const payload: any = { ...form };
      if (payload.company_id && !payload.company_name) {
        const c = companies.find(x=>x.id===payload.company_id);
        if (c) payload.company_name = c.nama;
      }
      if (payload.jenjang_id && !payload.jenjang_name) {
        const j = jenjangOpts.find(x=>x.id===payload.jenjang_id);
        if (j) payload.jenjang_name = j.name;
      }
      if (payload.kelas_id && !payload.kelas_name) {
        const k = kelasOpts.find(x=>x.id===payload.kelas_id);
        if (k) payload.kelas_name = k.name;
      }
      const r = await fetch(`${API_URL}/akademik/siswa`, { method: "POST", headers, body: JSON.stringify(payload) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) { throw new Error((d as any)?.error || `Gagal simpan siswa (${r.status})`); }
      notifyBell("Data Siswa", "Siswa berhasil ditambahkan");
      router.push("/dashboard/admin/akademik/siswa");
    } catch (e:any) {
      error("Gagal menyimpan", e?.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 text-black min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Akademik - Tambah Siswa</h1>
        <a href="/dashboard/admin/akademik/siswa" className="px-3 py-1.5 rounded border">Kembali</a>
      </div>
      <div className="max-w-2xl rounded-2xl bg-white p-4 border shadow space-y-2">
        <div className="grid md:grid-cols-2 gap-2">
          <label className="flex flex-col gap-1"><span>Nama <span className="text-red-600">*</span></span><input value={form.name||''} onChange={e=>setForm(f=>({ ...f, name: e.target.value }))} className="border px-2 py-2 rounded w-full" placeholder="Nama" /></label>
          <label className="flex flex-col gap-1"><span>NISN</span><input value={form.nisn||''} onChange={e=>setForm(f=>({ ...f, nisn: e.target.value }))} className="border px-2 py-2 rounded w-full" placeholder="NISN" /></label>
          <label className="flex flex-col gap-1"><span>Gender</span>
            <select value={form.gender||''} onChange={e=>setForm(f=>({ ...f, gender: e.target.value as any }))} className="border p-2 rounded w-full">
              <option value="">Pilih Gender</option>
              <option>Laki-Laki</option>
              <option>Perempuan</option>
            </select>
          </label>
          <label className="flex flex-col gap-1"><span>Tanggal Lahir</span><input type="date" value={form.birthdate||toInputDate(new Date())} onChange={e=>setForm(f=>({ ...f, birthdate: e.target.value }))} className="border px-2 py-2 rounded w-full" /></label>
          <label className="flex flex-col gap-1"><span>Email</span><input value={form.email||''} onChange={e=>setForm(f=>({ ...f, email: e.target.value }))} className="border px-2 py-2 rounded w-full" placeholder="Email" /></label>
          <label className="flex flex-col gap-1"><span>Nomor HP</span><input value={form.phone||''} onChange={e=>setForm(f=>({ ...f, phone: e.target.value }))} className="border px-2 py-2 rounded w-full" placeholder="Nomor HP" /></label>
          <label className="flex flex-col gap-1 md:col-span-2"><span>Alamat</span><textarea value={form.address||''} onChange={e=>setForm(f=>({ ...f, address: e.target.value }))} className="border px-2 py-2 rounded w-full" placeholder="Alamat" /></label>
          <label className="flex flex-col gap-1"><span>Perusahaan</span>
            <select value={form.company_id||''} onChange={e=>setForm(f=>({ ...f, company_id: e.target.value? Number(e.target.value): undefined }))} className="border p-2 rounded w-full">
              <option value="">Pilih Perusahaan</option>
              {companies.map(c=> (<option key={c.id} value={c.id}>{c.nama}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1"><span>Jenjang</span>
            <select value={form.jenjang_id||''} onChange={e=>setForm(f=>({ ...f, jenjang_id: e.target.value? Number(e.target.value): undefined }))} className="border p-2 rounded w-full">
              <option value="">Pilih Jenjang</option>
              {jenjangOpts.map(j=> (<option key={j.id} value={j.id}>{j.name}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1"><span>Kelas</span>
            <select value={form.kelas_id||''} onChange={e=>setForm(f=>({ ...f, kelas_id: e.target.value? Number(e.target.value): undefined }))} className="border p-2 rounded w-full">
              <option value="">Pilih Kelas</option>
              {kelasOpts.map(k=> (<option key={k.id} value={k.id}>{k.name} {k.jenjang_name?`• ${k.jenjang_name}`:''}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1"><span>Nilai</span><input type="number" value={form.nilai||0} onChange={e=>setForm(f=>({ ...f, nilai: Number(e.target.value) }))} className="border px-2 py-2 rounded w-full" placeholder="Nilai (untuk kenaikan)" /></label>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <a href="/dashboard/admin/akademik/siswa" className="px-3 py-1.5 rounded border">Batal</a>
          <button disabled={saving} onClick={saveStudent} className="px-3 py-1.5 rounded bg-green-600 text-white disabled:opacity-60">{saving? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </div>
    </div>
  );
}