"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Company = {
  nama: string;
  label: string;
  alamat: string;
  kota: string;
  provinsi: string;
  nomor: string;
  kode: string;
  ceo: string;
  since: string;
  signature: string;
  stamp: string;
};

export default function CreateCompanyPage() {
  const router = useRouter();
  const [company, setCompany] = useState<Company>({
    nama: "",
    label: "",
    alamat: "",
    kota: "",
    provinsi: "",
    nomor: "",
    kode: "",
    ceo: "",
    since: "",
    signature: "",
    stamp: "",
  });
  const [saving, setSaving] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!company.nama || !company.nama.trim()) {
      Swal.fire({ title: "Gagal", text: "Nama perusahaan wajib diisi.", icon: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(company),
      });
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json")
        ? await res.json().catch(()=>({}))
        : await res.text().catch(()=>"");
      if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.error) || "Gagal menambah perusahaan");
      Swal.fire({ title: "Berhasil", text: "Perusahaan ditambahkan", icon: "success" });
      router.push("/dashboard/admin/companies");
    } catch (err: any) {
      Swal.fire({ title: "Gagal", text: err.message, icon: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Tambah Perusahaan</h2>
          <button
            onClick={() => router.push("/dashboard/admin/companies")}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-black bg-gray-100 hover:bg-gray-200 border border-gray-200"
            aria-label="Kembali"
            title="Kembali"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.7 7.3a1 1 0 0 1 0 1.4L11.41 13l4.3 4.3a1 1 0 0 1-1.42 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.41 0Z"/></svg>
            <span>Kembali</span>
          </button>
        </div>

        <form onSubmit={save} className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-6 shadow space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nama */}
            <div className="relative z-0">
              <input
                type="text"
                id="nama"
                value={company.nama}
                onChange={(e)=>setCompany({ ...company, nama: e.target.value })}
                placeholder=" "
                autoComplete="off"
                className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer"
                required
              />
              <label htmlFor="nama" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Nama</label>
            </div>

            {/* Label */}
            <div className="relative z-0">
              <input
                type="text"
                id="label"
                value={company.label}
                onChange={(e)=>setCompany({ ...company, label: e.target.value })}
                placeholder=" "
                autoComplete="off"
                className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer"
              />
              <label htmlFor="label" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Label</label>
            </div>

            {/* Kota */}
            <div className="relative z-0">
              <input type="text" id="kota" value={company.kota} onChange={(e)=>setCompany({ ...company, kota: e.target.value })} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
              <label htmlFor="kota" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Kota</label>
            </div>

            {/* Provinsi */}
            <div className="relative z-0">
              <input type="text" id="provinsi" value={company.provinsi} onChange={(e)=>setCompany({ ...company, provinsi: e.target.value })} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
              <label htmlFor="provinsi" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Provinsi</label>
            </div>

            {/* Kode */}
            <div className="relative z-0">
              <input type="text" id="kode" value={company.kode} onChange={(e)=>setCompany({ ...company, kode: e.target.value })} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
              <label htmlFor="kode" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Kode</label>
            </div>

            {/* CEO */}
            <div className="relative z-0">
              <input type="text" id="ceo" value={company.ceo} onChange={(e)=>setCompany({ ...company, ceo: e.target.value })} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
              <label htmlFor="ceo" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">CEO</label>
            </div>

            {/* Sejak */}
            <div className="relative z-0">
              <input type="text" id="since" value={company.since} onChange={(e)=>setCompany({ ...company, since: e.target.value })} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
              <label htmlFor="since" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Sejak</label>
            </div>

            {/* Nomor */}
            <div className="relative z-0">
              <input type="text" id="nomor" value={company.nomor} onChange={(e)=>setCompany({ ...company, nomor: e.target.value })} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
              <label htmlFor="nomor" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Nomor</label>
            </div>

            {/* Alamat */}
            <div className="relative z-0 md:col-span-2">
              <input type="text" id="alamat" value={company.alamat} onChange={(e)=>setCompany({ ...company, alamat: e.target.value })} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
              <label htmlFor="alamat" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Alamat</label>
            </div>

            {/* Signature */}
            <div className="relative z-0">
              <input type="text" id="signature" value={company.signature} onChange={(e)=>setCompany({ ...company, signature: e.target.value })} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
              <label htmlFor="signature" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Signature (teks/URL)</label>
            </div>

            {/* Stamp */}
            <div className="relative z-0">
              <input type="text" id="stamp" value={company.stamp} onChange={(e)=>setCompany({ ...company, stamp: e.target.value })} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
              <label htmlFor="stamp" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Stamp (teks/URL)</label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {/* Batal */}
            <button
              type="button"
              onClick={() => router.push(`/dashboard/admin/companies`)}
              className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 inline-flex items-center gap-2"
              aria-label="Batal"
              title="Batal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              <span>Batal</span>
            </button>

            {/* Simpan */}
            <button
              type="submit"
              disabled={saving}
              className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              aria-label="Simpan"
              title="Simpan"
            >
              {saving ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Menyimpan...
                </div>
              ) : (
                <span className="flex justify-center items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Simpan
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}