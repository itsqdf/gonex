"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type DailyPoint = { day: string; count: number; avg_late: number };
type StatusPoint = { status: string; count: number };

export default function PresensiAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [byStatus, setByStatus] = useState<StatusPoint[]>([]);
  const [range, setRange] = useState<{ start?: string; end?: string }>({});
  const [jabatans, setJabatans] = useState<{id:number; name:string}[]>([]);
  const [selectedJabatanId, setSelectedJabatanId] = useState<string>("");
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => { load(); }, [range.start, range.end, selectedJabatanId]);

  useEffect(() => {
    const headers: Record<string,string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(`${API_URL}/jabatan?limit=200`, { headers })
      .then(r=>r.json().catch(()=>({})))
      .then(d=>{
        const arr = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : Array.isArray(d?.jabatan) ? d.jabatan : [];
        if (Array.isArray(arr)) setJabatans(arr.map((x:any)=>({ id:x.id, name:x.name })));
      })
      .catch(()=>{});
  }, [token]);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (range.start) params.set("start_date", range.start);
    if (range.end) params.set("end_date", range.end);
    try {
      if (!selectedJabatanId) {
        const r = await fetch(`${API_URL}/presensi/summary?${params.toString()}`);
        const j = await r.json();
        setDaily(Array.isArray(j.daily) ? j.daily : []);
        setByStatus(Array.isArray(j.by_status) ? j.by_status : []);
      } else {
        // filter berdasarkan jabatan: ambil users, ambil check-ins, agregasi di client
        const headers: Record<string,string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const uj = jabatans.find(j=> String(j.id) === selectedJabatanId)?.name || "";
        const uRes = await fetch(`${API_URL}/users?page=1&limit=1000`, { headers });
        const uData = await uRes.json().catch(()=>({}));
        const usersArr: any[] = Array.isArray(uData?.data) ? uData.data : Array.isArray(uData) ? uData : [];
        const idsSet = new Set<number>(usersArr.filter((u:any)=> (u.jabatan || "") === uj).map((u:any)=> Number(u.id)));

        const cRes = await fetch(`${API_URL}/presensi/check-ins?${params.toString()}`);
        const cData = await cRes.json().catch(()=>({}));
        const rows: any[] = Array.isArray(cData?.data) ? cData.data : Array.isArray(cData) ? cData : [];
        const filtered = rows.filter((r:any)=> idsSet.has(Number(r.user_id)));

        const dayMap: Record<string, {count:number; sumLate:number; n:number}> = {};
        const statusMap: Record<string, number> = {};
        filtered.forEach((it:any)=>{
          const ts = (it.ts || it.date || it.created_at || "");
          const day = typeof ts === 'string' ? ts.slice(0,10) : new Date(ts).toISOString().slice(0,10);
          const late = Number(it.late_minutes || 0);
          dayMap[day] = dayMap[day] ? { count: dayMap[day].count+1, sumLate: dayMap[day].sumLate + late, n: dayMap[day].n + 1 } : { count: 1, sumLate: late, n: 1 };
          const st = (it.status || '').toLowerCase();
          statusMap[st] = (statusMap[st] || 0) + 1;
        });
        const dailyArr: DailyPoint[] = Object.keys(dayMap).sort().map(day => ({ day, count: dayMap[day].count, avg_late: Math.round(dayMap[day].sumLate / Math.max(1, dayMap[day].n)) }));
        const statusArr: StatusPoint[] = Object.keys(statusMap).map(s => ({ status: s || 'unknown', count: statusMap[s] }));
        setDaily(dailyArr);
        setByStatus(statusArr);
      }
    } catch {}
    setLoading(false);
  };

  const maxCount = useMemo(() => daily.reduce((m, d) => Math.max(m, d.count || 0), 0), [daily]);
  const colors = ["#4f46e5","#10b981","#f59e0b","#ef4444","#06b6d4"]; // status colors

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg md:text-xl font-semibold text-black">Presensi Analytics</h1>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={range.start||""} onChange={e=>setRange(s=>({ ...s, start: e.target.value }))} className="border rounded px-2 py-1" />
          <span className="text-black/60">s/d</span>
          <input type="date" value={range.end||""} onChange={e=>setRange(s=>({ ...s, end: e.target.value }))} className="border rounded px-2 py-1" />
          <select value={selectedJabatanId} onChange={e=>setSelectedJabatanId(e.target.value)} className="border rounded px-2 py-1">
            <option value="">Keseluruhan</option>
            {jabatans.map(j=> (<option key={j.id} value={String(j.id)}>{j.name}</option>))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-black">Memuat data...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-4 rounded-xl border border-gray-200 bg-white text-black shadow-sm">
            <h2 className="font-medium mb-3">Check-ins Harian</h2>
            <div className="overflow-x-auto">
              <svg width={Math.max(400, daily.length*40)} height={220}>
                {/* axes */}
                <line x1={40} y1={10} x2={40} y2={190} stroke="#9ca3af" />
                <line x1={40} y1={190} x2={Math.max(380, daily.length*40)} y2={190} stroke="#9ca3af" />
                {daily.map((d, i) => {
                  const h = maxCount ? Math.round((d.count/maxCount) * 150) : 0;
                  const x = 50 + i*35;
                  const y = 190 - h;
                  return (
                    <g key={d.day}>
                      <rect x={x} y={y} width={24} height={h} fill="#4f46e5" rx={4} />
                      <text x={x+12} y={200} textAnchor="middle" fontSize={10} fill="#374151">{d.day.slice(5)}</text>
                      <text x={x+12} y={y-4} textAnchor="middle" fontSize={10} fill="#111827">{d.count}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="mt-3 text-sm text-black/70">Avg keterlambatan: {Math.round((daily.reduce((sum, d)=> sum + (d.avg_late||0), 0) / (daily.length||1))||0)} menit</div>
          </div>

          <div className="p-4 rounded-xl border border-gray-200 bg-white text-black shadow-sm">
            <h2 className="font-medium mb-3">Distribusi Status</h2>
            <div className="flex flex-wrap gap-2">
              {byStatus.map((s, i) => (
                <div key={s.status} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl bg-white shadow-sm">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: colors[i%colors.length] }}></span>
                  <span className="text-sm font-medium">{s.status}</span>
                  <span className="text-sm text-black/70">{s.count}</span>
                </div>
              ))}
              {byStatus.length === 0 && (
                <div className="text-sm text-black/70">Tidak ada data status pada rentang ini.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}