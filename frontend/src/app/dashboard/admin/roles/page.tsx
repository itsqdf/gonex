'use client';

import { useState } from 'react';
import DataTable, { DataTableColumn } from '@/components/DataTable';
import { fetchJson } from '@/lib/helpers';
import Swal from 'sweetalert2';

interface Role {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export default function RolesPage() {
  const [mode, setMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<{ name: string; description: string }>({
    name: '',
    description: ''
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const columns: DataTableColumn<Role>[] = [
    {
      key: 'id',
      label: 'ID',
    },
    {
      key: 'name',
      label: 'Name',
      render: (item) => (
        <span className="font-semibold text-indigo-600">
          {item.name}
        </span>
      )
    },
    {
      key: 'description',
      label: 'Description',
      render: (item) => (
        <span className="text-gray-600 text-sm">
          {item.description || '-'}
        </span>
      )
    },
    {
      key: 'created_at',
      label: 'Created At',
      render: (item) => {
        if (!item.created_at) return '-';
        const date = new Date(item.created_at);
        return (
          <div className="text-sm">
            <div className="text-gray-900">{date.toLocaleDateString('id-ID')}</div>
            <div className="text-gray-500">{date.toLocaleTimeString('id-ID')}</div>
          </div>
        );
      }
    }
  ];

  const startAdd = () => {
    setMode('add');
    setEditingId(null);
    setForm({ name: '', description: '' });
  };

  const startEdit = (role: Role) => {
    setMode('edit');
    setEditingId(role.id);
    setForm({
      name: role.name,
      description: role.description || ''
    });
  };

  const saveForm = async () => {
    if (!form.name?.trim()) {
      Swal.fire({ title: 'Gagal', text: 'Name wajib diisi', icon: 'error' });
      return;
    }

    try {
      const body = {
        name: form.name.trim(),
        description: form.description?.trim() || ''
      };

      if (mode === 'edit' && editingId) {
        await fetchJson(`/roles/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        });
      } else {
        await fetchJson('/roles', {
          method: 'POST',
          body: JSON.stringify(body)
        });
      }

      Swal.fire({ title: 'Berhasil', text: 'Role disimpan', icon: 'success' });
      setMode(null);
      setEditingId(null);
      setForm({ name: '', description: '' });
      setRefreshKey(prev => prev + 1); // Trigger DataTable refresh
    } catch (error) {
      Swal.fire({
        title: 'Gagal',
        text: error instanceof Error ? error.message : 'Gagal menyimpan role',
        icon: 'error'
      });
    }
  };

  const handleDelete = async (role: Role) => {
    try {
      await fetchJson(`/roles/${role.id}`, {
        method: 'DELETE'
      });
    } catch (error) {
      throw new Error('Gagal menghapus role: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const cancelForm = () => {
    setMode(null);
    setEditingId(null);
    setForm({ name: '', description: '' });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black mb-2">Roles</h1>
        <p className="text-gray-600">
          Kelola role sistem untuk mengelompokkan hak akses pengguna.
        </p>
      </div>

      {/* Form Modal */}
      {mode && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {mode === 'add' ? 'Tambah Role' : 'Edit Role'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., Admin"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Deskripsi role..."
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={cancelForm}
                className="text-red-700 hover:text-white border border-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Batal</span>
              </button>
              <button
                onClick={saveForm}
                className={mode === 'add' ? "text-green-700 hover:text-white border border-green-700 hover:bg-green-800 focus:ring-4 focus:outline-none focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center justify-center gap-2" : "text-blue-700 hover:text-white border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center justify-center gap-2"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{mode === 'add' ? 'Tambah' : 'Simpan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <DataTable
        key={refreshKey}
        endpoint="/roles"
        columns={columns}
        searchPlaceholder="Cari berdasarkan name atau deskripsi..."
        onAdd={startAdd}
        onEdit={startEdit}
        onDelete={handleDelete}
        addLabel="Tambah Role"
        className="shadow-lg"
      />
    </div>
  );
}