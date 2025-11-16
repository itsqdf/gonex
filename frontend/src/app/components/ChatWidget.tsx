"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { fetchJson, authHeaders } from "@/lib/helpers";

type Message = { id?: string; sender?: string; text: string; ts?: number };
type Jabatan = { id: number; name: string };
type Announcement = { id:number; title:string; content:string; active?:boolean; target?:string; jabatan?:string[]; days?: string[]; date?: string; time?: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<"jabatan"|"pengumuman"|"admin">("jabatan");
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [jabatans, setJabatans] = useState<Jabatan[]>([]);
  const [selectedJabatan, setSelectedJabatan] = useState<number|"">("");
  const [msgsJabatan, setMsgsJabatan] = useState<Message[]>([]);
  const [msgsAdmin, setMsgsAdmin] = useState<Message[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [canAdmin, setCanAdmin] = useState<boolean>(false);

  // Prefetch daftar jabatan saat widget dibuka pertama kali (gunakan auth bila tersedia)
  useEffect(() => {
    if (!open || jabatans.length) return;
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const headers = tok ? authHeaders() : {};
    fetch(`${API_URL}/jabatan?limit=200`, { headers })
      .then(r=>r.json().catch(()=>({})))
      .then(d=>{
        const arr = Array.isArray((d as any)?.data) ? (d as any).data
          : Array.isArray((d as any)?.jabatan) ? (d as any).jabatan
          : Array.isArray(d) ? (d as any)
          : [];
        if (Array.isArray(arr)) setJabatans(arr.map((x:any)=>({ id:Number(x.id), name:String(x.name || x.nama || '') })));
      })
      .catch(()=>{});
  }, [open, jabatans.length]);

  // Load permissions for admin chat access and announcements for notice
  useEffect(() => {
    if (!open) return;
    try {
      const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (tok) {
        fetch(`${API_URL}/auth/permissions`, { headers: { Authorization: `Bearer ${tok}` } })
          .then(r=>r.json().catch(()=>({})))
          .then(d=>{
            const perms: string[] = Array.isArray(d?.permissions) ? d.permissions : [];
            setCanAdmin(perms.includes('manage'));
          })
          .catch(()=> setCanAdmin(false));
      }
    } catch {}
    // Muat pengumuman lokal untuk tab Pengumuman
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("announcements") : null;
      const arr: Announcement[] = raw ? JSON.parse(raw) : [];
      setAnnouncements(Array.isArray(arr) ? arr : []);
    } catch {}
  }, [open]);

  const currentMessages = useMemo(() => {
    if (active === "jabatan") return msgsJabatan;
    return msgsAdmin;
  }, [active, msgsJabatan, msgsAdmin]);

  const setCurrentMessages = (fn: (prev: Message[]) => Message[]) => {
    if (active === "jabatan") setMsgsJabatan(fn);
    else setMsgsAdmin(fn);
  };

  // Fetch messages when tab/filter changes
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      try {
        let qs = new URLSearchParams();
        qs.set('type', active === 'jabatan' ? 'jabatan' : 'admin');
        if (active === 'jabatan' && selectedJabatan) qs.set('target_id', String(selectedJabatan));
        const d = await fetchJson<{ items: any[] }>(`/chat/messages?${qs.toString()}`);
        const items = Array.isArray(d?.items) ? d.items : [];
        const mapped: Message[] = items.map((x:any)=>({ id: String(x.id), sender: String(x.sender||''), text: String(x.text||''), ts: x.ts ? new Date(x.ts).getTime() : undefined }));
        if (active === 'jabatan') setMsgsJabatan(mapped);
        else setMsgsAdmin(mapped);
      } catch {
        // ignore if service not available
      } finally { setLoading(false); }
    };
    // only load when filters valid
    if (active === 'jabatan' && !selectedJabatan) return;
    if (active !== 'pengumuman') load();
  }, [open, active, selectedJabatan]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    if (active === "jabatan" && !selectedJabatan) {
      Swal.fire({ icon: "warning", title: "Pilih Jabatan", text: "Silakan pilih jabatan tujuan chat." });
      return;
    }
    if (active === "admin" && !canAdmin) {
      Swal.fire({ icon: "warning", title: "Tidak Diizinkan", text: "Hanya admin yang dapat mengirim pesan admin." });
      return;
    }
    if (active === "pengumuman") {
      Swal.fire({ icon: "info", title: "Pengumuman", text: "Pengumuman ditampilkan di sini, tidak dapat mengirim pesan." });
      return;
    }
    setLoading(true);
    try {
      const payload: any = { text };
      if (active === "jabatan") { payload.type = "jabatan"; payload.target_id = Number(selectedJabatan); }
      else { payload.type = "admin"; }

      // Coba kirim ke chat-service via gateway; fallback jika belum tersedia
      await fetchJson(`/chat/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      setCurrentMessages(prev => [...prev, { text, sender: "me", ts: Date.now() }]);
      setInput("");
    } catch (e: any) {
      // Tampilkan notifikasi ramah jika service belum aktif
      Swal.fire({ icon: "info", title: "Service Chat belum aktif", text: e?.message || "Gagal mengirim pesan. Coba lagi nanti." });
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        aria-label="Buka Chat"
        onClick={() => setOpen(o=>!o)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-indigo-600 text-white shadow-lg w-12 h-12 flex items-center justify-center hover:bg-indigo-500"
        title={open?"Tutup Chat":"Buka Chat"}
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M6.225 4.811a1 1 0 0 0-1.414 1.414L10.586 12l-5.775 5.775a1 1 0 0 0 1.414 1.414L12 13.414l5.775 5.775a1 1 0 0 0 1.414-1.414L13.414 12l5.775-5.775a1 1 0 0 0-1.414-1.414L12 10.586 6.225 4.811Z"/></svg>
        ) : (
          <span className="text-xl">💬</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 max-w-[90vw] rounded-2xl bg-white shadow-2xl border border-white/60 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
            <div className="flex gap-1">
              <button onClick={()=>setActive("jabatan")} className={`px-2 py-1 rounded-lg ${active==='jabatan'?'bg-white/20':''}`}>Jabatan</button>
              <button onClick={()=>setActive("pengumuman")} className={`px-2 py-1 rounded-lg ${active==='pengumuman'?'bg-white/20':''}`}>Pengumuman</button>
              <button onClick={()=>setActive("admin")} className={`px-2 py-1 rounded-lg ${active==='admin'?'bg-white/20':''}`}>Admin</button>
            </div>
            <button onClick={()=>setOpen(false)} title="Tutup" className="hover:bg-white/20 rounded p-1">
              ✖️
            </button>
          </div>

          {/* Filters for tabs */}
          <div className="px-3 py-2 border-b bg-white/70 backdrop-blur">
            {active === 'jabatan' && (
              <select value={selectedJabatan} onChange={e=>setSelectedJabatan(e.target.value ? Number(e.target.value) : "")} className="w-full px-2 py-1 rounded border">
                <option value="">Pilih Jabatan</option>
                {jabatans.map(j=> <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            )}
            {active === 'pengumuman' && (
              <p className="text-sm text-gray-600">Menampilkan pengumuman aktif untuk hari ini</p>
            )}
            {active === 'admin' && (
              <p className="text-sm text-gray-600">Chat dengan Administrator</p>
            )}
          </div>

          {/* Pengumuman ditampilkan sebagai daftar kartu saat tab pengumuman aktif */}

          {/* Messages */}
          <div className="h-52 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {active === 'pengumuman' ? (
              (() => {
                const now = new Date();
                const dayNames = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
                const hariIni = dayNames[now.getDay()];
                const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                const list = (announcements||[]).filter(it => {
                  const active = !!it.active;
                  const matchDay = Array.isArray(it.days) ? it.days.includes(hariIni) : true;
                  const matchDate = it.date ? it.date === todayStr : true;
                  return active && (matchDay || matchDate);
                }).slice(0,10);
                if (list.length === 0) return (<p className="text-sm text-gray-500">Tidak ada pengumuman untuk hari ini.</p>);
                return (
                  <div className="space-y-2">
                    {list.map((it) => (
                      <div key={it.id} className="rounded-xl bg-white border p-2">
                        <div className="text-sm font-semibold text-indigo-800">{it.title}</div>
                        <div className="text-xs text-gray-800 mt-1">{it.content}</div>
                        <div className="text-[11px] text-gray-600 mt-2">
                          {it.date ? (
                            <span>Tanggal: {new Date(it.date).toLocaleDateString()}</span>
                          ) : Array.isArray(it.days) ? (
                            <span>Hari: {it.days.join(", ")}</span>
                          ) : null}
                          {it.time && (
                            <span>{it.date || it.days ? " • " : ""}Jam: {it.time}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              currentMessages.length === 0 ? (
                <p className="text-sm text-gray-500">Belum ada pesan.</p>
              ) : currentMessages.map((m,i)=> (
                <div key={i} className={`flex ${m.sender==='me'?'justify-end':''}`}>
                  <div className={`px-3 py-2 rounded-2xl text-sm shadow-sm ${m.sender==='me'?'bg-indigo-600 text-white':'bg-white border'}`}>
                    <div>{m.text}</div>
                    {m.ts && (
                      <div className={`mt-1 text-[10px] ${m.sender==='me'?'text-white/80':'text-gray-500'}`}>{new Date(m.ts).toLocaleTimeString()}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white/70 backdrop-blur">
            {active === 'pengumuman' ? (
              <p className="text-xs text-gray-600">Pengumuman ditampilkan di sini. Tidak ada input pesan.</p>
            ) : (
              <>
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter') sendMessage(); }} placeholder="Ketik pesan..." className="flex-1 px-3 py-2 rounded-lg border" />
                <button disabled={loading} onClick={sendMessage} className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">Kirim</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}