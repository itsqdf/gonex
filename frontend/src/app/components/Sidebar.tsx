"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar as FSidebar } from "flowbite-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function Sidebar() {
  // Gunakan alias bertipe any untuk menghindari error properti static pada sub-komponen Flowbite Sidebar
  const S: any = FSidebar;
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [perms, setPerms] = useState<string[]>([]);
  const [openMaster, setOpenMaster] = useState(true);
  const [openAccess, setOpenAccess] = useState(true);
  const [openKas, setOpenKas] = useState(true);
  const [openProduk, setOpenProduk] = useState(true);
  const [openRuangan, setOpenRuangan] = useState(true);
  const [openSetting, setOpenSetting] = useState(true);
  const [openAsset, setOpenAsset] = useState(true);
  const [openPresensi, setOpenPresensi] = useState(true);
  const [openPayment, setOpenPayment] = useState(true);
  const [openChat, setOpenChat] = useState(true);
  const [openML, setOpenML] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    setLoggedIn(!!tok);
    // fetch permissions untuk gating menu
    if (tok) {
      fetch(`${API_URL}/auth/permissions`, { headers: { Authorization: `Bearer ${tok}` } })
        .then(r => r.json())
        .then(d => { if (Array.isArray(d.permissions)) setPerms(d.permissions as string[]); })
        .catch(() => {});
      // fetch profile untuk menampilkan nama • role
      fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${tok}` } })
        .then(r => r.json())
        .then(u => { if (u && u.email) setProfile(u); })
        .catch(() => {});
    }
  }, []);

  // Close sidebar when route changes via menu click
  useEffect(() => {
    if (open) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Sidebar ditampilkan selalu; SessionGuard pada layout akan mengarahkan
  // user ke login jika tidak ada sesi yang valid.

  const isActive = (href: string) => pathname.startsWith(href);

  const group = (
    title: string,
    items: { href: string; label: string; }[],
    collapsed: boolean,
    onToggle: () => void
  ) => (
    <div className="mb-2">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-2 text-xs uppercase tracking-wider text-white/90 hover:bg-white/10 rounded-md">
        <span>{title}</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`}><path d="M12 15.5 5.5 9l1.4-1.4L12 12.7l5.1-5.1L18.5 9z"/></svg>
      </button>
      {collapsed ? null : (
        <div className="mt-1 space-y-1">
          {items.map(it => (
            <Link key={it.href} href={it.href} className={`flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10 ${isActive(it.href) ? 'bg-white/15 text-white font-semibold' : ''}`} onClick={() => setOpen(false)}>
              <span className={`inline-block w-2 h-2 rounded-full ${isActive(it.href) ? 'bg-white' : 'bg-white/60'}`}></span>
              <span>{it.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  const canShowMaster = perms.includes('menu_master_data') || perms.includes('manage');
  const canShowAccess = perms.includes('menu_hak_akses') || perms.includes('manage');
  const canShowKas = perms.includes('menu_kas') || perms.includes('manage');
  const canShowProduk = perms.includes('menu_produk') || perms.includes('manage');
  const canShowRuangan = perms.includes('menu_ruangan') || perms.includes('manage');
  const canShowSetting = perms.includes('menu_setting') || perms.includes('manage');
  const canShowAsset = perms.includes('menu_asset_perusahaan') || perms.includes('manage');
  const canShowPresensi = perms.includes('menu_presensi') || perms.includes('manage');
  const canShowPayment = perms.includes('menu_payment') || perms.includes('manage');
  const canShowChat = perms.includes('menu_chat') || perms.includes('manage');
  const canShowML = perms.includes('menu_ml') || perms.includes('manage');
  const canShowClient = perms.includes('menu_client') || perms.includes('manage');
  const canShowUserBiometrics = perms.includes('menu_user_biometrics') || perms.includes('manage');

  const handleLogout = () => {
    localStorage.removeItem('token');
    // Hapus cookie juga
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push('/login');
  };

  return (
    <>
      {/* Toggle button */}
      <button aria-label="Toggle Sidebar" onClick={() => setOpen(o => !o)} className="fixed top-3 left-3 z-40 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 text-white shadow hover:bg-indigo-500">
        {open ? (
          // close icon (X)
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6.225 4.811a1 1 0 0 0-1.414 1.414L10.586 12l-5.775 5.775a1 1 0 0 0 1.414 1.414L12 13.414l5.775 5.775a1 1 0 0 0 1.414-1.414L13.414 12l5.775-5.775a1 1 0 0 0-1.414-1.414L12 10.586 6.225 4.811Z"/></svg>
        ) : (
          // hamburger icon
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M3 6a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm0 6a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm1 5a1 1 0 0 0 0 2h16a1 1 0 1 0 0-2H4Z"/></svg>
        )}
      </button>

      {/* Overlay when open on small screens */}
      {open && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30" onClick={() => setOpen(false)} />}

      <div className={`fixed z-40 top-0 left-0 h-full w-72 overflow-y-auto transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Guard terhadap perubahan API Flowbite: fallback markup sederhana jika sub-komponen tidak tersedia */}
        {S && S.Items && S.ItemGroup ? (
          <S aria-label="Main Navigation" className="h-full overflow-y-auto">
            <S.Items>
              <S.ItemGroup>
                <div className="px-2 py-3">
                  <div className="flex items-center gap-3">
                    <img src="/golang_ac.png" alt="Golang Logo" className="h-8 w-8" />
                    <div>
                      <Link href="/dashboard/admin" className="block text-base font-semibold" onClick={() => setOpen(false)}>Apps Super</Link>
                      <p className="text-xs text-gray-500">Go + Next.js</p>
                      {profile && (
                        <p className="mt-1 text-xs text-gray-600">{profile.nama} • {profile.role}</p>
                      )}
                    </div>
                  </div>
                </div>
                {canShowMaster && group('Master Data', [
                  { href: '/dashboard/admin/users', label: 'Users' },
                  { href: '/dashboard/admin/companies', label: 'Companies' },
                  { href: '/dashboard/admin/jabatan', label: 'Jabatan' },
                  ...(canShowClient ? [{ href: '/dashboard/admin/clients', label: 'Clients' }] : []),
                ], openMaster, () => setOpenMaster(o=>!o))}
              {canShowAccess && group('Hak Akses', [
                  { href: '/dashboard/admin/roles', label: 'Roles' },
                  { href: '/dashboard/admin/permissions', label: 'Permissions' },
                  { href: '/dashboard/admin/roles-user', label: 'Roles User' },
                  { href: '/dashboard/admin/has-permissions', label: 'Has Permissions' },
                ], openAccess, () => setOpenAccess(o=>!o))}
              {canShowKas && group('Kas', [
                  { href: '/dashboard/admin/kas/masuk', label: 'Kas Masuk' },
                  { href: '/dashboard/admin/kas/keluar', label: 'Kas Keluar' },
                  { href: '/dashboard/admin/kas/arus', label: 'Arus Kas' },
                ], openKas, () => setOpenKas(o=>!o))}
              {canShowProduk && group('Produk', [
                  { href: '/dashboard/admin/produk', label: 'Daftar Produk' },
                  { href: '/dashboard/admin/produk/pembelian', label: 'Pembelian' },
                ], openProduk, () => setOpenProduk(o=>!o))}
              {canShowRuangan && group('Ruangan', [
                  { href: '/dashboard/admin/ruangan/gudang', label: 'Gudang' },
                  { href: '/dashboard/admin/ruangan/rak', label: 'Rak' },
                  { href: '/dashboard/admin/ruangan/posisi', label: 'Posisi Rak' },
                  { href: '/dashboard/admin/ruangan/mutasi', label: 'Mutasi Barang' },
                ], openRuangan, () => setOpenRuangan(o=>!o))}
              {canShowSetting && group('Setting', [
                  { href: '/dashboard/admin/setting/rekening', label: 'Rekening' },
                  { href: '/dashboard/admin/setting/category-asset', label: 'Category Asset' },
                  { href: '/dashboard/admin/setting/category-produk', label: 'Category Produk' },
                ], openSetting, () => setOpenSetting(o=>!o))}
              {canShowAsset && group('Asset Perusahaan', [
                  { href: '/dashboard/admin/assets', label: 'Assets' },
                  { href: '/dashboard/admin/maintenance', label: 'Maintenance Asset' },
                ], openAsset, () => setOpenAsset(o=>!o))}
              {canShowPresensi && group('Presensi', [
                  { href: '/dashboard/admin/presensi/absences', label: 'Absen' },
                  { href: '/dashboard/admin/presensi/settings', label: 'Setting Presensi' },
                  { href: '/dashboard/admin/presensi/activities', label: 'Schedule Presensi' },
                  { href: '/dashboard/admin/presensi/check-in', label: 'Check In/Out' },
                  { href: '/dashboard/admin/presensi/analytics', label: 'Analytics' },
                  ...(canShowUserBiometrics ? [{ href: '/dashboard/admin/presensi/user-biometrics', label: 'User Biometrics' }] : []),
                ], openPresensi, () => setOpenPresensi(o=>!o))}
              {canShowPayment && group('Payment', [
                  { href: '/dashboard/admin/payment', label: 'Transaksi' },
                ], openPayment, () => setOpenPayment(o=>!o))}
              {canShowChat && group('Chat', [
                  { href: '/dashboard/admin/chat', label: 'Obrolan' },
                ], openChat, () => setOpenChat(o=>!o))}
              {canShowML && group('Rekomendasi', [
                  { href: '/dashboard/admin/recommendations', label: 'ML Recommendations' },
                ], openML, () => setOpenML(o=>!o))}
              {perms.includes('manage') && (
                <S.Item href="/dashboard/admin/history-penghapusan" onClick={() => setOpen(false)} className={isActive('/dashboard/admin/history-penghapusan') ? 'font-semibold' : ''}>History Penghapusan</S.Item>
              )}
                <div className="px-2 py-3">
                  <button onClick={handleLogout} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M16 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h-2V5H6v14h8v-2h2Zm2.293-9.707 3.5 3.5a1 1 0 0 1 0 1.414l-3.5 3.5-1.414-1.414L18.586 12l-1.707-1.707 1.414-1.414ZM11 11h9v2h-9v-2Z"/></svg>
                    <span>Logout</span>
                  </button>
                </div>
              </S.ItemGroup>
            </S.Items>
          </S>
        ) : (
          <nav className="h-full bg-indigo-700 text-white overflow-y-auto">
            <div className="px-2 py-3">
              <div className="flex items-center gap-3">
                <img src="/golang_ac.png" alt="Golang Logo" className="h-8 w-8" />
                <div>
                  <Link href="/dashboard/admin" className="block text-base font-semibold" onClick={() => setOpen(false)}>Apps Super</Link>
                  <p className="text-xs text-indigo-100">Go + Next.js</p>
                  {profile && (
                    <p className="mt-1 text-xs text-indigo-100/90">{profile.nama} • {profile.role}</p>
                  )}
                </div>
              </div>
            </div>
            {/* Fallback menu sederhana tanpa Flowbite */}
            <div className="px-2 space-y-2">
              {canShowMaster && group('Master Data', [
                { href: '/dashboard/admin/users', label: 'Users' },
                { href: '/dashboard/admin/companies', label: 'Companies' },
                { href: '/dashboard/admin/jabatan', label: 'Jabatan' },
                ...(canShowClient ? [{ href: '/dashboard/admin/clients', label: 'Clients' }] : []),
              ], openMaster, () => setOpenMaster(o=>!o))}

              {canShowAccess && group('Hak Akses', [
                { href: '/dashboard/admin/roles', label: 'Roles' },
                { href: '/dashboard/admin/permissions', label: 'Permissions' },
                { href: '/dashboard/admin/roles-user', label: 'Roles User' },
                { href: '/dashboard/admin/has-permissions', label: 'Has Permissions' },
              ], openAccess, () => setOpenAccess(o=>!o))}

              {canShowKas && group('Kas', [
                { href: '/dashboard/admin/kas/masuk', label: 'Kas Masuk' },
                { href: '/dashboard/admin/kas/keluar', label: 'Kas Keluar' },
                { href: '/dashboard/admin/kas/arus', label: 'Arus Kas' },
              ], openKas, () => setOpenKas(o=>!o))}

              {canShowProduk && group('Produk', [
                { href: '/dashboard/admin/produk', label: 'Daftar Produk' },
                { href: '/dashboard/admin/produk/pembelian', label: 'Pembelian' },
              ], openProduk, () => setOpenProduk(o=>!o))}

              {canShowRuangan && group('Ruangan', [
                { href: '/dashboard/admin/ruangan/gudang', label: 'Gudang' },
                { href: '/dashboard/admin/ruangan/rak', label: 'Rak' },
                { href: '/dashboard/admin/ruangan/posisi', label: 'Posisi Rak' },
                { href: '/dashboard/admin/ruangan/mutasi', label: 'Mutasi Barang' },
              ], openRuangan, () => setOpenRuangan(o=>!o))}

              {canShowSetting && group('Setting', [
                { href: '/dashboard/admin/setting/rekening', label: 'Rekening' },
                { href: '/dashboard/admin/setting/category-asset', label: 'Category Asset' },
                { href: '/dashboard/admin/setting/category-produk', label: 'Category Produk' },
              ], openSetting, () => setOpenSetting(o=>!o))}

              {canShowAsset && group('Asset Perusahaan', [
                { href: '/dashboard/admin/assets', label: 'Assets' },
                { href: '/dashboard/admin/maintenance', label: 'Maintenance Asset' },
              ], openAsset, () => setOpenAsset(o=>!o))}

              {canShowPresensi && group('Presensi', [
                { href: '/dashboard/admin/presensi/absences', label: 'Absen' },
                { href: '/dashboard/admin/presensi/settings', label: 'Setting Presensi' },
                { href: '/dashboard/admin/presensi/activities', label: 'Schedule Presensi' },
                { href: '/dashboard/admin/presensi/check-in', label: 'Check In/Out' },
                { href: '/dashboard/admin/presensi/analytics', label: 'Analytics' },
                ...(canShowUserBiometrics ? [{ href: '/dashboard/admin/presensi/user-biometrics', label: 'User Biometrics' }] : []),
              ], openPresensi, () => setOpenPresensi(o=>!o))}

              {canShowPayment && group('Payment', [
                { href: '/dashboard/admin/payment', label: 'Transaksi' },
              ], openPayment, () => setOpenPayment(o=>!o))}

              {canShowChat && group('Chat', [
                { href: '/dashboard/admin/chat', label: 'Obrolan' },
              ], openChat, () => setOpenChat(o=>!o))}

              {canShowML && group('Rekomendasi', [
                { href: '/dashboard/admin/recommendations', label: 'ML Recommendations' },
              ], openML, () => setOpenML(o=>!o))}

              {perms.includes('manage') && (
                <Link href="/dashboard/admin/history-penghapusan" onClick={() => setOpen(false)} className={`block px-4 py-2 rounded-lg hover:bg-white/10 ${isActive('/dashboard/admin/history-penghapusan') ? 'bg-white/15 text-white font-semibold' : ''}`}>History Penghapusan</Link>
              )}

              <div className="px-2 py-3">
                <button onClick={handleLogout} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-500">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M16 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h-2V5H6v14h8v-2h2Zm2.293-9.707 3.5 3.5a1 1 0 0 1 0 1.414l-3.5 3.5-1.414-1.414L18.586 12l-1.707-1.707 1.414-1.414ZM11 11h9v2h-9v-2Z"/></svg>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </nav>
        )}
      </div>
    </>
  );
}