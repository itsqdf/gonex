"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_MS = 15 * 60 * 1000; // 15 menit

export default function SessionGuard() {
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          localStorage.removeItem("token");
        } catch {}
        router.push("/login");
      }, INACTIVITY_MS);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"]; 
    events.forEach(ev => window.addEventListener(ev, resetTimer));
    resetTimer(); // start timer awal

    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router]);

  return null;
}