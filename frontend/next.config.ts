import type { NextConfig } from "next";
const workspaceRoot = process.cwd(); // set root to current working dir (web/)

const nextConfig: NextConfig = {
  reactCompiler: true,
  outputFileTracingRoot: workspaceRoot,
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    return [
      // Delete service
      { source: '/deletion-logs/:path*', destination: api + '/deletion-logs/:path*' },
      // Auth/User service
      { source: '/users/:path*', destination: api + '/users/:path*' },
      { source: '/roles/:path*', destination: api + '/roles/:path*' },
      { source: '/roles-user/:path*', destination: api + '/roles-user/:path*' },
      { source: '/has-permissions/:path*', destination: api + '/has-permissions/:path*' },
      { source: '/auth/:path*', destination: api + '/auth/:path*' },
      // Setting service
      { source: '/setting/:path*', destination: api + '/setting/:path*' },
      { source: '/companies/:path*', destination: api + '/companies/:path*' },
      { source: '/jabatan/:path*', destination: api + '/jabatan/:path*' },
      // Produk service
      { source: '/produk/:path*', destination: api + '/produk/:path*' },
      { source: '/gudang/:path*', destination: api + '/gudang/:path*' },
      { source: '/mutasi/:path*', destination: api + '/mutasi/:path*' },
      { source: '/posisi/:path*', destination: api + '/posisi/:path*' },
      { source: '/rak/:path*', destination: api + '/rak/:path*' },
      { source: '/recommendations/:path*', destination: api + '/recommendations/:path*' },
      { source: '/maintenance/:path*', destination: api + '/maintenance/:path*' },
      { source: '/assets/:path*', destination: api + '/assets/:path*' },
      { source: '/category-asset/:path*', destination: api + '/category-asset/:path*' },
      { source: '/category-produk/:path*', destination: api + '/category-produk/:path*' },
      { source: '/pembelian/:path*', destination: api + '/pembelian/:path*' },
      // Keuangan service
      { source: '/payment/:path*', destination: api + '/payment/:path*' },
      { source: '/kas/:path*', destination: api + '/kas/:path*' },
      { source: '/arus/:path*', destination: api + '/arus/:path*' },
      { source: '/keluar/:path*', destination: api + '/keluar/:path*' },
      { source: '/masuk/:path*', destination: api + '/masuk/:path*' },
      { source: '/rekening/:path*', destination: api + '/rekening/:path*' },
      // Client service
      { source: '/presensi/:path*', destination: api + '/presensi/:path*' },
      { source: '/absences/:path*', destination: api + '/absences/:path*' },
      { source: '/activities/:path*', destination: api + '/activities/:path*' },
      { source: '/check-in/:path*', destination: api + '/check-in/:path*' },
      { source: '/setting-presensi/:path*', destination: api + '/setting-presensi/:path*' },
    ];
  },
};

export default nextConfig;
