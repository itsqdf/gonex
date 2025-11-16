"use client";

import { useEffect, useMemo, useState } from "react";
import { authHeaders, fetchJson, toInputDate, buildQueryParams, PaginatedResponse } from "@/lib/helpers";
import { notifyBell, success, error, warn } from "@/lib/alerts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Opt = { id:number; name:string };
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

export default function SiswaPage() {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [allowed, setAllowed] = useState<boolean>(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jenjangOpts, setJenjangOpts] = useState<Jenjang[]>([]);
  const [kelasOpts, setKelasOpts] = useState<Kelas[]>([]);
  const [form, setForm] = useState<Partial<Student>>({ active: true, gender: "", birthdate: toInputDate(new Date()) });
  const [transferId, setTransferId] = useState<number | null>(null);
  const [transferClassId, setTransferClassId] = useState<number | null>(null);
  const [promoCompanyId, setPromoCompanyId] = useState<number | null>(null);
  const [promoFromJenjangId, setPromoFromJenjangId] = useState<number | null>(null);
  const [promoToJenjangId, setPromoToJenjangId] = useState<number | null>(null);
  const [promoTargetClasses, setPromoTargetClasses] = useState<number[]>([]);
  // modal states
  const [showTransfer, setShowTransfer] = useState(false);
  const [showPromo, setShowPromo] = useState(false);

  const headers = useMemo(() => ({ ...authHeaders(), "x-role": "admin" }), []);

  const loadRefs = async () => {
    try {
      const c = await fetchJson<any>("/companies", { headers });
      const raw = Array.isArray(c?.data) ? c.data : Array.isArray(c?.items) ? c.items : Array.isArray(c?.rows) ? c.rows : Array.isArray(c?.results) ? c.results : (Array.isArray(c) ? c : []);
      const carr: Company[] = raw.map((x:any)=> ({ id: Number(x.id), nama: String(x.nama ?? x.name ?? x.title ?? "") }));
      setCompanies(carr);
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

  const loadStudents = async () => {
    setLoading(true);
    try {
      const qs = buildQueryParams({ q: query || undefined, page, limit });
      const r = await fetch(`${API_URL}/akademik/siswa?${qs}`, { headers });
      const d = await r.json().catch(()=>({}));
      const items = Array.isArray((d as any)?.items) ? (d as any).items : Array.isArray((d as any)?.data) ? (d as any).data : (Array.isArray(d) ? (d as any) : []);
      const tot = Number((d as any)?.total || items.length || 0);
      setStudents(items);
      setTotal(tot);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadRefs(); }, []);
  useEffect(() => { loadStudents(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [query, page, limit]);

  // Permission guard untuk halaman Akademik
  useEffect(() => {
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!tok) { setAllowed(false); return; }
    fetch(`${API_URL}/auth/permissions`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.json().catch(()=>({})))
      .then(d => {
        const perms: string[] = Array.isArray(d?.permissions) ? d.permissions : [];
        setAllowed(perms.includes('menu_akademik') || perms.includes('manage'));
      })
      .catch(() => setAllowed(false));
  }, []);

  const saveStudent = async () => {
    try {
      if (!form.name) { warn("Validasi", "Nama siswa wajib"); return; }
      const payload: any = { ...form };
      // attach readable names
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
      // simpan via API (wajib database)
      const r = await fetch(`${API_URL}/akademik/siswa`, { method: "POST", headers, body: JSON.stringify(payload) });
      const d = await r.json().catch(()=>({}));
      if (!r.ok) { throw new Error((d as any)?.error || `Gagal simpan siswa (${r.status})`); }
      setForm({ active: true, gender: "", birthdate: toInputDate(new Date()) });
      await loadStudents();
      notifyBell("Data Siswa", "Siswa berhasil ditambahkan");
    } catch (e:any) {
      error("Gagal menyimpan", e?.message || "Error");
    }
  };

  const updateStudentApi = async (id:number, payload: Partial<Student>) => {
    const r = await fetch(`${API_URL}/akademik/siswa/${id}`, { method: "PUT", headers, body: JSON.stringify(payload) });
    const d = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error((d as any)?.error || `Gagal update siswa (${r.status})`);
    await loadStudents();
  };

  const transferClass = async () => {
    if (!transferId || !transferClassId) { warn("Validasi", "Pilih siswa dan kelas tujuan"); return; }
    const k = kelasOpts.find(x=>x.id===transferClassId);
    if (!k) { warn("Validasi", "Kelas tujuan tidak valid"); return; }
    await updateStudentApi(transferId, { kelas_id: k.id, kelas_name: k.name });
    success("Siswa dipindahkan");
    setTransferId(null); setTransferClassId(null);
  };

  const generatePromotion = async () => {
    if (!promoCompanyId || !promoFromJenjangId || !promoToJenjangId || promoTargetClasses.length === 0) {
      warn("Validasi", "Lengkapi perusahaan, dari jenjang, ke jenjang, dan kelas tujuan"); return;
    }
    // ambil dari database berdasarkan perusahaan dan jenjang
    const qs = buildQueryParams({ company_id: promoCompanyId || undefined, jenjang_id: promoFromJenjangId || undefined, limit: 2000 });
    const r = await fetch(`${API_URL}/akademik/siswa?${qs}`, { headers });
    const d = await r.json().catch(()=>({}));
    const source: Student[] = Array.isArray((d as any)?.items) ? (d as any).items : Array.isArray(d) ? (d as any) : [];
    if (source.length === 0) { warn("Info", "Tidak ada siswa di jenjang sumber"); return; }
    const sorted = [...source].sort((a,b)=> (Number(b.nilai||0) - Number(a.nilai||0)));
    const tClasses = promoTargetClasses.map(id => kelasOpts.find(k=>k.id===id)).filter(Boolean) as Kelas[];
    if (tClasses.length === 0) { warn("Validasi", "Kelas tujuan tidak ditemukan"); return; }
    // Distribusi acak dan rata berdasarkan gender dan nilai
    const males = sorted.filter(s=> (s.gender||'').toLowerCase().includes('laki'));
    const females = sorted.filter(s=> (s.gender||'').toLowerCase().includes('perem'));
    const assignGroup = (group: Student[]) => {
      const arr = [...group];
      // nilai tinggi dulu agar tersebar
      arr.sort((a,b)=> Number(b.nilai||0) - Number(a.nilai||0));
      const start = Math.floor(Math.random() * tClasses.length);
      arr.forEach((s, i) => {
        const target = tClasses[(start + i) % tClasses.length];
        s.jenjang_id = promoToJenjangId;
        s.jenjang_name = jenjangOpts.find(j=>j.id===promoToJenjangId)?.name || s.jenjang_name || null;
        s.kelas_id = target.id;
        s.kelas_name = target.name;
      });
      return arr;
    };
    const assigned = [ ...assignGroup(males), ...assignGroup(females) ];
    // update ke database per siswa
    for (const s of assigned) {
      await updateStudentApi(s.id, { jenjang_id: s.jenjang_id, jenjang_name: s.jenjang_name, kelas_id: s.kelas_id, kelas_name: s.kelas_name });
    }
    await loadStudents();
    success("Kenaikan kelas digenerate acak dan rata (gender & nilai)");
  };

  const jenjangSpecFields = () => {
    const j = jenjangOpts.find(x=>x.id===form.jenjang_id);
    const kode = j?.name?.toLowerCase() || "";
    // tampilkan field berbeda per jenjang
    if (kode.includes("universitas") || kode.includes("kuliah") || kode.includes("pt")) {
      return (
        <>
          <input value={form.details?.nim || ''} onChange={e=>setForm(f=>({ ...f, details: { ...(f.details||{}), nim: e.target.value } }))} className="border p-2 rounded w-full" placeholder="NIM" />
          <input value={form.details?.prodi || ''} onChange={e=>setForm(f=>({ ...f, details: { ...(f.details||{}), prodi: e.target.value } }))} className="border p-2 rounded w-full" placeholder="Prodi" />
          <input value={form.details?.angkatan || ''} onChange={e=>setForm(f=>({ ...f, details: { ...(f.details||{}), angkatan: e.target.value } }))} className="border p-2 rounded w-full" placeholder="Angkatan" />
        </>
      );
    }
    if (kode.includes("sma") || kode.includes("smu") || kode.includes("ma")) {
      return (
        <>
          <input value={form.details?.jurusan || ''} onChange={e=>setForm(f=>({ ...f, details: { ...(f.details||{}), jurusan: e.target.value } }))} className="border p-2 rounded w-full" placeholder="Jurusan" />
        </>
      );
    }
    // sd/smp
    return (
      <>
        <input value={form.details?.wali_nama || ''} onChange={e=>setForm(f=>({ ...f, details: { ...(f.details||{}), wali_nama: e.target.value } }))} className="border p-2 rounded w-full" placeholder="Nama Wali" />
        <input value={form.details?.wali_phone || ''} onChange={e=>setForm(f=>({ ...f, details: { ...(f.details||{}), wali_phone: e.target.value } }))} className="border p-2 rounded w-full" placeholder="Nomor HP Wali" />
      </>
    );
  };

  const totalPages = Math.max(1, Math.ceil((total || 0) / limit));
  const currentItems = students;

  return (
    <div className="p-4 space-y-4 text-black min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100">
      <h1 className="text-xl font-semibold">Akademik - Data Siswa</h1>
      {!allowed && (
        <div className="rounded-xl border bg-white p-4 text-black">Anda tidak memiliki izin untuk melihat halaman ini.</div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-2">
            <input value={query} onChange={e=>setQuery(e.target.value)} className="border p-2 rounded w-full" placeholder="Cari siswa (nama/jenjang/kelas/perusahaan)..." />
            <div className="flex items-center gap-2">
              <a href="/dashboard/admin/akademik/siswa/tambah" className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow">Tambah Siswa</a>
              <button onClick={()=>setShowTransfer(true)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow">Pindah Kelas</button>
              <button onClick={()=>setShowPromo(true)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-violet-600 hover:bg-violet-700 shadow">Kenaikan Kelas</button>
            </div>
          </div>
          {loading ? <div>Memuat...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Nama</th>
                  <th className="p-2">NISN</th>
                  <th className="p-2">Perusahaan</th>
                  <th className="p-2">Jenjang</th>
                  <th className="p-2">Kelas</th>
                  <th className="p-2">Nilai</th>
                  <th className="p-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map(s => (
                  <tr key={s.id} className="border-b">
                    <td className="p-2">{s.name}</td>
                    <td className="p-2">{s.nisn || '-'}</td>
                    <td className="p-2">{s.company_name || '-'}</td>
                    <td className="p-2">{s.jenjang_name || '-'}</td>
                    <td className="p-2">{s.kelas_name || '-'}</td>
                    <td className="p-2">{s.nilai ?? '-'}</td>
                    <td className="p-2">
                      <button onClick={()=>{ setTransferId(s.id); setTransferClassId(s.kelas_id || null); }} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded">Pindah Kelas</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50">Prev</button>
            <span className="text-sm">Page {page} / {totalPages}</span>
            <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50">Next</button>
            <select value={limit} onChange={e=>setLimit(Number(e.target.value))} className="border p-1 rounded">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
            <h2 className="font-semibold mb-2">Aksi Siswa</h2>
            <p className="text-sm text-gray-700">Gunakan tombol di atas untuk Tambah Siswa, Pindah Kelas, dan Kenaikan Kelas. Form akan muncul sebagai modal ketika tombol diklik.</p>
          </div>
        </div>
      </div>
      {/* Modals */}
      {/* Modal Tambah Siswa dihapus, dialihkan ke halaman baru */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={()=>setShowTransfer(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Pindah Kelas (Manual)</h2>
              <button onClick={()=>setShowTransfer(false)} className="text-gray-600 hover:text-black">Tutup</button>
            </div>
            <div className="space-y-2">
              <select value={transferId||''} onChange={e=>setTransferId(e.target.value? Number(e.target.value) : null)} className="border p-2 rounded w-full">
                <option value="">Pilih Siswa</option>
                {students.map(s=> (<option key={s.id} value={s.id}>{s.name} {s.kelas_name?`• ${s.kelas_name}`:''}</option>))}
              </select>
              <select value={transferClassId||''} onChange={e=>setTransferClassId(e.target.value? Number(e.target.value) : null)} className="border p-2 rounded w-full">
                <option value="">Kelas Tujuan</option>
                {kelasOpts.map(k=> (<option key={k.id} value={k.id}>{k.name} {k.jenjang_name?`• ${k.jenjang_name}`:''}</option>))}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={()=>setShowTransfer(false)} className="px-3 py-1.5 rounded border">Batal</button>
              <button onClick={async()=>{ await transferClass(); setShowTransfer(false); }} className="px-3 py-1.5 rounded bg-indigo-600 text-white">Pindahkan</button>
            </div>
          </div>
        </div>
      )}
      {showPromo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={()=>setShowPromo(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Generate Kenaikan Kelas</h2>
              <button onClick={()=>setShowPromo(false)} className="text-gray-600 hover:text-black">Tutup</button>
            </div>
            <div className="space-y-2">
              <select value={promoCompanyId||''} onChange={e=>setPromoCompanyId(e.target.value? Number(e.target.value) : null)} className="border p-2 rounded w-full">
                <option value="">Pilih Perusahaan</option>
                {companies.map(c=> (<option key={c.id} value={c.id}>{c.nama}</option>))}
              </select>
              <select value={promoFromJenjangId||''} onChange={e=>setPromoFromJenjangId(e.target.value? Number(e.target.value) : null)} className="border p-2 rounded w-full">
                <option value="">Dari Jenjang</option>
                {jenjangOpts.map(j=> (<option key={j.id} value={j.id}>{j.name}</option>))}
              </select>
              <select value={promoToJenjangId||''} onChange={e=>setPromoToJenjangId(e.target.value? Number(e.target.value) : null)} className="border p-2 rounded w-full">
                <option value="">Ke Jenjang</option>
                {jenjangOpts.map(j=> (<option key={j.id} value={j.id}>{j.name}</option>))}
              </select>
              <label className="text-sm text-gray-700">Kelas Tujuan (pilih beberapa)</label>
              <div className="max-h-40 overflow-auto border rounded p-2">
                {kelasOpts.map(k=> (
                  <label key={k.id} className="flex items-center gap-2 py-0.5">
                    <input type="checkbox" checked={promoTargetClasses.includes(k.id)} onChange={e=>{
                      setPromoTargetClasses(arr=> e.target.checked ? [...arr, k.id] : arr.filter(x=>x!==k.id));
                    }} />
                    <span>{k.name} {k.jenjang_name?`• ${k.jenjang_name}`:''}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={()=>setShowPromo(false)} className="px-3 py-1.5 rounded border">Batal</button>
              <button onClick={async()=>{ await generatePromotion(); setShowPromo(false); }} className="px-3 py-1.5 rounded bg-violet-600 text-white">Generate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}