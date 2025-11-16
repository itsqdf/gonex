"use client";

import { useEffect, useRef, useState } from "react";

type Announcement = {
  id: number;
  title: string;
  content: string;
  days?: string[];
  time?: string;
  target?: string;
  jabatan?: string[];
  roles?: string[];
  active?: boolean;
  company_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  date?: string | null;
  global_company?: boolean;
};

export default function AnnouncementBanner() {
  const [visibleList, setVisibleList] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, string>>({});
  const lastSoundAtRef = useRef<number>(0);

  const playChime = async () => {
    try {
      const now = Date.now();
      if (now - lastSoundAtRef.current < 5000) return; // throttle
      lastSoundAtRef.current = now;
      const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return; // browser may block
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.65);
    } catch {}
  };

  const load = () => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("announcements") : null;
      const arr: Announcement[] = raw ? JSON.parse(raw) : [];
      const disRaw = typeof window !== "undefined" ? localStorage.getItem("announcements_dismissed") : null;
      const disMap: Record<string, string> = disRaw ? JSON.parse(disRaw) : {};
      setDismissed(disMap);
      const active = arr.filter(it => !!it.active);
      // tampilkan maksimal 3 pengumuman aktif terbaru
      const latest = active.slice(0, 3);
      setVisibleList(latest.filter(it => !disMap[String(it.id)]));
    } catch {}
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15_000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "announcements" || e.key === "announcements_dismissed") {
        load();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => { clearInterval(interval); window.removeEventListener("storage", onStorage); };
  }, []);

  const close = (id: number) => {
    try {
      const next = { ...dismissed, [String(id)]: new Date().toISOString() };
      setDismissed(next);
      localStorage.setItem("announcements_dismissed", JSON.stringify(next));
      setVisibleList(prev => prev.filter(x => x.id !== id));
    } catch {}
  };

  useEffect(() => {
    if (visibleList.length > 0) { playChime(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleList.length]);

  if (!visibleList || visibleList.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {visibleList.map(it => (
        <div key={it.id} className="max-w-sm rounded-2xl shadow-xl border border-indigo-200/70 bg-gradient-to-br from-white/95 to-indigo-50/80 backdrop-blur p-3 text-black">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <span className="inline-flex items-center justify-center rounded-full bg-indigo-600/10 text-indigo-700 p-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 animate-[ring_1.2s_ease-in-out_infinite]">
                  <path d="M12 2a7 7 0 0 1 7 7v3.586l1.707 1.707A1 1 0 0 1 20.293 16H3.707a1 1 0 0 1-.414-1.707L5 12.586V9a7 7 0 0 1 7-7Zm0 20a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3Z"/>
                </svg>
              </span>
              <div>
                <div className="text-sm font-semibold text-indigo-900">{it.title}</div>
                <div className="mt-1 text-xs text-gray-800">{it.content}</div>
                {(it.company_name || it.product_name || it.product_code || it.time || it.date) && (
                  <div className="mt-2 text-[11px] text-gray-700 space-y-0.5">
                    {it.company_name && (<div><strong>Perusahaan:</strong> {it.company_name}</div>)}
                    {(it.product_name || it.product_code) && (
                      <div><strong>Produk:</strong> {it.product_name || ''} {it.product_code ? `(${it.product_code})` : ''}</div>
                    )}
                    {(it.date || it.time) && (
                      <div><strong>Waktu:</strong> {it.date ? it.date : ''}{it.date && it.time ? ' ' : ''}{it.time ? it.time : ''}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button aria-label="Tutup" onClick={() => close(it.id)} className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M6.225 4.811a1 1 0 0 1 1.414 0L12 9.172l4.361-4.361a1 1 0 1 1 1.414 1.414L13.414 10.586l4.361 4.361a1 1 0 1 1-1.414 1.414L12 12l-4.361 4.361a1 1 0 1 1-1.414-1.414l4.361-4.361-4.361-4.361a1 1 0 0 1 0-1.414Z"/></svg>
            </button>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes ring {
          0% { transform: rotate(0deg); }
          15% { transform: rotate(12deg); }
          30% { transform: rotate(-10deg); }
          45% { transform: rotate(8deg); }
          60% { transform: rotate(-6deg); }
          75% { transform: rotate(4deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}