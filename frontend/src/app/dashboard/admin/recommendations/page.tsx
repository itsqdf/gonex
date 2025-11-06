"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function RecommendationsPage() {
  const [userId, setUserId] = useState<string>("");
  const [topK, setTopK] = useState<number>(5);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const fetchRecs = async () => {
    if (!userId) { alert("Masukkan user_id"); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/recommendations?user_id=${encodeURIComponent(userId)}&top_k=${topK}`, { headers });
      const d = await r.json().catch(() => ({}));
      setItems(Array.isArray((d as any).items) ? (d as any).items : []);
    } catch (e: any) { alert(e?.message || "Gagal memuat rekomendasi"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">ML Recommendations</h2>
        </div>
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-sm text-gray-700">User ID</label>
              <input value={userId} onChange={e=>setUserId(e.target.value)} className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <label className="text-sm text-gray-700">Top K</label>
              <input type="number" value={topK} onChange={e=>setTopK(Number(e.target.value))} className="px-3 py-2 rounded border w-full" />
            </div>
            <div>
              <button onClick={fetchRecs} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow">
                <span>Ambil Rekomendasi</span>
              </button>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          {loading ? (
            <p className="text-gray-600">Memuat rekomendasi...</p>
          ) : items.length === 0 ? (
            <p className="text-gray-600">Belum ada rekomendasi.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li key={i} className="px-3 py-2 rounded border bg-white text-black">
                  <span>{it.name || it.id}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}