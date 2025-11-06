"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type Thread = { id?: number; title: string };
type Message = { id?: number; thread_id: number; content: string; user_id?: number };

export default function ChatPage() {
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const loadThreads = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/chat/threads`, { headers });
      const d = await r.json().catch(() => ({}));
      const items = Array.isArray((d as any).items) ? (d as any).items : [];
      setThreads(items);
    } catch {}
    finally { setLoading(false); }
  };

  const loadMessages = async (thread: Thread) => {
    if (!thread?.id) return;
    try {
      const r = await fetch(`${API_URL}/chat/messages?thread_id=${thread.id}`, { headers });
      const d = await r.json().catch(() => ({}));
      setMessages(Array.isArray((d as any).items) ? (d as any).items : []);
    } catch {}
  };

  useEffect(() => { loadThreads(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const createThread = async () => {
    if (!newThreadTitle.trim()) return;
    try {
      const r = await fetch(`${API_URL}/chat/threads`, { method: "POST", headers, body: JSON.stringify({ title: newThreadTitle }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || `Gagal membuat thread (${r.status})`);
      setNewThreadTitle("");
      await loadThreads();
    } catch (e: any) { alert(e?.message || "Gagal membuat thread"); }
  };

  const sendMessage = async () => {
    if (!selected?.id || !newMessage.trim()) return;
    try {
      const r = await fetch(`${API_URL}/chat/messages`, { method: "POST", headers, body: JSON.stringify({ thread_id: selected.id, content: newMessage }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as any)?.error || `Gagal mengirim pesan (${r.status})`);
      setNewMessage("");
      await loadMessages(selected);
    } catch (e: any) { alert(e?.message || "Gagal mengirim pesan"); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100 p-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-black font-medium">Threads</h3>
            <button onClick={loadThreads} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 shadow">Refresh</button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input value={newThreadTitle} onChange={e=>setNewThreadTitle(e.target.value)} placeholder="Judul thread" className="px-3 py-2 rounded border w-full" />
            <button onClick={createThread} className="rounded px-3 py-2 bg-green-600 text-white">Tambah</button>
          </div>
          {loading ? (
            <p className="text-gray-600">Memuat threads...</p>
          ) : threads.length === 0 ? (
            <p className="text-gray-600">Belum ada thread.</p>
          ) : (
            <ul className="space-y-2">
              {threads.map(t => (
                <li key={t.id}>
                  <button onClick={()=>{setSelected(t); loadMessages(t);}} className={`w-full text-left px-3 py-2 rounded border ${selected?.id===t.id?'bg-indigo-50 border-indigo-200':'bg-white'}`}>{t.title}</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-2 rounded-2xl bg-white/80 backdrop-blur border border-white/60 p-4 shadow">
          <h3 className="text-black font-medium mb-3">Pesan {selected ? `• ${selected.title}` : ''}</h3>
          {!selected ? (
            <p className="text-gray-600">Pilih thread untuk melihat pesan.</p>
          ) : (
            <div className="flex flex-col h-[60vh]">
              <div className="flex-1 overflow-y-auto space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className="px-3 py-2 rounded border bg-white">
                    <p className="text-sm text-black">{m.content}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input value={newMessage} onChange={e=>setNewMessage(e.target.value)} placeholder="Tulis pesan..." className="px-3 py-2 rounded border w-full" />
                <button onClick={sendMessage} className="rounded px-3 py-2 bg-indigo-600 text-white">Kirim</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}