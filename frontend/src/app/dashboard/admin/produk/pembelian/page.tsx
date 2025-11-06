"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtRupiah, toInputDateTimeLocal } from "@/lib/helpers";
import { Button } from "flowbite-react";
import Swal from "sweetalert2";
import { BrowserMultiFormatReader } from "@zxing/browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type KasItem = { id: number; tanggal: string; jumlah: number; keterangan: string };

type ParsedPembelian = { kode: string; nama: string; qty: number; harga: number } | null;

function parsePembelianKet(ket: string): ParsedPembelian {
  // Format: "PEMBELIAN <kode> <nama> qty=<qty> harga=<harga> [keterangan...]"
  if (!ket || !ket.startsWith("PEMBELIAN ")) return null;
  try {
    const parts = ket.replace(/^PEMBELIAN\s+/, "").split(/\s+/);
    const kode = parts[0] || "";
    const idxQty = ket.indexOf("qty=");
    const idxHarga = ket.indexOf("harga=");
    const qtyStr = idxQty >= 0 ? ket.slice(idxQty + 4).split(/\s+/)[0] : "";
    const hargaStr = idxHarga >= 0 ? ket.slice(idxHarga + 6).split(/\s+/)[0] : "";
    const nama = parts.slice(1).join(" ").replace(/qty=.*$/, "").trim();
    const qty = parseInt(qtyStr || "0", 10) || 0;
    const harga = parseFloat(hargaStr || "0") || 0;
    if (!kode || qty <= 0 || harga <= 0) return null;
    return { kode, nama, qty, harga };
  } catch {
    return null;
  }
}

export default function PembelianPage() {
  const [items, setItems] = useState<KasItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [tanggal, setTanggal] = useState<string>(toInputDateTimeLocal(new Date()));
  const [kode, setKode] = useState<string>("");
  const [namaProduk, setNamaProduk] = useState<string>("");
  const [qty, setQty] = useState<string>("");
  const [hargaBeli, setHargaBeli] = useState<string>("");
  const [keterangan, setKeterangan] = useState<string>("");
const [q, setQ] = useState<string>("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSug, setShowSug] = useState<boolean>(false);
  const [scanActive, setScanActive] = useState<boolean>(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [showForm, setShowForm] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);

  const token = useMemo(() => (typeof window !== "undefined" ? localStorage.getItem("token") : null), []);
  const headers = useMemo(() => ({ "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);

  const fmtThousand = (n: number) => new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(n || 0);

  const load = async () => {
     if (!token) return;
     setLoading(true); setError(null);
     try {

      const base = `${API_URL}/kas?jenis=KELUAR`;
      const qs = q ? `&q=${encodeURIComponent('PEMBELIAN ' + q)}` : `&q=PEMBELIAN`;
      const r = await fetch(base + qs, { headers });
       const d = await r.json().catch(()=>({}));
       if (r.ok) {
         setItems(Array.isArray(d.data) ? d.data : []);
       } else {
         setError(d.error || "Gagal memuat pembelian");
       }
     } catch (e: any) {
       setError(e?.message || "Kesalahan jaringan");
     } finally { setLoading(false); }
   };

  const cariProduk = async () => {
    if (!kode) return;
    try {
      const r = await fetch(`${API_URL}/products?q=${encodeURIComponent(kode)}`, { headers });
      const d = await r.json().catch(()=>({}));
      const list = Array.isArray(d.data) ? d.data : [];
      const prd = list.find((p: any) => String(p.kode).toLowerCase() === kode.toLowerCase());
      if (!prd) { setNamaProduk(""); Swal.fire({ title: "Produk tidak ditemukan", icon: "warning" }); return; }
      setNamaProduk(prd.nama || "");
      if (!hargaBeli && prd.harga) setHargaBeli(String(prd.harga));
    } catch {}
  };

  const createPembelian = async () => {
    if (!token) { setError("Tidak ada token"); return; }
    const qtyNum = parseInt(qty || "0", 10) || 0;
    const hargaNum = parseFloat(hargaBeli || "0") || 0;
    if (!kode || qtyNum <= 0 || hargaNum <= 0) { setError("Kode, Qty, dan Harga wajib" ); return; }
    try {
      // pastikan produk valid
      const r = await fetch(`${API_URL}/products?q=${encodeURIComponent(kode)}`, { headers });
      const d = await r.json().catch(()=>({}));
      const list = Array.isArray(d.data) ? d.data : [];
      const prd = list.find((p: any) => String(p.kode).toLowerCase() === kode.toLowerCase());
      if (!prd) { setError("Produk tidak ditemukan"); return; }
      const total = qtyNum * hargaNum;
      const iso = new Date(tanggal).toISOString();
      const ket = `PEMBELIAN ${prd.kode} ${prd.nama} qty=${qtyNum} harga=${hargaNum}${keterangan ? ` ${keterangan}`: ''}`;
      // simpan ke kas (keluar)
      const rKas = await fetch(`${API_URL}/kas`, { method: "POST", headers, body: JSON.stringify({ jenis: "KELUAR", tanggal: iso, jumlah: total, keterangan: ket }) });
      const dKas = await rKas.json().catch(()=>({}));
      if (!rKas.ok) { setError(dKas.error || "Gagal menyimpan ke kas"); return; }
      // update stok produk (+qty)
      const rProd = await fetch(`${API_URL}/products/${prd.id}`, { method: "PUT", headers, body: JSON.stringify({ stok: Number(prd.stok || 0) + qtyNum }) });
      const dProd = await rProd.json().catch(()=>({}));
      if (!rProd.ok) { setError(dProd.error || "Gagal mengupdate stok produk"); return; }
      setKode(""); setNamaProduk(""); setQty(""); setHargaBeli(""); setKeterangan("");
      await load();
      Swal.fire({ title: "Berhasil", text: "Pembelian disimpan", icon: "success" });
    } catch (e: any) {
      setError(e?.message || "Kesalahan jaringan");
    }
  };

  const hapusPembelian = async (it: KasItem) => {
    if (!token) return;
    const confirm = await Swal.fire({ title: "Hapus pembelian?", text: it.keterangan, icon: "warning", showCancelButton: true, confirmButtonText: "Ya" });
    if (!confirm.isConfirmed) return;
    // parse untuk rollback stok
    const parsed = parsePembelianKet(it.keterangan);
    try {
      const rDel = await fetch(`${API_URL}/kas/${it.id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const dDel = await rDel.json().catch(()=>({}));
      if (!rDel.ok) { setError(dDel.error || "Gagal menghapus"); return; }
      if (parsed) {
        const rp = await fetch(`${API_URL}/products?q=${encodeURIComponent(parsed.kode)}`, { headers });
        const dp = await rp.json().catch(()=>({}));
        const list = Array.isArray(dp.data) ? dp.data : [];
        const prd = list.find((p: any) => String(p.kode).toLowerCase() === parsed.kode.toLowerCase());
        if (prd) {
          await fetch(`${API_URL}/products/${prd.id}`, { method: "PUT", headers, body: JSON.stringify({ stok: Math.max(0, Number(prd.stok || 0) - parsed.qty) }) });
        }
      }
      await load();
    } catch {}
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
  const t = setTimeout(() => { load(); }, 300);
  return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Autosuggest produk berdasarkan kode
  useEffect(() => {
    const t = setTimeout(async () => {
      const term = kode.trim();
      if (term.length < 2) { setSuggestions([]); setShowSug(false); return; }
      try {
        const r = await fetch(`${API_URL}/products?q=${encodeURIComponent(term)}`, { headers });
        const d = await r.json().catch(()=>({}));
        const list = Array.isArray(d.data) ? d.data : [];
        setSuggestions(list.slice(0, 8));
        setShowSug(true);
      } catch { setSuggestions([]); setShowSug(false); }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kode]);

  // Barcode scan setup
  useEffect(() => {
    if (!scanActive) {
      try { controlsRef.current?.stop?.(); } catch {}
      return;
    }
    (async () => {
      try {
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        setDevices(list);
        const firstId = list[0]?.deviceId || "";
        setSelectedDeviceId(d => d || firstId);
        readerRef.current = new BrowserMultiFormatReader();
        controlsRef.current = await readerRef.current.decodeFromVideoDevice(selectedDeviceId || firstId, videoRef.current!, (res, err) => {
          if (res) {
            const code = res.getText();
            setKode(code);
            setScanActive(false);
            try { controlsRef.current?.stop?.(); } catch {}
            setTimeout(() => { cariProduk(); }, 0);
          }
        });
      } catch {}
    })();
    return () => { try { controlsRef.current?.stop?.(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanActive]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-black">Pembelian</h1>
        <div className="flex items-center gap-2">
          <Button onClick={()=>setScanActive(s=>!s)} color="blue" outline size="sm">{scanActive ? "Stop Scan" : "Scan Barcode"}</Button>
          <Button onClick={()=>setShowForm(s=>!s)} color="indigo" outline size="sm">{showForm?"Tutup":"Tambah"}</Button>
          <div className="relative w-64">
            <input value={q} onChange={e=>setQ(e.target.value)} className="peer px-3 py-2 rounded border w-full placeholder-transparent" placeholder="Cari pembelian" />
            <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-2.5 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Cari pembelian</label>
          </div>
        </div>
      </div>
      {error && (<div className="mb-3 rounded border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>)}
      {scanActive && (
        <div className="mb-3 rounded border p-3 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm text-gray-600">Kamera:</label>
            <select value={selectedDeviceId} onChange={e=>setSelectedDeviceId(e.target.value)} className="px-2 py-1 rounded border">
              {devices.map(d => (<option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>))}
            </select>
          </div>
          <video ref={videoRef} className="w-full max-h-64 bg-black" muted playsInline />
          <p className="text-xs text-gray-500 mt-1">Arahkan barcode ke kamera. Kode akan terisi otomatis.</p>
        </div>
      )}
      {showForm && (
      <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <div className="relative">
          <input type="datetime-local" value={tanggal} onChange={e=>setTanggal(e.target.value)} className="peer px-3 py-3 rounded border w-full placeholder-transparent" />
          <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Tanggal</label>
        </div>
        <div className="relative">
          <input value={kode} onChange={e=>setKode(e.target.value)}  className="peer px-3 py-3 rounded border w-full placeholder-transparent" />
          <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Kode Produk</label>
          {showSug && suggestions.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 rounded border bg-white shadow-sm max-h-52 overflow-y-auto">
              {suggestions.map((p: any) => (
                <button
                  type="button"
                  key={p.id}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  onClick={() => {
                    setKode(String(p.kode || ""));
                    setNamaProduk(String(p.nama || ""));
                    if (!hargaBeli && p.harga) setHargaBeli(String(p.harga || ""));
                    setShowSug(false);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{String(p.kode)} — {String(p.nama)}</span>
                    <span className="text-xs text-gray-500">{fmtRupiah(Number(p.harga||0))}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <Button onClick={cariProduk} color="indigo" outline size="sm">Cari Produk</Button>
          {namaProduk && (<div className="text-xs text-gray-600 mt-1">{namaProduk}</div>)}
        </div>
        <div className="relative">
          <input type="number" step="0.01" value={hargaBeli} onChange={e=>setHargaBeli(e.target.value)} className="peer px-3 py-3 rounded border w-full placeholder-transparent" />
          <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Harga Beli</label>
          <div className="mt-1 text-xs text-gray-500">{fmtRupiah(parseFloat(hargaBeli||"0")||0)}</div>
        </div>
        <div className="relative">
          <input type="number" value={qty} onChange={e=>setQty(e.target.value)}  className="peer px-3 py-3 rounded border w-full placeholder-transparent" />
          <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Qty</label>
        </div>
        <div className="md:col-span-5 relative">
          <input value={keterangan} onChange={e=>setKeterangan(e.target.value)}  className="peer px-3 py-3 rounded border w-full placeholder-transparent" />
          <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-placeholder-shown:top-3 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-gray-400 transition-all">Keterangan (opsional)</label>
        </div>
        <div className="md:col-span-5 flex items-center justify-between">
          <div className="text-sm text-black">Total: {fmtRupiah((parseInt(qty||'0',10)||0) * (parseFloat(hargaBeli||'0')||0))}</div>
             <Button onClick={createPembelian} color="blue" outline size="sm" className="inline-flex items-center justify-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
               </svg>
               <span>Simpan</span>
             </Button>
        </div>
      </div>
      )}

      <div className="rounded border overflow-x-auto">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-black">Tampil</label>
            <select value={limit} onChange={e=>{ setLimit(parseInt(e.target.value,10)); setPage(1); }} className="px-2 py-1 rounded border text-sm">
              {[5,10,20,50].map(n=> (<option key={n} value={n}>{n}</option>))}
            </select>
            <span className="text-black">per halaman</span>
          </div>
          <div className="text-sm text-black">Total: {items.length}</div>
        </div>
        <table className="min-w-full text-sm text-black">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Tanggal</th>
              <th className="p-2 text-left">Produk</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Harga</th>
              <th className="p-2 text-right">Total</th>
              <th className="p-2 text-left">Keterangan</th>
              <th className="p-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={7}>Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="p-3" colSpan={7}>Tidak ada data</td></tr>
            ) : items.slice(((page-1)*limit), ((page-1)*limit)+limit).map(it => {
              const parsed = parsePembelianKet(it.keterangan);
              const tanggalView = new Date(it.tanggal).toLocaleString();
              const qtyView = parsed?.qty ?? 0;
              const hargaView = parsed?.harga ?? 0;
              const totalView = (qtyView || 0) * (hargaView || 0);
              const prodView = parsed ? `${parsed.kode} ${parsed.nama}` : "-";
              return (
                <tr key={it.id} className="border-t">
                  <td className="p-2">{tanggalView}</td>
                  <td className="p-2">{prodView}</td>
                  <td className="p-2 text-right">{fmtThousand(qtyView)}</td>
                  <td className="p-2 text-right">{fmtRupiah(hargaView)}</td>
                  <td className="p-2 text-right">{fmtRupiah(totalView)}</td>
                  <td className="p-2">{it.keterangan}</td>
                  <td className="p-2 text-center">
                    {parsed ? (
                      <Button onClick={()=>hapusPembelian(it)} color="red" outline size="xs">Hapus</Button>
                    ) : (
                      <span className="text-xs text-gray-500">Tidak dikenali</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-3">
          <div className="text-sm text-black">Menampilkan {(Math.min(items.length, ((page-1)*limit)+limit))} dari {items.length}</div>
          <div className="flex items-center gap-2">
            <Button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} color="gray" outline size="sm" className="disabled:opacity-50 disabled:cursor-not-allowed">Prev</Button>
            <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded">{page} / {Math.max(1, Math.ceil(items.length/limit))}</span>
            <Button onClick={()=>setPage(p=>p+1)} disabled={page>=Math.max(1, Math.ceil(items.length/limit))} color="gray" outline size="sm" className="disabled:opacity-50 disabled:cursor-not-allowed">Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}