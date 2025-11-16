"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { fetchJson, authHeaders, fmtRupiah, toInputDateTimeLocal, buildQueryParams } from "@/lib/helpers";
import { notifyBell } from "@/lib/alerts";
import { BrowserMultiFormatReader } from "@zxing/browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Product = { id:number; kode:string; nama:string; harga:number; stok:number };
type CartItem = { id:number; kode:string; nama:string; harga:number; qty:number };
type Payment = { id?: number; amount: number; currency: string; method: string; description?: string };

export default function SalesPage() {
  const [allowed, setAllowed] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [tanggal, setTanggal] = useState<string>(toInputDateTimeLocal(new Date()));
  const [method, setMethod] = useState<string>("cash");
  const [currency, setCurrency] = useState<string>("IDR");
  const [kodeProduk, setKodeProduk] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [hargaJual, setHargaJual] = useState<number>(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [recent, setRecent] = useState<Payment[]>([]);
  const [invoiceNo, setInvoiceNo] = useState<string>("");
  const [finance, setFinance] = useState<{ discount_enabled:boolean; discount_percent:number; discount_apply_to:string[]; vat_enabled:boolean; vat_percent:number; vat_apply_to:string[] }>({ discount_enabled:false, discount_percent:0, discount_apply_to:["penjualan"], vat_enabled:false, vat_percent:0, vat_apply_to:["penjualan"] });
  const [discountInput, setDiscountInput] = useState<string>("0");
  // Scan barcode
  const [scanActive, setScanActive] = useState<boolean>(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);

  const headers: Record<string, string> = { ...authHeaders() } as any;

  // Nomor Faktur: N/hari/bulan/tahun.
  const formatInvoice = (n:number, d:Date) => `${n}/${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
  const parseInvoice = (desc?:string) => {
    if (!desc) return null;
    const m = desc.match(/FAKTUR\s+(\d+)\/(\d+)\/(\d+)\/(\d{4})/i);
    if (!m) return null;
    return { n: Number(m[1]), day: Number(m[2]), month: Number(m[3]), year: Number(m[4]) };
  };
  const nextInvoiceNo = async (date: Date) => {
    try {
      const qs = new URLSearchParams({ limit: String(200) }).toString();
      const r = await fetch(`${API_URL}/payments?${qs}`, { headers });
      const d = await r.json().catch(()=>({}));
      const items: any[] = Array.isArray((d as any)?.items) ? (d as any).items : Array.isArray((d as any)?.data) ? (d as any).data : Array.isArray(d) ? d : [];
      const day = date.getDate();
      const month = date.getMonth()+1;
      const year = date.getFullYear();
      let maxN = 0;
      for (const it of items) {
        const iv = parseInvoice(String(it.description||''));
        if (iv && iv.day===day && iv.month===month && iv.year===year) {
          if (iv.n > maxN) maxN = iv.n;
        }
      }
      return formatInvoice(maxN + 1, date);
    } catch {
      return formatInvoice(1, date);
    }
  };

  useEffect(() => {
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!tok) { setAllowed(false); return; }
    fetch(`${API_URL}/auth/permissions`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.json().catch(()=>({})))
      .then(d => {
        const perms: string[] = Array.isArray(d?.permissions) ? d.permissions : [];
        setAllowed(perms.includes('menu_payment') || perms.includes('menu_sales') || perms.includes('manage'));
      })
      .catch(() => setAllowed(false));
  }, []);

  const loadRecent = async () => {
    setLoading(true);
    try {
      const qs = buildQueryParams({ limit: 50 });
      const r = await fetch(`${API_URL}/payments?${qs}`, { headers });
      const d = await r.json().catch(() => ({}));
      const items: any[] = Array.isArray((d as any)?.items) ? (d as any).items : Array.isArray((d as any)?.data) ? (d as any).data : Array.isArray(d) ? d : [];
      const filtered = items.filter((p:any)=> String(p.description||'').toUpperCase().includes('PENJUALAN'));
      setRecent(filtered.map((p:any)=>({ id: Number(p.id), amount: Number(p.amount||0), currency: String(p.currency||'IDR'), method: String(p.method||'cash'), description: String(p.description||'') })));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadRecent(); }, []);

  const loadFinance = async () => {
    try {
      const r = await fetch(`${API_URL}/settings/finance`, { headers });
      const d = await r.json().catch(()=>({}));
      if (d && typeof d === 'object') {
        setFinance(prev=>({ ...prev, ...d }));
        setDiscountInput(String(Math.max(0, Math.min(100, Number(d.discount_percent||0)))));
      } else {
        const s = typeof window !== 'undefined' ? localStorage.getItem('finance_settings') : null;
        if (s) {
          const j = JSON.parse(s);
          setFinance(prev=>({ ...prev, ...j }));
          setDiscountInput(String(Math.max(0, Math.min(100, Number(j.discount_percent||0)))));
        }
      }
    } catch {
      const s = typeof window !== 'undefined' ? localStorage.getItem('finance_settings') : null;
      if (s) {
        const j = JSON.parse(s);
        setFinance(prev=>({ ...prev, ...j }));
        setDiscountInput(String(Math.max(0, Math.min(100, Number(j.discount_percent||0)))));
      }
    }
  };

  useEffect(() => { loadFinance(); }, []);

  useEffect(() => {
    (async () => {
      const faktur = await nextInvoiceNo(new Date(tanggal));
      setInvoiceNo(faktur);
    })();
  }, [tanggal, recent.length]);

  const addToCartByCode = async (code?: string, qtyToAdd?: number, overridePrice?: number) => {
    try {
      const kod = (code ?? kodeProduk).trim();
      if (!kod) return Swal.fire({ title: "Validasi", text: "Masukkan kode produk", icon: "warning" });
      const d = await fetchJson<{ data: Product[] } | Product[]>(`/products?q=${encodeURIComponent(kod)}`);
      const list = Array.isArray((d as any)?.data) ? (d as any).data : (Array.isArray(d) ? (d as any) : []);
      const prd = list.find((p: any) => String(p.kode).toLowerCase() === kod.toLowerCase());
      if (!prd) return Swal.fire({ title: "Produk tidak ditemukan", text: kod, icon: "warning" });
      const addQty = Math.max(1, Number(qtyToAdd ?? qty ?? 1));
      const addPrice = Number(overridePrice ?? (hargaJual || prd.harga || 0));
      setCart(prev => {
        const idx = prev.findIndex(it => it.id === prd.id);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = { ...clone[idx], qty: Math.max(1, clone[idx].qty + addQty), harga: addPrice || clone[idx].harga };
          return clone;
        }
        return [...prev, { id: prd.id, kode: prd.kode, nama: prd.nama, harga: addPrice, qty: addQty }];
      });
      setKodeProduk(""); setQty(1); setHargaJual(0);
    } catch (e:any) {
      Swal.fire({ title: "Gagal", text: e?.message || "Error", icon: "error" });
    }
  };

  // Scan camera lifecycle: when activated, start decoding and add item automatically qty 1
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
        setSelectedDeviceId((d) => d || firstId);
        readerRef.current = new BrowserMultiFormatReader();
        controlsRef.current = await readerRef.current.decodeFromVideoDevice(selectedDeviceId || firstId, videoRef.current!, (res, err) => {
          if (res) {
            const code = res.getText();
            addToCartByCode(code, 1);
            setScanActive(false);
            try { controlsRef.current?.stop?.(); } catch {}
          }
        });
      } catch (e) {
        // ignore
      }
    })();
    return () => { try { controlsRef.current?.stop?.(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanActive]);

  const payCart = async () => {
    try {
      if (!cart.length) return Swal.fire({ title: "Validasi", text: "Keranjang kosong", icon: "warning" });
      const iso = new Date(tanggal).toISOString();
      const subtotal = cart.reduce((sum, it)=> sum + (it.qty * it.harga), 0);
      const applyDiscount = finance.discount_enabled && finance.discount_apply_to?.includes('penjualan');
      const applyVat = finance.vat_enabled && finance.vat_apply_to?.includes('penjualan');
      const diskonPct = Math.max(0, Math.min(100, Number(discountInput===''?0:discountInput)));
      const diskon = applyDiscount ? (subtotal * (diskonPct / 100)) : 0;
      const dpp = Math.max(0, subtotal - diskon);
      const ppn = applyVat ? (dpp * (Number(finance.vat_percent||0) / 100)) : 0;
      const total = Math.max(0, dpp + ppn);
      const faktur = await nextInvoiceNo(new Date(tanggal));
      const itemsText = cart.map(it=>`${it.kode} x${it.qty} @${it.harga}`).join(', ');
      const ket = `FAKTUR ${faktur} - PENJUALAN [${itemsText}] subtotal=${subtotal} diskon=${diskon} ppn=${ppn}`;
      // kas masuk
      const rKas = await fetch(`${API_URL}/kas`, { method: "POST", headers, body: JSON.stringify({ jenis: "MASUK", tanggal: iso, jumlah: total, keterangan: ket }) });
      const dKas = await rKas.json().catch(()=>({}));
      if (!rKas.ok) return Swal.fire({ title: "Gagal", text: dKas?.error || "Gagal simpan kas", icon: "error" });
      // update stok untuk setiap item
      for (const it of cart) {
        const rProd = await fetch(`${API_URL}/products/${it.id}`, { method: "PUT", headers, body: JSON.stringify({ stok_delta: -Math.max(1, it.qty) }) });
        const dProd = await rProd.json().catch(()=>({}));
        if (!rProd.ok) return Swal.fire({ title: "Gagal", text: dProd?.error || `Gagal update stok ${it.kode}`, icon: "error" });
      }
      // catat payment sekali
      const pay = { amount: total, currency, method, description: ket, invoice_no: faktur } as any;
      const rPay = await fetch(`${API_URL}/payments`, { method: "POST", headers, body: JSON.stringify(pay) });
      const dPay = await rPay.json().catch(()=>({}));
      if (!rPay.ok) return Swal.fire({ title: "Gagal", text: dPay?.error || "Gagal catat payment", icon: "error" });
      setCart([]); setCashReceived(0); setKodeProduk(""); setQty(1); setHargaJual(0);
      await loadRecent();
      notifyBell("Penjualan", `Penjualan berhasil (${fmtRupiah(total)})`);
    } catch (e:any) {
      Swal.fire({ title: "Gagal", text: e?.message || "Kesalahan", icon: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Penjualan Produk</h2>
        <div className="flex items-center gap-2">
          <button onClick={loadRecent} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow">Refresh</button>
          <button onClick={()=> setScanActive(s=>!s)} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-blue-700 border-2 border-blue-600 bg-white hover:bg-blue-50 shadow">{scanActive ? 'Stop Scan' : 'Aktifkan Scan Produk'}</button>
        </div>
        </div>

        {!allowed && (
          <div className="rounded-xl border bg-white p-4 text-black mb-4">Anda tidak memiliki izin untuk melihat halaman ini.</div>
        )}

        {allowed && (
          <>
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
            <h3 className="text-black font-medium mb-2">Form Penjualan</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-sm text-gray-700">No Faktur</label>
                <input value={invoiceNo} readOnly className="px-3 py-2 rounded border w-full bg-gray-100 text-black" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Kode Produk</label>
                <input value={kodeProduk} onChange={e=>setKodeProduk(e.target.value)} onKeyDown={(e)=>{ if (e.key==='Enter') addToCartByCode(); }} placeholder="Scan atau ketik kode produk lalu Enter" className="px-3 py-2 rounded border w-full" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Qty</label>
                <input type="number" min={1} value={qty} onChange={e=>setQty(Number(e.target.value))} className="px-3 py-2 rounded border w-full" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Harga Jual</label>
                <input type="number" min={0} value={hargaJual} onChange={e=>setHargaJual(Number(e.target.value))} className="px-3 py-2 rounded border w-full" />
              </div>
              {finance.discount_enabled && finance.discount_apply_to?.includes('penjualan') && (
                <div>
                  <label className="text-sm text-gray-700">Diskon (%)</label>
                  <input type="number" min={0} max={100} value={discountInput} onChange={e=>setDiscountInput(e.target.value)} onBlur={()=>{
                    const v = String(Math.max(0, Math.min(100, Number(discountInput===''?0:discountInput))));
                    setDiscountInput(v);
                  }} className="px-3 py-2 rounded border w-full" />
                </div>
              )}
              <div>
                <label className="text-sm text-gray-700">Tanggal</label>
                <input type="datetime-local" value={tanggal} onChange={e=>setTanggal(e.target.value)} className="px-3 py-2 rounded border w-full" />
              </div>
              <div>
                <label className="text-sm text-gray-700">Metode</label>
                <select value={method} onChange={e=>setMethod(e.target.value)} className="px-3 py-2 rounded border w-full">
                  <option value="cash">Cash</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700">Currency</label>
                <select value={currency} onChange={e=>setCurrency(e.target.value)} className="px-3 py-2 rounded border w-full">
                  <option value="IDR">IDR</option>
                </select>
              </div>
              <div className="md:col-span-4 flex items-center gap-2">
                <button onClick={()=>addToCartByCode()} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-slate-600 hover:bg-slate-700 shadow">Tambah ke Keranjang</button>
                <button onClick={payCart} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-green-600 hover:bg-green-700 shadow">Bayar</button>
              </div>
              {scanActive && (
                <div className="md:col-span-4 mt-3 rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm text-gray-700">Kamera</label>
                    <select value={selectedDeviceId} onChange={e=>setSelectedDeviceId(e.target.value)} className="px-2 py-1 rounded border">
                      {devices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>
                      ))}
                    </select>
                  </div>
                  <video ref={videoRef} className="w-full max-h-64 bg-black" muted playsInline />
                  <p className="text-xs text-gray-500 mt-1">Arahkan barcode ke kamera. Produk akan otomatis masuk ke keranjang dengan qty 1.</p>
                </div>
              )}
              <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                <div className="px-3 py-2 rounded border bg-white">
                  <div className="text-black/70">Subtotal</div>
                  <div className="text-black font-medium">{(()=>{ const s=cart.reduce((sum,it)=>sum+(it.qty*it.harga),0); return fmtRupiah(s); })()}</div>
                </div>
                <div className="px-3 py-2 rounded border bg-white">
                  <div className="text-black/70">Diskon</div>
                  <div className="text-black font-medium">{(()=>{ const s=cart.reduce((sum,it)=>sum+(it.qty*it.harga),0); const dp=Math.max(0, Math.min(100, Number(discountInput===''?0:discountInput))); const d=finance.discount_enabled&&finance.discount_apply_to?.includes('penjualan')? s*(dp/100):0; return fmtRupiah(d); })()}</div>
                </div>
                <div className="px-3 py-2 rounded border bg-white">
                  <div className="text-black/70">PPN</div>
                  <div className="text-black font-medium">{(()=>{ const s=cart.reduce((sum,it)=>sum+(it.qty*it.harga),0); const dp=Math.max(0, Math.min(100, Number(discountInput===''?0:discountInput))); const d=finance.discount_enabled&&finance.discount_apply_to?.includes('penjualan')? s*(dp/100):0; const dpp=Math.max(0,s-d); const p=finance.vat_enabled&&finance.vat_apply_to?.includes('penjualan')? dpp*(Number(finance.vat_percent||0)/100):0; return fmtRupiah(p); })()}</div>
                </div>
                <div className="px-3 py-2 rounded border bg-white">
                  <div className="text-black/70">Total</div>
                  <div className="text-black font-semibold">{(()=>{ const s=cart.reduce((sum,it)=>sum+(it.qty*it.harga),0); const dp=Math.max(0, Math.min(100, Number(discountInput===''?0:discountInput))); const d=finance.discount_enabled&&finance.discount_apply_to?.includes('penjualan')? s*(dp/100):0; const dpp=Math.max(0,s-d); const p=finance.vat_enabled&&finance.vat_apply_to?.includes('penjualan')? dpp*(Number(finance.vat_percent||0)/100):0; return fmtRupiah(Math.max(0,dpp+p)); })()}</div>
                </div>
                <div className="px-3 py-2 rounded border bg-white">
                  <div className="text-black/70">Uang Diterima</div>
                  <input type="number" min={0} value={cashReceived} onChange={e=>setCashReceived(Number(e.target.value||0))} className="px-3 py-2 rounded border w-full" />
                  <div className="text-black/70 mt-1">Kembalian</div>
                  <div className="text-black font-medium">{(()=>{ const s=cart.reduce((sum,it)=>sum+(it.qty*it.harga),0); const dp=Math.max(0, Math.min(100, Number(discountInput===''?0:discountInput))); const d=finance.discount_enabled&&finance.discount_apply_to?.includes('penjualan')? s*(dp/100):0; const dpp=Math.max(0,s-d); const p=finance.vat_enabled&&finance.vat_apply_to?.includes('penjualan')? dpp*(Number(finance.vat_percent||0)/100):0; const total=Math.max(0,dpp+p); const k=Math.max(0, (cashReceived||0) - total); return fmtRupiah(k); })()}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Detail Keranjang */}
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow mb-6">
            <h3 className="text-black font-medium mb-2">Detail Produk</h3>
            {cart.length === 0 ? (
              <div className="text-sm text-black/70">Belum ada item. Scan atau masukkan kode lalu klik Tambah.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Kode</th>
                    <th className="p-2">Nama</th>
                    <th className="p-2">Harga</th>
                    <th className="p-2">Qty</th>
                    <th className="p-2">Subtotal</th>
                    <th className="p-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((it, idx)=> (
                    <tr key={`${it.id}-${idx}`} className="border-b">
                      <td className="p-2">{it.kode}</td>
                      <td className="p-2">{it.nama}</td>
                      <td className="p-2">
                        <input type="number" min={0} value={it.harga} onChange={e=>{
                          const v = Number(e.target.value||0);
                          setCart(prev=> prev.map(ci=> ci.id===it.id ? { ...ci, harga: v } : ci));
                        }} className="px-2 py-1 rounded border w-28" />
                      </td>
                      <td className="p-2">
                        <input type="number" min={1} value={it.qty} onChange={e=>{
                          const v = Math.max(1, Number(e.target.value||1));
                          setCart(prev=> prev.map(ci=> ci.id===it.id ? { ...ci, qty: v } : ci));
                        }} className="px-2 py-1 rounded border w-20" />
                      </td>
                      <td className="p-2">{fmtRupiah(it.qty * it.harga)}</td>
                      <td className="p-2">
                        <button onClick={()=> setCart(prev=> prev.filter(ci=> ci.id!==it.id))} className="px-2 py-1 rounded bg-red-600 text-white">Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          </>
          )}

        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          <h3 className="text-black font-medium mb-2">Riwayat Penjualan Terbaru</h3>
          {loading ? <div>Memuat...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-2">Deskripsi</th>
                  <th className="p-2">Jumlah</th>
                  <th className="p-2">Metode</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((p, idx)=>(
                  <tr key={p.id||idx} className="border-b">
                    <td className="p-2">{p.description}</td>
                    <td className="p-2">{fmtRupiah(p.amount)}</td>
                    <td className="p-2">{p.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}