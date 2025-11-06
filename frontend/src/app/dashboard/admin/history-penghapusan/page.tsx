'use client';

import { useState } from 'react';
import DataTable, { DataTableColumn } from '@/components/DataTable';
import { fetchJson } from '@/lib/helpers';

interface DeletionLog {
  id: number;
  entity: string;
  entity_id?: number;
  description: string;
  deleted_by: number;
  deleted_by_email: string;
  deleted_at: string;
}

export default function HistoryPenghapusanPage() {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const columns: DataTableColumn<DeletionLog>[] = [
    {
      key: 'id',
      label: 'ID',
    },
    {
      key: 'entity',
      label: 'Entitas',
      render: (item) => (
        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
          {item.entity}
        </span>
      )
    },
    {
      key: 'entity_id',
      label: 'ID Entitas',
      render: (item) => item.entity_id || '-'
    },
    {
      key: 'description',
      label: 'Deskripsi',
    },
    {
      key: 'deleted_by_email',
      label: 'Dihapus Oleh',
      render: (item) => (
        <div className="text-sm">
          <div className="font-medium text-gray-900">{item.deleted_by_email}</div>
          <div className="text-gray-500">ID: {item.deleted_by}</div>
        </div>
      )
    },
    {
      key: 'deleted_at',
      label: 'Waktu Penghapusan',
      render: (item) => {
        const date = new Date(item.deleted_at);
        return (
          <div className="text-sm">
            <div className="text-gray-900">{date.toLocaleDateString('id-ID')}</div>
            <div className="text-gray-500">{date.toLocaleTimeString('id-ID')}</div>
          </div>
        );
      }
    }
  ];

  const handleExport = async () => {
    try {
      const response = await fetch('/deletion-logs/export.csv', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Gagal mengunduh CSV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'history_penghapusan.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Gagal mengunduh CSV: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDelete = async (item: DeletionLog) => {
    try {
      await fetchJson(`/deletion-logs/${item.id}`, {
        method: 'DELETE'
      });
    } catch (error) {
      throw new Error('Gagal menghapus log: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleClearAll = async () => {
    try {
      await fetchJson('/deletion-logs?all=true', {
        method: 'DELETE'
      });
      setShowClearConfirm(false);
      // DataTable will refresh automatically
      window.location.reload();
    } catch (error) {
      alert('Gagal menghapus semua log: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black mb-2">History Penghapusan</h1>
        <p className="text-gray-600">
          Riwayat penghapusan data dari sistem. Log ini mencatat siapa yang menghapus data dan kapan.
        </p>
      </div>

      {/* Clear All Button */}
      <div className="mb-4">
        <button
          onClick={() => setShowClearConfirm(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500"
        >
          Hapus Semua Log
        </button>
      </div>

      <DataTable
        endpoint="/deletion-logs"
        columns={columns}
        searchPlaceholder="Cari berdasarkan entitas, deskripsi, atau email..."
        onExport={handleExport}
        onDelete={handleDelete}
        exportLabel="Download CSV"
        className="shadow-lg"
      />

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Konfirmasi Penghapusan
            </h3>
            <p className="text-gray-600 mb-6">
              Yakin ingin menghapus SEMUA log penghapusan? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleClearAll}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}