"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Company = {
  id: number;
  name: string;
  address?: string | null;
  label?: string | null;
  license_number?: string | null;
  ceo?: string | null;
  since?: string | null;
  logo_url?: string | null;
  signature_url?: string | null;
  stamp_url?: string | null;
};

export default function EditCompanyPage() {
  const router = useRouter();
  const params = useParams() as { id?: string };
  const id = params?.id ? Number(params.id) : NaN;
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [ceo, setCeo] = useState("");
  const [since, setSince] = useState("");
  const [logo, setLogo] = useState<File|null>(null);
  const [signature, setSignature] = useState<File|null>(null);
  const [stamp, setStamp] = useState<File|null>(null);
  const [saving, setSaving] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = useMemo(() => ({ Authorization: token ? `Bearer ${token}` : "" }), [token]);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API_URL}/companies/${id}`, { headers });
        const found: Company = await r.json();
        if (r.ok && found) {
          setCompany(found);
          setName(found.name || "");
          setAddress(found.address || "");
          setLabel(found.label || "");
          setLicenseNumber(found.license_number || "");
          setCeo(found.ceo || "");
          // Normalize date to YYYY-MM-DD for input type=date
          const s = found.since || "";
          let normalized = "";
          if (s) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
              normalized = s;
            } else {
              const d = new Date(s);
              if (!isNaN(d.getTime())) normalized = d.toISOString().slice(0,10);
            }
          }
          setSince(normalized);
        } else { setCompany(null); }
      } catch { setCompany(null); }
      setLoading(false);
    };
    if (!isNaN(id)) load();
  }, [id, headers]);

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
        new Datepicker(el, { autohide: true, format: "yyyy-mm-dd" });
      } catch (err) {
        // Biarkan input native jika gagal
      }
    };
    init();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !token) return;
    const nm = name.trim();
    if (!nm) { Swal.fire({ title: "Validasi", text: "Nama wajib diisi", icon: "warning" }); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("name", nm);
      fd.set("address", address);
      fd.set("label", label);
      fd.set("license_number", licenseNumber);
      fd.set("ceo", ceo);
      fd.set("since", since);
      if (logo) fd.set("logo", logo);
      if (signature) fd.set("signature", signature);
      if (stamp) fd.set("stamp", stamp);
      const r = await fetch(`${API_URL}/companies/${company.id}`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || "Gagal menyimpan");
      Swal.fire({ title: "Berhasil", text: "Perusahaan diperbarui", icon: "success" });
      router.push("/dashboard/admin/companies");
    } catch (e: any) {
      Swal.fire({ title: "Gagal", text: e?.message || "Kesalahan jaringan", icon: "error" });
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Edit Perusahaan</h2>
          <button onClick={() => router.push("/dashboard/admin/companies")} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-black bg-gray-100 hover:bg-gray-200 border border-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.7 7.3a1 1 0 0 1 0 1.4L11.41 13l4.3 4.3a1 1 0 0 1-1.42 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.41 0Z"/></svg>
            <span>Kembali</span>
          </button>
        </div>

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-6 shadow">
          {loading ? (
            <p className="text-sm text-black">Memuat...</p>
          ) : !company ? (
            <p className="text-sm text-black">Data perusahaan tidak ditemukan.</p>
          ) : (
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative z-0">
                  <input type="text" id="name" value={name} onChange={(e)=>setName(e.target.value)} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" required />
                  <label htmlFor="name" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Nama</label>
                </div>
                <div className="relative z-0">
                  <input type="text" id="label" value={label} onChange={(e)=>setLabel(e.target.value)} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
                  <label htmlFor="label" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Label</label>
                </div>
                <div className="relative z-0">
                  <input type="text" id="ceo" value={ceo} onChange={(e)=>setCeo(e.target.value)} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
                  <label htmlFor="ceo" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">CEO</label>
                </div>
                <div className="relative z-0">
                  <input type="text" id="license_number" value={licenseNumber} onChange={(e)=>setLicenseNumber(e.target.value)} placeholder=" " autoComplete="off" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
                  <label htmlFor="license_number" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Nomor Izin</label>
                </div>
                <div className="relative z-0">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20"><path d="M20 4a2 2 0 0 0-2-2h-2V1a1 1 0 0 0-2 0v1h-3V1a1 1 0 0 0-2 0v1H6V1a1 1 0 0 0-2 0v1H2a2 2 0 0 0-2 2v2h20V4ZM0 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8H0v10Zm5-8h10a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Z"/></svg>
                    </div>
                    <input type="date" id="since" value={since} onChange={(e)=>setSince(e.target.value)} placeholder=" " autoComplete="off" className="block w-full ps-10 px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" />
                  </div>
                  <label htmlFor="since" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-placeholder-shown:translate-y-2 peer-placeholder-shown:scale-100 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Sejak</label>
                </div>
              </div>
              <div className="relative z-0">
                <textarea id="address" value={address} onChange={(e)=>setAddress(e.target.value)} placeholder=" " className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent peer" rows={3}></textarea>
                <label htmlFor="address" className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-3 left-3 z-10 origin-[0] bg-white px-1 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-blue-600">Alamat</label>
              </div>

              {/* Uploads */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Logo</label>
                  <input type="file" accept="image/*" onChange={(e)=>setLogo(e.target.files?.[0] || null)} />
                  {company?.logo_url && (<div className="mt-1 text-xs text-gray-600">Saat ini: <a className="text-blue-600 underline" href={company.logo_url} target="_blank" rel="noreferrer">Lihat</a></div>)}
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Signature</label>
                  <input type="file" accept="image/*" onChange={(e)=>setSignature(e.target.files?.[0] || null)} />
                  {company?.signature_url && (<div className="mt-1 text-xs text-gray-600">Saat ini: <a className="text-blue-600 underline" href={company.signature_url} target="_blank" rel="noreferrer">Lihat</a></div>)}
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Stamp</label>
                  <input type="file" accept="image/*" onChange={(e)=>setStamp(e.target.files?.[0] || null)} />
                  {company?.stamp_url && (<div className="mt-1 text-xs text-gray-600">Saat ini: <a className="text-blue-600 underline" href={company.stamp_url} target="_blank" rel="noreferrer">Lihat</a></div>)}
                </div>
              </div>
            <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => router.push(`/dashboard/admin/companies`)} className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>Batal</span>
                </button>
                <button type="submit" disabled={saving} className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
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
          )}
        </div>
      </div>
    </div>
  );
}