"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { Label, TextInput, Select, FileInput, Button, Datepicker } from "flowbite-react";
import FloatingInput from "../../../../../../components/FloatingInput";
import FloatingSelect from "../../../../../../components/FloatingSelect";
import FloatingDatepicker from "../../../../../../components/FloatingDatepicker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type User = {
  id: number;
  nama: string;
  email: string;
  status: string;
  jabatan: string;
  avatar?: string;
  identitas?: string;
};

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [jabatans, setJabatans] = useState<{ id:number; name:string }[]>([]);
  const [selectedJabatanId, setSelectedJabatanId] = useState<string>("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    if (token && id) {
      fetch(`${API_URL}/users/${id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => setUser(data.user || data))
        .catch(() => {});
    }
  }, [id, token]);

  // Muat jabatan tanpa mewajibkan token
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

  // Sinkronisasi selectedJabatanId dengan nama jabatan user saat data tersedia
  useEffect(() => {
    if (user && jabatans.length > 0) {
      const found = jabatans.find(j => j.name === user.jabatan);
      setSelectedJabatanId(found ? String(found.id) : "");
    }
  }, [user, jabatans]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nama: user.nama,
          email: user.email,
          jabatan_id: selectedJabatanId ? Number(selectedJabatanId) : undefined,
          active: user.status === "Aktif",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan");
      Swal.fire({ title: "Berhasil", text: "Perubahan disimpan", icon: "success" });
      router.push("/dashboard/admin/users");
    } catch (err: any) {
      Swal.fire({ title: "Gagal", text: err.message, icon: "error" });
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (field: "avatar" | "identitas", file: File) => {
    if (!file || !token) return;
    const fd = new FormData();
    fd.append("file", file);
    const url = `${API_URL}/users/${id}/${field}`;
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Gagal upload ${field}`);
    Swal.fire({ title: "Berhasil", text: `${field} diupload`, icon: "success" });
    // refresh user
    const r2 = await fetch(`${API_URL}/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    const d2 = await r2.json();
    setUser(d2.user || d2);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-6 shadow">
            <p className="text-black">Memuat...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Edit Pengguna</h2>
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

     <form
  onSubmit={save}
  className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-6 shadow-lg space-y-6"
>
  {/* === Input Grid === */}
  {/* === Data Diri === */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  {/* Nama */}
  <FloatingInput
    id="nama"
    label="Nama"
    value={user.nama}
    onChange={(e) => setUser({ ...(user as User), nama: e.target.value })}
    required
  />

  {/* Email */}
  <FloatingInput
    id="email"
    label="Email"
    type="email"
    value={user.email}
    onChange={(e) => setUser({ ...(user as User), email: e.target.value })}
    required
  />

  {/* Jabatan (value = ID, label = Nama) */}
  <FloatingSelect
    id="jabatan"
    label="Jabatan"
    value={selectedJabatanId}
    onChange={(e) => {
      const val = e.target.value;
      setSelectedJabatanId(val);
      const f = jabatans.find(j => String(j.id) === val);
      setUser({ ...(user as User), jabatan: f ? f.name : "" });
    }}
    options={[{ value: "", label: "Pilih Jabatan" }, ...jabatans.map(j => ({ value: String(j.id), label: j.name }))]}
  />

  {/* Status */}
  <FloatingSelect
    id="status"
    label="Status"
    value={user.status}
    onChange={(e) => setUser({ ...(user as User), status: e.target.value })}
    options={[{ value: "Aktif", label: "Aktif" }, { value: "Tidak Aktif", label: "Tidak Aktif" }]}
  />

  
</div>


  {/* === Detail Lengkap (Pelanggan/Konsumen/Pegawai/Guru/Siswa/Dapodik) === */}
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
    <div className="relative"><input placeholder="NIK" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">NIK</label></div>
    <div className="relative"><input placeholder="NISN" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">NISN</label></div>
    <div className="relative"><input placeholder="NIP" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">NIP</label></div>
    <div className="relative"><input placeholder="Tempat Lahir" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Tempat Lahir</label></div>
          <FloatingDatepicker id="tanggal_lahir" label="Tanggal Lahir" />
    <div className="relative"><select className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Pilih</option><option>Laki-laki</option><option>Perempuan</option></select><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Jenis Kelamin</label></div>
    <div className="relative"><input placeholder="Agama" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Agama</label></div>
    <div className="relative md:col-span-2"><input placeholder="Alamat" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Alamat</label></div>
    <div className="relative"><input placeholder="RT" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">RT</label></div>
    <div className="relative"><input placeholder="RW" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">RW</label></div>
    <div className="relative"><input placeholder="Kelurahan/Desa" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Kelurahan/Desa</label></div>
    <div className="relative"><input placeholder="Kecamatan" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Kecamatan</label></div>
    <div className="relative"><input placeholder="Kabupaten/Kota" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Kabupaten/Kota</label></div>
    <div className="relative"><input placeholder="Provinsi" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Provinsi</label></div>
    <div className="relative"><input placeholder="Kode Pos" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Kode Pos</label></div>
    <div className="relative"><input placeholder="No HP" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">No HP</label></div>
    <div className="relative"><input placeholder="WhatsApp" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">WhatsApp</label></div>
    <div className="relative"><input placeholder="Pendidikan Terakhir" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Pendidikan Terakhir</label></div>
    <div className="relative"><input placeholder="Sekolah" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Sekolah</label></div>
    <div className="relative"><input placeholder="Kelas" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Kelas</label></div>
    <div className="relative"><input placeholder="Rombel" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Rombel</label></div>
    <div className="relative"><input placeholder="Jurusan" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Jurusan</label></div>
    <div className="relative"><input placeholder="NPSN" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">NPSN</label></div>
    <div className="relative"><input placeholder="Tahun Ajaran" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Tahun Ajaran</label></div>
    <div className="relative"><input placeholder="Nama Ayah" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Nama Ayah</label></div>
    <div className="relative"><input placeholder="Pekerjaan Ayah" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Pekerjaan Ayah</label></div>
    <div className="relative"><input placeholder="Nama Ibu" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Nama Ibu</label></div>
    <div className="relative"><input placeholder="Pekerjaan Ibu" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Pekerjaan Ibu</label></div>
    <div className="relative"><input placeholder="Nama Wali" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Nama Wali</label></div>
    <div className="relative"><input placeholder="Pekerjaan Wali" className="block w-full px-3 pb-2.5 pt-5 text-sm text-gray-900 bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" /><label className="absolute text-xs text-gray-500 -translate-y-4 scale-75 top-3 left-3 bg-white px-1">Pekerjaan Wali</label></div>
  </div>


  {/* === Tombol Aksi === */}
  <div className="flex justify-end gap-3 pt-4">
    {/* Tombol Batal */}
<button
  type="button"
  onClick={() => router.push("/dashboard/admin/users")}
  className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center gap-2 transition-all duration-200 dark:border-red-500 dark:text-red-500 dark:hover:text-white dark:hover:bg-red-600 dark:focus:ring-red-900"
>
  {/* Icon X */}
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-5 h-5"
  >
    <path d="M6 18L18 6M6 6l12 12" />
  </svg>
  <span>Batal</span>
</button>

{/* Tombol Simpan */}
<button
  type="submit"
  disabled={saving}
  className="text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed dark:border-blue-500 dark:text-blue-500 dark:hover:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-800"
>
  {saving ? (
    <>
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
      <span>Menyimpan...</span>
    </>
  ) : (
    <>
      {/* Icon Check */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
      <span>Simpan</span>
    </>
  )}
</button>

  </div>
</form>

      </div>
    </div>
  );
}