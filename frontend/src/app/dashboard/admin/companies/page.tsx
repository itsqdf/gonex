"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Company = {
  id: number;
  name: string;
  address?: string | null;
  label?: string | null;
  license_number?: string | null;
  ceo?: string | null;
  since?: string | null; // ISO date
  logo_url?: string | null;
  signature_url?: string | null;
  stamp_url?: string | null;
};

export default function CompaniesPage() {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const [list, setList] = useState<Company[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = useMemo(() => ({ Authorization: token ? `Bearer ${token}` : "" }), [token]);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/companies`, { headers });
      const arr = await res.json().catch(() => []);
      const all: Company[] = Array.isArray(arr) ? arr : [];
      // Client-side filter
      const filtered = query.trim() ? all.filter((c) => c.name?.toLowerCase().includes(query.trim().toLowerCase())) : all;
      // Client-side pagination
      setTotal(filtered.length);
      const pgs = Math.max(1, Math.ceil(filtered.length / limit));
      setPages(pgs);
      const start = (page - 1) * limit;
      setList(filtered.slice(start, start + limit));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchList(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [page, limit, query]);

  // Navigate to dedicated edit page
  const updateCompany = (c: Company) => {
    router.push(`/dashboard/admin/companies/${c.id}/edit`);
  };

  const deleteCompany = async (c: Company) => {
    const ok = await Swal.fire({ title: "Hapus?", text: `Hapus ${c.name}?`, icon: "warning", showCancelButton: true });
    if (!ok.isConfirmed) return;
    try {
      const res = await fetch(`${API_URL}/companies/${c.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        await fetchList();
        Swal.fire({ title: "Berhasil", text: "Perusahaan dihapus.", icon: "success" });
      } else {
        const j = await res.json();
        Swal.fire({ title: "Gagal", text: j.error || "Terjadi kesalahan.", icon: "error" });
      }
    } catch {
      Swal.fire({ title: "Gagal", text: "Tidak dapat terhubung ke server.", icon: "error" });
    }
  };

  const detailCompany = (c: Company) => {
    const img = (url?: string | null, label?: string) => url ? `<div class="flex items-center gap-3"><div class="text-gray-500">${label}</div><img src="${url}" alt="${label}" class="h-10 w-auto rounded border"/></div>` : "";
    const html = `
      <div class="text-left">
        <h3 class="text-base font-semibold text-black mb-2">Detail Perusahaan</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div><div class="text-gray-500">Nama</div><div class="text-black font-medium">${c.name || '-'}</div></div>
          <div><div class="text-gray-500">Label</div><div class="text-black font-medium">${c.label || '-'}</div></div>
          <div><div class="text-gray-500">CEO</div><div class="text-black font-medium">${c.ceo || '-'}</div></div>
          <div><div class="text-gray-500">Sejak</div><div class="text-black font-medium">${c.since ? new Date(c.since).toLocaleDateString() : '-'}</div></div>
          <div class="sm:col-span-2"><div class="text-gray-500">Alamat</div><div class="text-black">${c.address || '-'}</div></div>
          <div class="sm:col-span-2"><div class="text-gray-500">No. Izin</div><div class="text-black">${c.license_number || '-'}</div></div>
        </div>
        <div class="mt-3 flex items-center gap-4">
          ${img(c.logo_url, 'Logo')}
          ${img(c.signature_url, 'Tanda Tangan')}
          ${img(c.stamp_url, 'Stempel')}
        </div>
      </div>
    `;
    Swal.fire({ title: "", html, showConfirmButton: true, confirmButtonText: "Tutup", width: 700 });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Manajemen Perusahaan</h2>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              placeholder="Cari nama perusahaan"
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-black bg-white"
              aria-label="Cari perusahaan"
            />
            <select value={limit} onChange={(e)=>{ setLimit(parseInt(e.target.value,10)); setPage(1); }} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-black bg-white" aria-label="Jumlah per halaman">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <button
              onClick={() => router.push("/dashboard/admin/companies/create")}
              aria-label="Tambah perusahaan"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow"
              title="Tambah"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z" />
              </svg>
              <span>Tambah</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          {loading ? (
            <p className="text-sm text-black">Memuat...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-black">
                    <th className="py-2">Nama</th>
                    <th className="py-2">Label</th>
                    <th className="py-2">CEO</th>
                    <th className="py-2">Sejak</th>
                    <th className="py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="py-2 text-black">{c.name}</td>
                      <td className="py-2 text-black">{c.label || '-'}</td>
                      <td className="py-2 text-black">{c.ceo || '-'}</td>
                      <td className="py-2 text-black">{c.since ? new Date(c.since).toLocaleDateString() : '-'}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => detailCompany(c)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm" aria-label="Detail" title="Detail">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"/></svg>
                            <span>Detail</span>
                          </button>
                          <button onClick={() => updateCompany(c)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-600 text-white text-sm" aria-label="Edit" title="Edit">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm14.71-9.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.99-1.67Z"/></svg>
                            <span>Edit</span>
                          </button>
                          <button onClick={() => deleteCompany(c)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-600 text-white text-sm" aria-label="Hapus" title="Hapus">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6 7h12v2H6V7Zm2 3h8l-.7 8.4a2 2 0 0 1-2 1.6H10.7a2 2 0 0 1-2-1.6L8 10Zm3-5h2a2 2 0 0 1 2 2H9a2 2 0 0 1 2-2Z"/></svg>
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-black">Total: {total} • Halaman: {page}/{Math.max(pages, 1)}</div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-50">Prev</button>
                  <button onClick={()=>setPage(p=>pages?Math.min(pages,p+1):p+1)} disabled={pages ? page>=pages : false} className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-50">Next</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}