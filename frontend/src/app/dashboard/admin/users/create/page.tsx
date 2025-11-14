"use client";

import { useEffect, useState } from "react";
import { Datepicker } from "flowbite-react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { Label, TextInput, Select } from "flowbite-react";
import FloatingInput from "../../../../../components/FloatingInput";
import FloatingSelect from "../../../../../components/FloatingSelect";
import FloatingDatepicker from "../../../../../components/FloatingDatepicker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function CreateUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nama: "",
    email: "",
    password: "",
    jabatan_id: "",
    status: "Aktif",
  });
  const [saving, setSaving] = useState(false);
  const [jabatans, setJabatans] = useState<{ id:number; name:string }[]>([]);
  // Roles tidak dipilih di form ini; penugasan roles dilakukan via user-roles.

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // Muat daftar Jabatan tanpa bergantung pada token (endpoint tidak butuh auth)
  useEffect(() => {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(`${API_URL}/jabatan?limit=200`, { headers })
      .then(r => r.json().catch(() => ({})))
      .then(d => {
        const arr = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : Array.isArray(d?.jabatan) ? d.jabatan : [];
        if (Array.isArray(arr)) setJabatans(arr.map((x: any) => ({ id: x.id, name: x.name })));
      })
      .catch(() => {});
  }, [token]);

  // Muat daftar Roles (wajib pilih salah satu)
  // Tidak perlu memuat roles di halaman tambah user.

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!form.nama.trim() || !form.email.trim() || !form.password.trim()) {
      Swal.fire({ title: "Gagal", text: "Nama, email, dan password wajib diisi.", icon: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/users`, {
        method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...form,
        active: form.status === "Aktif",
        username: form.email,
        jabatan_id: form.jabatan_id ? Number(form.jabatan_id) : undefined,
      }),
    });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menambah pengguna");
      Swal.fire({ title: "Berhasil", text: "Pengguna ditambahkan", icon: "success" });
      router.push("/dashboard/admin/users");
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
          <h2 className="text-lg font-semibold text-black">Tambah Pengguna</h2>
          <button
            onClick={() => router.push("/dashboard/admin/users")}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-black bg-gray-100 hover:bg-gray-200 border border-gray-200"
            aria-label="Kembali"
            title="Kembali"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.7 7.3a1 1 0 0 1 0 1.4L11.41 13l4.3 4.3a1 1 0 0 1-1.42 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.41 0Z"/></svg>
            <span>Kembali</span>
          </button>
        </div>
        
        <form onSubmit={save} className="rounded-2xl bg-white border border-gray-200 p-6 shadow space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nama */}
            <FloatingInput
              id="nama"
              label="Nama"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              required
            />

            {/* Email */}
            <FloatingInput
              id="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="off"
              required
            />

            {/* Password */}
            <FloatingInput
              id="password"
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              required
            />

            {/* Jabatan (value = ID, label = Nama) */}
            <FloatingSelect
              id="jabatan"
              label="Jabatan"
              value={form.jabatan_id}
              onChange={(e) => setForm({ ...form, jabatan_id: e.target.value })}
              required
              options={[{ value: "", label: "Pilih Jabatan" }, ...jabatans.map(j => ({ value: String(j.id), label: j.name }))]}
            />

          {/* Status */}
          <FloatingSelect
            id="status"
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            required
            options={[{ value: "", label: "Pilih Status" }, { value: "Aktif", label: "Aktif" }, { value: "Tidak Aktif", label: "Tidak Aktif" }]}
          />

          {/* Role tidak diisi di form ini; gunakan halaman manajemen roles-user untuk penugasan. */}

            {/* Detail Lengkap (pelanggan/konsumen/pegawai/guru/siswa/Dapodik) */}
            <div className="col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 peer" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">NIK</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 peer" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">NISN</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 peer" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">NIP</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 peer" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Tempat Lahir</label></div>
          
          <FloatingDatepicker id="tanggal_lahir" label="Tanggal Lahir" />
              <div className="relative"><select className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Pilih</option><option>Laki-laki</option><option>Perempuan</option></select><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Jenis Kelamin</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Agama</label></div>
              <div className="relative col-span-2"><input placeholder="Alamat" className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Alamat</label></div>
              <div className="relative"><input  className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">RT</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">RW</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Kelurahan/Desa</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Kecamatan</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Kabupaten/Kota</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Provinsi</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Kode Pos</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">No HP</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">WhatsApp</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Pendidikan Terakhir</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Sekolah</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Kelas</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Rombel</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Jurusan</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">NPSN</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Tahun Ajaran</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Nama Ayah</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Pekerjaan Ayah</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Nama Ibu</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Pekerjaan Ibu</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Nama Wali</label></div>
              <div className="relative"><input className="block w-full px-3 pb-2.5 pt-4 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Pekerjaan Wali</label></div>
            </div>

          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            
           {/* Tombol Batal */}
<button
  type="button"
  onClick={() => router.push(`/dashboard/admin/users`)}
  className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-red-500 dark:text-red-500 dark:hover:text-white dark:hover:bg-red-600 dark:focus:ring-red-900 inline-flex items-center gap-2"
>
  {/* Icon X */}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
  <span>Batal</span>
</button>

{/* Tombol Simpan */}
<button
  type="submit"
  disabled={saving}
  className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-blue-500 dark:text-blue-500 dark:hover:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
>
  {saving ? (
    <div className="flex items-center justify-center gap-2">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
      Menyimpan...
    </div>
  ) : (
    <span className="flex justify-center items-center gap-2">
      {/* Icon Check */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
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