'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Button } from 'flowbite-react';
import { fetchJson, PaginatedResponse, buildQueryParams } from '@/lib/helpers';

export interface DataTableColumn<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  endpoint: string;
  columns: DataTableColumn<T>[];
  searchPlaceholder?: string;
  onAdd?: () => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onExport?: () => void;
  addLabel?: string;
  exportLabel?: string;
  className?: string;
}

export default function DataTable<T extends { id: number | string }>({
  endpoint,
  columns,
  searchPlaceholder = "Cari...",
  onAdd,
  onEdit,
  onDelete,
  onExport,
  addLabel = "Tambah",
  exportLabel = "Export CSV",
  className = ""
}: DataTableProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = buildQueryParams({ page, limit, q: search });
      const response: any = await fetchJson<any>(`${endpoint}${params}`);

      // Flexible parsing for various API shapes
      let items: T[] = [];
      let metaTotal = 0;
      let metaPages = 0;

      if (response && Array.isArray(response.data)) {
        items = response.data as T[];
        metaTotal = response?.meta?.total ?? items.length;
        metaPages = response?.meta?.pages ?? Math.max(1, Math.ceil(metaTotal / limit));
      } else if (Array.isArray(response)) {
        // Direct array response
        items = response as T[];
        metaTotal = items.length;
        metaPages = Math.max(1, Math.ceil(metaTotal / limit));
      } else if (response && typeof response === 'object') {
        // Try common plural keys
        const possibleKeys = ['roles', 'permissions', 'users', 'items', 'data', 'jabatans', 'jabatan'];
        const keyWithArray = possibleKeys.find((k) => Array.isArray(response[k]));
        if (keyWithArray) {
          items = response[keyWithArray] as T[];
          metaTotal = response?.meta?.total ?? items.length;
          metaPages = response?.meta?.pages ?? Math.max(1, Math.ceil(metaTotal / limit));
        } else {
          // Fallback: no recognizable array -> empty
          items = [];
          metaTotal = 0;
          metaPages = 0;
        }
      }

      setData(items);
      setTotal(metaTotal);
      setPages(metaPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, search, limit]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleDelete = async (item: T) => {
    if (!onDelete) return;
    const ok = await Swal.fire({
      title: 'Hapus data?',
      text: 'Data akan dihapus permanen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus',
      cancelButtonText: 'Batal'
    });
    if (!ok.isConfirmed) return;
    try {
      onDelete(item);
      await loadData();
      await Swal.fire({ title: 'Berhasil', text: 'Data dihapus', icon: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data');
      await Swal.fire({ title: 'Gagal', text: err instanceof Error ? err.message : 'Gagal menghapus data', icon: 'error' });
    }
  };

  const renderCell = (item: T, column: DataTableColumn<T>) => {
    if (column.render) {
      return column.render(item);
    }
    const value = item[column.key as keyof T];
    return value?.toString() || '';
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </form>
          
          <div className="flex items-center gap-2">
            {onExport && (
              <Button onClick={onExport} color="yellow" outline size="sm" className="inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 3a1 1 0 0 1 1 1v8h3l-4 4-4-4h3V4a1 1 0 0 1 1-1Zm-7 14a2 2 0 0 1 2-2h2a1 1 0 1 1 0 2H7v2h10v-2h-2a1 1 0 1 1 0-2h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3Z"/></svg>
                <span>{exportLabel}</span>
              </Button>
            )}
            {onAdd && (
              <Button onClick={onAdd} color="green" outline size="sm" className="inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z"/></svg>
                <span>{addLabel}</span>
              </Button>
            )}
            <select
              value={limit}
              onChange={(e)=>{ setLimit(parseInt(e.target.value,10)); setPage(1); }}
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-black bg-white"
              aria-label="Jumlah baris per halaman"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider"
                >
                  {column.label}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="px-6 py-3 text-right text-xs font-medium text-black uppercase tracking-wider">
                  Aksi
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} className="px-6 py-4 text-center text-black">
                  Memuat data...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} className="px-6 py-4 text-center text-red-600">
                  {error}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} className="px-6 py-4 text-center text-black">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {columns.map((column, colIndex) => (
                    <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-black">
                      {renderCell(item, column)}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {onEdit && (
                          <Button onClick={() => onEdit(item)} color="blue" outline size="sm" className="inline-flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M4 17.25V20h2.75L17.81 8.94l-2.75-2.75L4 17.25Zm14.71-9.04a1 1 0 0 0 0-1.41l-2.51-2.51a1 1 0 0 0-1.41 0l-1.83 1.83 3.92 3.92 1.83-1.83Z"/></svg>
                            <span>Edit</span>
                          </Button>
                        )}
                        {onDelete && (
                          <Button onClick={() => handleDelete(item)} color="red" outline size="sm" className="inline-flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm-3 6h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9Zm4 2a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0v-6a1 1 0 0 0-1-1Zm4 0a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0v-6a1 1 0 0 0-1-1Z"/></svg>
                            <span>Hapus</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-black">
              Menampilkan {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} dari {total} data
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} color="gray" outline size="sm" className="inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M15.7 5.3a1 1 0 0 1 0 1.4L11.4 11l4.3 4.3a1 1 0 0 1-1.4 1.4L9.3 12.7a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z"/></svg>
                <span>Prev</span>
              </Button>
              <span className="px-3 py-1 text-sm bg-white text-black rounded border">
                {page} / {pages}
              </span>
              <Button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page === pages} color="gray" outline size="sm" className="inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <span>Next</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8.3 18.7a1 1 0 0 1 0-1.4L12.6 13 8.3 8.7a1 1 0 0 1 1.4-1.4l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4 0Z"/></svg>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}