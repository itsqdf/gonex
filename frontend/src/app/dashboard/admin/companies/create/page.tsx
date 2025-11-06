"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type CompanyForm = {
  nama: string;
  alamat: string;
  label: string;
  nomor_izin: string;
  ceo: string;
  since: string; // YYYY-MM-DD
  logo?: File | null;
  signature?: File | null;
  stamp?: File | null;
};

export default function CreateCompanyPage() {
  const router = useRouter();
  const [company, setCompany] = useState<CompanyForm>({ nama: "", alamat: "", label: "", nomor_izin: "", ceo: "", since: "", logo: null, signature: null, stamp: null });
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
      const fd = new FormData();
      fd.set("name", company.nama);
      if (company.alamat) fd.set("address", company.alamat);
      if (company.label) fd.set("label", company.label);
      if (company.nomor_izin) fd.set("license_number", company.nomor_izin);
      if (company.ceo) fd.set("ceo", company.ceo);
      if (company.since) fd.set("since", company.since);
      if (company.logo) fd.set("logo", company.logo);
      if (company.signature) fd.set("signature", company.signature);
      if (company.stamp) fd.set("stamp", company.stamp);
      const res = await fetch(`${API_URL}/companies`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
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

  // Inisialisasi Flowbite Datepicker (lokal dari node_modules)
  useEffect(() => {
    const init = async () => {
      if (typeof window === "undefined") return;
      const el = document.getElementById("since") as HTMLInputElement | null;
      if (!el) return;
      try {
        await import("flowbite");
        const mod = await import("flowbite-datepicker");
        const Datepicker = (mod as any).default || (mod as any).Datepicker;
        // Format YYYY-MM-DD agar konsisten dengan backend
        new Datepicker(el, { autohide: true, format: "yyyy-mm-dd" });
      } catch (err) {
        // Diamkan jika gagal load, input native tetap bekerja
      }
    };
    init();
  }, []);

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
              <input type="text" id="label" value={company.label} onChange={(e)=>setCompany({ ...company, label: e.target.value })} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
              <label htmlFor="label" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Label</label>
            </div>

            {/* CEO */}
            <div className="relative z-0">
              <input type="text" id="ceo" value={company.ceo} onChange={(e)=>setCompany({ ...company, ceo: e.target.value })} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
              <label htmlFor="ceo" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">CEO</label>
            </div>

            {/* Nomor Izin */}
            <div className="relative z-0">
              <input type="text" id="nomor_izin" value={company.nomor_izin} onChange={(e)=>setCompany({ ...company, nomor_izin: e.target.value })} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
              <label htmlFor="nomor_izin" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Nomor Izin</label>
            </div>

            {/* Sejak (Since) */}
            <div className="relative z-0">
              <div className="relative max-w-sm">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path d="M20 4a2 2 0 0 0-2-2h-2V1a1 1 0 0 0-2 0v1h-3V1a1 1 0 0 0-2 0v1H6V1a1 1 0 0 0-2 0v1H2a2 2 0 0 0-2 2v2h20V4ZM0 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8H0v10Zm5-8h10a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Z"/></svg>
                </div>
                <input type="date" id="since" value={company.since} onChange={(e)=>setCompany({ ...company, since: e.target.value })} placeholder="Select date" autoComplete="off" className="block w-full ps-10 p-2.5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <label htmlFor="since" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Sejak</label>
            </div>
          </div>

          {/* Alamat */}
          <div className="relative z-0">
            <textarea id="alamat" value={company.alamat} onChange={(e)=>setCompany({ ...company, alamat: e.target.value })} placeholder=" " className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" rows={3}></textarea>
            <label htmlFor="alamat" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Alamat</label>
          </div>

          {/* Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Logo</label>
              <input type="file" accept="image/*" onChange={(e)=>setCompany({ ...company, logo: e.target.files?.[0] || null })} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Signature</label>
              <input type="file" accept="image/*" onChange={(e)=>setCompany({ ...company, signature: e.target.files?.[0] || null })} />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Stamp</label>
              <input type="file" accept="image/*" onChange={(e)=>setCompany({ ...company, stamp: e.target.files?.[0] || null })} />
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