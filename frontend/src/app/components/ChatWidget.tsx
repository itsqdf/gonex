"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { fetchJson, authHeaders } from "@/lib/helpers";

type Message = { id?: string; sender?: string; text: string; ts?: number };
type Jabatan = { id: number; name: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<"jabatan"|"division"|"admin">("jabatan");
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [jabatans, setJabatans] = useState<Jabatan[]>([]);
  const [selectedJabatan, setSelectedJabatan] = useState<number|"">("");
  const [division, setDivision] = useState<string>("");
  const [msgsJabatan, setMsgsJabatan] = useState<Message[]>([]);
  const [msgsDivision, setMsgsDivision] = useState<Message[]>([]);
  const [msgsAdmin, setMsgsAdmin] = useState<Message[]>([]);

  // Prefetch daftar jabatan saat widget dibuka pertama kali
  useEffect(() => {
    if (!open || jabatans.length) return;
    const tok = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!tok) return;
    fetch(`${API_URL}/jabatan?limit=200`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r=>r.json().catch(()=>({})))
      .then(d=>{
        const arr = Array.isArray(d?.data) ? d.data : Array.isArray(d?.jabatan) ? d.jabatan : [];
        if (Array.isArray(arr)) setJabatans(arr.map((x:any)=>({ id:x.id, name:x.name })));
      })
      .catch(()=>{});
  }, [open, jabatans.length]);

  const currentMessages = useMemo(() => {
    if (active === "jabatan") return msgsJabatan;
    if (active === "division") return msgsDivision;
    return msgsAdmin;
  }, [active, msgsJabatan, msgsDivision, msgsAdmin]);

  const setCurrentMessages = (fn: (prev: Message[]) => Message[]) => {
    if (active === "jabatan") setMsgsJabatan(fn);
    else if (active === "division") setMsgsDivision(fn);
    else setMsgsAdmin(fn);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    if (active === "jabatan" && !selectedJabatan) {
      Swal.fire({ icon: "warning", title: "Pilih Jabatan", text: "Silakan pilih jabatan tujuan chat." });
      return;
    }
    setLoading(true);
    try {
      const payload: any = { text };
      if (active === "jabatan") { payload.type = "jabatan"; payload.target_id = Number(selectedJabatan); }
      else if (active === "division") { payload.type = "division"; payload.division = division || "general"; }
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
        <div className="fixed bottom-20 right-4 z-50 w-80 max-w-[90vw] rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-indigo-600 text-white">
            <div className="flex gap-1">
              <button onClick={()=>setActive("jabatan")} className={`px-2 py-1 rounded ${active==='jabatan'?'bg-white/20':''}`}>Jabatan</button>
              <button onClick={()=>setActive("division")} className={`px-2 py-1 rounded ${active==='division'?'bg-white/20':''}`}>Devisi</button>
              <button onClick={()=>setActive("admin")} className={`px-2 py-1 rounded ${active==='admin'?'bg-white/20':''}`}>Admin</button>
            </div>
            <button onClick={()=>setOpen(false)} title="Tutup" className="hover:bg-white/20 rounded p-1">
              ✖️
            </button>
          </div>

          {/* Filters for tabs */}
          <div className="px-3 py-2 border-b">
            {active === 'jabatan' && (
              <select value={selectedJabatan} onChange={e=>setSelectedJabatan(e.target.value ? Number(e.target.value) : "")} className="w-full px-2 py-1 rounded border">
                <option value="">Pilih Jabatan</option>
                {jabatans.map(j=> <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            )}
            {active === 'division' && (
              <input value={division} onChange={e=>setDivision(e.target.value)} placeholder="Nama Devisi (opsional)" className="w-full px-2 py-1 rounded border" />
            )}
            {active === 'admin' && (
              <p className="text-sm text-gray-600">Chat dengan Administrator</p>
            )}
          </div>

          {/* Messages */}
          <div className="h-48 overflow-y-auto px-3 py-2 space-y-2 bg-gray-50">
            {currentMessages.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada pesan.</p>
            ) : currentMessages.map((m,i)=> (
              <div key={i} className={`flex ${m.sender==='me'?'justify-end':''}`}>
                <div className={`px-2 py-1 rounded-lg text-sm ${m.sender==='me'?'bg-indigo-600 text-white':'bg-white border'}`}>{m.text}</div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2">
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter') sendMessage(); }} placeholder="Ketik pesan..." className="flex-1 px-3 py-2 rounded border" />
            <button disabled={loading} onClick={sendMessage} className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">Kirim</button>
          </div>
        </div>
      )}
    </>
  );
}