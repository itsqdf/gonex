"use client";

import { useEffect, useState } from "react";
import { fmtRupiah, toInputDateTimeLocal } from "@/lib/helpers";
import { Button } from "flowbite-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type FlowSummary = {
  total_masuk: number;
  total_keluar: number;
  saldo: number;
  chart: { month: string; masuk: number; keluar: number }[];
};

export default function ArusKasPage() {
  const [from, setFrom] = useState<string>(toInputDateTimeLocal(new Date()));
  const [to, setTo] = useState<string>(toInputDateTimeLocal(new Date()));
  const [data, setData] = useState<FlowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const loadFlow = async () => {
    if (!token) { setError("Tidak ada token login"); return; }
    setLoading(true); setError("");
    const params = new URLSearchParams();
    try {
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to).toISOString());
      const res = await fetch(`${API_URL}/kas/arus?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json().catch(()=>({}));
      if (!res.ok) { setError(d?.error || "Gagal memuat arus kas"); setData(null); }
      else { setData(d as FlowSummary); }
    } catch (e: any) {
      setError(e?.message || "Kesalahan jaringan");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ loadFlow(); }, []);

  const fmtIDR = (n: number) => new Intl.NumberFormat('id-ID',{minimumFractionDigits:2, maximumFractionDigits:2}).format(n || 0);

  const Chart = () => {
    if (!data || !data.chart || data.chart.length===0) return <p className="text-sm text-black">Tidak ada data grafik</p>;
    const maxVal = Math.max(...data.chart.map(c => Math.max(c.masuk || 0, c.keluar || 0))) || 1;
    const barWidth = 44; const gap = 24; const height = 220; const paddingLeft = 36;
    const width = data.chart.length * (barWidth + gap) + paddingLeft + 16;
    return (
      <svg width={width} height={height + 54} className="bg-white rounded border">
        <line x1={paddingLeft} y1={12} x2={paddingLeft} y2={height+12} stroke="#e5e7eb" />
        <line x1={paddingLeft} y1={height+12} x2={width-12} y2={height+12} stroke="#e5e7eb" />
        {data.chart.map((c, idx) => {
          const x = paddingLeft + idx * (barWidth + gap) + 8;
          const hMasuk = Math.round(((c.masuk || 0) / maxVal) * height);
          const hKeluar = Math.round(((c.keluar || 0) / maxVal) * height);
          return (
            <g key={idx}>
              <rect x={x} y={height+12 - hMasuk} width={barWidth/2 - 4} height={hMasuk} fill="#16a34a" rx={4} />
              <rect x={x + barWidth/2} y={height+12 - hKeluar} width={barWidth/2 - 4} height={hKeluar} fill="#dc2626" rx={4} />
              <text x={x} y={height+32} fontSize={10} fill="#000">{c.month}</text>
            </g>
          );
        })}
        <rect x={width-176} y={18} width={10} height={10} fill="#16a34a" />
        <text x={width-160} y={27} fontSize={10} fill="#000">Masuk</text>
        <rect x={width-100} y={18} width={10} height={10} fill="#dc2626" />
        <text x={width-84} y={27} fontSize={10} fill="#000">Keluar</text>
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Arus Kas</h2>
        </div>

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="relative">
              <input type="datetime-local" value={from} onChange={e=>setFrom(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent" />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Dari Tanggal</label>
            </div>
            <div className="relative">
              <input type="datetime-local" value={to} onChange={e=>setTo(e.target.value)} className="peer px-3 py-3 rounded-lg border border-gray-300 text-sm text-black bg-white w-full placeholder-transparent"  />
              <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Sampai Tanggal</label>
            </div>
            <div>
              <Button onClick={loadFlow} color="yellow" outline size="sm">Terapkan</Button>
            </div>
          </div>
          {error && (
            <div className="mt-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded px-3 py-2">{error}</div>
          )}
        </div>

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          {loading || !data ? (
            <p className="text-sm text-black">Memuat...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-white border">
                <div className="text-xs text-gray-600">Total Masuk</div>
                <div className="text-lg font-semibold text-green-700">{fmtRupiah(data.total_masuk)}</div>
              </div>
              <div className="p-4 rounded-lg bg-white border">
                <div className="text-xs text-gray-600">Total Keluar</div>
                <div className="text-lg font-semibold text-red-700">{fmtRupiah(data.total_keluar)}</div>
              </div>
              <div className="p-4 rounded-lg bg-white border">
                <div className="text-xs text-gray-600">Saldo</div>
                <div className="text-lg font-semibold text-black">{fmtRupiah(data.saldo)}</div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          <h3 className="text-black font-medium mb-2">Grafik Bulanan</h3>
          {loading || !data ? <p className="text-sm text-black">Memuat...</p> : <Chart />}
        </div>
      </div>
    </div>
  );
}