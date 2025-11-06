"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type CashPoint = { bulan: string; pemasukan: number; pengeluaran: number };

export default function AdminIndexPage() {
  const [loading, setLoading] = useState(true);
  const [companiesCount, setCompaniesCount] = useState(0);
  const [jabatanCount, setJabatanCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [cash, setCash] = useState<CashPoint[]>([]);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers = useMemo(() => ({ Authorization: token ? `Bearer ${token}` : "" }), [token]);

  useEffect(() => {
    const run = async () => {
      try {
        // Companies & Jabatan: backend mengembalikan array tanpa pagination
        const [cRes, jRes] = await Promise.all([
          fetch(`${API_URL}/companies`, { headers }),
          fetch(`${API_URL}/jabatan`, { headers }),
        ]);
        const cData = await cRes.json().catch(() => []);
        const jData = await jRes.json().catch(() => []);
        setCompaniesCount(Array.isArray(cData) ? cData.length : 0);
        setJabatanCount(Array.isArray(jData) ? jData.length : 0);

        // Users: coba baca meta.total, fallback ke panjang data jika array
        const uRes = await fetch(`${API_URL}/users?page=1&limit=1`, { headers });
        const uData = await uRes.json().catch(() => ({}));
        const metaTotal = (uData?.meta && typeof uData.meta.total === "number") ? uData.meta.total : undefined;
        const arrLen = Array.isArray(uData?.data) ? uData.data.length : 0;
        setUsersCount(metaTotal ?? arrLen ?? 0);

        // Kas arus: tampilkan 6 titik terakhir jika ada
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const params = new URLSearchParams({
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        });
        const kRes = await fetch(`${API_URL}/kas/arus?${params.toString()}`, { headers });
        const kData = await kRes.json().catch(() => ({}));
        const points: CashPoint[] = Array.isArray(kData?.data) ? kData.data : [];
        setCash(points);
      } catch {}
      setLoading(false);
    };
    run();
  }, [headers]);

  // Hitung total saldo per bulan
  const balances = useMemo(() => cash.map(p => ({ label: p.bulan, saldo: (p.pemasukan || 0) - (p.pengeluaran || 0) })), [cash]);
  const totalIncome = useMemo(() => cash.reduce((a, b) => a + (b.pemasukan || 0), 0), [cash]);
  const totalExpense = useMemo(() => cash.reduce((a, b) => a + (b.pengeluaran || 0), 0), [cash]);
  const totalBalance = useMemo(() => totalIncome - totalExpense, [totalIncome, totalExpense]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">Dashboard Admin</h2>
          <div className="flex items-center gap-2">
            <a href="/dashboard/admin/users" className="px-3 py-1.5 rounded border bg-white text-sm">Kelola Users</a>
            <a href="/dashboard/admin/companies" className="px-3 py-1.5 rounded border bg-white text-sm">Kelola Companies</a>
            <a href="/dashboard/admin/jabatan" className="px-3 py-1.5 rounded border bg-white text-sm">Kelola Jabatan</a>
          </div>
        </div>

        {/* Ringkasan kartu */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard title="Users" value={usersCount} loading={loading} color="bg-blue-600" />
          <SummaryCard title="Companies" value={companiesCount} loading={loading} color="bg-green-600" />
          <SummaryCard title="Jabatan" value={jabatanCount} loading={loading} color="bg-purple-600" />
          <SummaryCard title="Saldo Kas" value={formatIDR(totalBalance)} loading={loading} color="bg-indigo-800" />
        </div>

        {/* Grafik Kas Arus sederhana */}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          <h3 className="text-black font-medium mb-3">Ringkasan Kas 6 Bulan</h3>
          {loading ? (
            <p className="text-sm text-black">Memuat...</p>
          ) : cash.length === 0 ? (
            <p className="text-sm text-black">Tidak ada data kas.</p>
          ) : (
            <Chart balances={balances} />
          )}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded bg-white p-3 border text-sm text-black">Total Pemasukan: {formatIDR(totalIncome)}</div>
            <div className="rounded bg-white p-3 border text-sm text-black">Total Pengeluaran: {formatIDR(totalExpense)}</div>
            <div className="rounded bg-white p-3 border text-sm text-black">Saldo: {formatIDR(totalBalance)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, loading, color }: { title: string; value: number | string; loading: boolean; color: string }) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
      <p className="text-sm text-gray-700">{title}</p>
      <div className="mt-2 flex items-end gap-2">
        <div className={`text-xl font-semibold text-white rounded px-3 py-1 ${color}`}>{loading ? "..." : value}</div>
      </div>
    </div>
  );
}

function Chart({ balances }: { balances: { label: string; saldo: number }[] }) {
  const max = Math.max(1, ...balances.map(b => Math.abs(b.saldo)));
  const height = 160;
  const barW = 32;
  const gap = 16;
  const width = balances.length * (barW + gap) + gap;
  const toY = (v: number) => height - Math.round((Math.abs(v) / max) * height);

  return (
    <svg width={width} height={height + 32} role="img" aria-label="Grafik kas">
      {balances.map((b, i) => {
        const x = gap + i * (barW + gap);
        const y = toY(b.saldo);
        const h = height - y;
        const pos = b.saldo >= 0;
        return (
          <g key={i}>
            <rect x={x} y={pos ? y : height - h} width={barW} height={h} fill={pos ? "#16a34a" : "#dc2626"} rx={6} />
            <text x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize="10" fill="#111827">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function formatIDR(n: number) {
  try { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0); } catch { return String(n); }
}
