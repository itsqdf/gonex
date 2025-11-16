"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { authHeaders, fetchJson } from "@/lib/helpers";
import { success, error, warn } from "@/lib/alerts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Jadwal = { id:number; company_id?:number|null; company_name?:string|null; kelas_id?:number|null; kelas_name?:string|null; guru_id?:number|null; guru_name?:string|null; mapel_id?:number|null; mapel_name?:string|null; day?:string; start?:string; end?:string };
type Company = { id:number; nama:string };

export default function JadwalPage() {
  const [list, setList] = useState<Jadwal[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = useMemo(() => ({ ...authHeaders(), "x-role": "admin" }), [token]);

  const loadCompanies = async () => {
    try {
      const r = await fetch(`${API_URL}/companies`, { headers });
      const d = await r.json().catch(()=>[]);
      if (Array.isArray(d)) setCompanies(d.map((c:any)=>({ id: Number(c.id), nama: String(c.name || c.nama || '') })));
    } catch {}
  };

  const load = async () => {
    setLoading(true);
    try {
      const url = companyId ? `/akademik/jadwal?company_id=${companyId}` : "/akademik/jadwal";
      const data = await fetchJson<{ items: Jadwal[] } | Jadwal[]>(url, { headers });
      const arr = Array.isArray((data as any)?.items) ? (data as any).items : (Array.isArray(data) ? (data as any) : []);
      const filtered = query.trim()
        ? arr.filter((x:Jadwal)=>`${x.company_name||''} ${x.kelas_name||''} ${x.mapel_name||''} ${x.guru_name||''} ${x.day||''}`.toLowerCase().includes(query.toLowerCase()))
        : arr;
      setList(filtered);
    } catch (e:any) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadCompanies(); load(); }, []);
  useEffect(() => { load(); }, [companyId]);

  const build = async () => {
    if (!companyId) return warn('Validasi', 'Pilih perusahaan dulu');
    try {
      const comp = companies.find(c=>c.id===companyId);
      const payload = { company_id: companyId, company_name: comp?.nama || null };
      const res = await fetch(`${API_URL}/akademik/jadwal/build`, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      const detail = await res.json().catch(()=>({ ok: true }));
      await load();
      const created = typeof detail?.created_count === 'number' ? detail.created_count : undefined;
      if (created === 0) {
        warn('Tidak ada jadwal dibuat', 'Periksa guru, mapel, time slot, dan kategori kelas.');
      } else {
        success('Jadwal dibuat', created ? `Baris dibuat: ${created}` : undefined);
      }
    } catch (e:any) {
      error('Gagal membangun jadwal', e?.message || 'Error');
    }
  };

  const exportExcel = async () => {
    try {
      if (!companyId) return warn('Validasi', 'Pilih perusahaan dulu');
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Jadwal');
      ws.columns = [
        { header: 'Hari', key: 'day', width: 12 },
        { header: 'Mulai', key: 'start', width: 10 },
        { header: 'Selesai', key: 'end', width: 10 },
        { header: 'Kelas', key: 'kelas', width: 20 },
        { header: 'Mapel', key: 'mapel', width: 20 },
        { header: 'Guru', key: 'guru', width: 20 },
        { header: 'Perusahaan', key: 'company', width: 22 },
      ];
      const dayOrder = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
      const palette = ['FFCCE5FF','FFFFE5CC','FFE5FFCC','FFE5CCE5','FFCCE5CC','FFFFCCE5','FFCCFFE5','FFE5FF99','FFFFCC99'];
      const colorMap = new Map<string,string>();
      const getColor = (key:string) => {
        if (!colorMap.has(key)) colorMap.set(key, palette[colorMap.size % palette.length]);
        return colorMap.get(key)!;
      };
      const rows = [...list].sort((a,b)=> {
        const ai = dayOrder.indexOf(a.day || '');
        const bi = dayOrder.indexOf(b.day || '');
        if (ai !== bi) return ai - bi;
        return String(a.start||'').localeCompare(String(b.start||''));
      });
      rows.forEach(it => {
        const row = ws.addRow({ day: it.day || '-', start: it.start || '-', end: it.end || '-', kelas: it.kelas_name || '-', mapel: it.mapel_name || '-', guru: it.guru_name || '-', company: it.company_name || '-' });
        const key = `${it.guru_name||''}|${it.mapel_name||''}`;
        const fg = getColor(key);
        row.eachCell((cell:any)=> {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fg } };
        });
      });
      ws.getRow(1).font = { bold: true };
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Jadwal.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success('Excel diekspor');
    } catch (e:any) {
      error('Gagal ekspor Excel', e?.message || 'Error');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Akademik - Build Jadwal</h1>
      <div className="flex items-center gap-2">
        <select value={companyId ?? ''} onChange={e=>setCompanyId(e.target.value ? Number(e.target.value) : null)} className="border p-2 rounded">
          <option value="">Pilih Perusahaan</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
        </select>
        <button onClick={build} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>Build Jadwal</span>
        </button>
        <input value={query} onChange={e=>setQuery(e.target.value)} className="px-3 py-2 rounded border ml-auto w-64" placeholder="Cari jadwal" />
        <button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-blue-600 hover:bg-blue-700 shadow">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <span>Export Excel</span>
        </button>
      </div>
      {loading ? <div>Memuat...</div> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Perusahaan</th>
              <th className="p-2">Kelas</th>
              <th className="p-2">Mapel</th>
              <th className="p-2">Guru</th>
              <th className="p-2">Hari</th>
              <th className="p-2">Mulai</th>
              <th className="p-2">Selesai</th>
            </tr>
          </thead>
          <tbody>
            {list.slice((page-1)*limit, page*limit).map(it => (
              <tr key={it.id} className="border-b">
                <td className="p-2">{it.company_name || '-'}</td>
                <td className="p-2">{it.kelas_name || '-'}</td>
                <td className="p-2">{it.mapel_name || '-'}</td>
                <td className="p-2">{it.guru_name || '-'}</td>
                <td className="p-2">{it.day || '-'}</td>
                <td className="p-2">{it.start || '-'}</td>
                <td className="p-2">{it.end || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="text-sm">Total: {list.length}</div>
        <div className="flex items-center gap-2">
          <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
          <span className="text-sm">Hal {page}</span>
          <button disabled={page*limit>=list.length} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          <select value={limit} onChange={e=>{ setLimit(Number(e.target.value)); setPage(1); }} className="border rounded px-2 py-1 text-sm">
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  );
}