"use client";

import { useState } from "react";
import { Button } from "flowbite-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const endpoint = `${API_URL}/auth/login`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : null;
      if (!res.ok) {
        const msg = data?.error || (res.status === 401 ? "Email atau password salah" : "Login gagal");
        throw new Error(msg);
      }
      const token = data?.token;
      if (token) {
        localStorage.setItem("token", token);
        // Also set cookie for middleware
        document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Lax`;
      }
      setSuccess(`Selamat datang, ${data?.user?.nama || "pengguna"}!`);
      // Redirect ke dashboard setelah login
      setTimeout(() => {
        window.location.href = "/dashboard/admin";
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-fuchsia-50 to-purple-100 flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm sm:max-w-md">
        <div className="relative rounded-2xl shadow-2xl bg-white p-6 sm:p-8 border border-gray-200">
          {/* Logo dan Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="/golang_ac.png" 
                alt="Golang Logo" 
                className="h-16 w-16 sm:h-20 sm:w-20"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Apps Super</h1>
            <p className="text-sm text-gray-600">Powered by Go & Next.js</p>
            <p className="text-xs text-gray-500 mt-1">Masuk ke akun Anda</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">

          <div className="relative">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              placeholder=" "
              autoComplete="off"
              required
              className="peer block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600"
            />
            <label
              htmlFor="email"
              className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-3"
            >
              Email
            </label>
          </div>

            <div className="relative">
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                placeholder=" "
                autoComplete="off"
                required
              className="peer block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-blue-600 pr-10"
            />
            <label
              htmlFor="password"
              className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 left-3"
            >
              Password
            </label>
              <button
                type="button"
                aria-label={showPwd ? "Sembunyikan password" : "Tampilkan password"}
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200"
              >
                {showPwd ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M3.53 2.47a.75.75 0 011.06 0l16.94 16.94a.75.75 0 11-1.06 1.06l-2.63-2.63A11.78 11.78 0 0112 20.25c-5.27 0-9.83-3.3-11.56-8.08a1.41 1.41 0 010-.34 12.77 12.77 0 013.97-5.83L3.53 3.53a.75.75 0 010-1.06zM8.73 7.67l1.36 1.36A3.75 3.75 0 0115 12c0 .5-.1.97-.27 1.4l1.1 1.1A5.25 5.25 0 008.75 7.5c-.01.06-.02.11-.02.17z" />
                    <path d="M12 5.25c5.27 0 9.83 3.3 11.56 8.08.05.11.05.23 0 .34-.76 2.06-2.05 3.83-3.69 5.17l-2.2-2.2A5.25 5.25 0 0012 6.75c-.45 0-.88.06-1.3.17l-1.5-1.5c.94-.11 1.92-.17 2.8-.17z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M12 5.25c-5.27 0-9.83 3.3-11.56 8.08a1.41 1.41 0 000 .34C2.17 18.55 6.73 21.75 12 21.75s9.83-3.2 11.56-8.08c.05-.11.05-.23 0-.34C21.83 8.55 17.27 5.25 12 5.25zm0 12a3.75 3.75 0 110-7.5 3.75 3.75 0 010 7.5z" />
                  </svg>
                )}
              </button>
            </div>

            <button
  type="submit"
  disabled={loading}
  className={`
    relative inline-flex items-center justify-center w-full gap-4 px-5 py-2.5 mb-2 
    text-sm font-medium rounded-lg border border-gray-300 text-gray-900
    bg-white transition-all duration-300 ease-in-out 
    hover:text-white hover:border-transparent 
    hover:bg-gradient-to-br hover:from-teal-400 hover:to-lime-400
    focus:ring-4 focus:outline-none focus:ring-lime-200
    ${loading ? "opacity-70 cursor-not-allowed" : ""}
  `}
>
  {loading ? (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
        <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Z" />
      </svg>
      Memproses...
    </>
  ) : (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="h-4 w-4" viewBox="0 0 24 24">
        <path d="M13.293 4.293a1 1 0 0 1 1.414 0l6 6a1 1 0 0 1 0 1.414l-6 6a1 1 0 1 1-1.414-1.414L17.586 12l-4.293-4.293a1 1 0 0 1 0-1.414Z"/>
        <path d="M3 12a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Z"/>
      </svg>
      Masuk ke Dashboard
    </>
  )}
</button>

            
            {/* Info dan Demo Credentials */}
            <div className="mt-6 space-y-3">
              <div className="text-center">
                <p className="text-xs text-gray-600">
                  Hanya pengguna dengan status <span className="font-semibold text-green-600">Aktif</span> yang dapat login.
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">Demo Credentials:</p>
                <div className="text-xs text-gray-600 space-y-1">
                  <p><span className="font-medium">Email:</span> superadmin@example.com</p>
                  <p><span className="font-medium">Password:</span> password123</p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}