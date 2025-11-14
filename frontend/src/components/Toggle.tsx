"use client";

import Swal from "sweetalert2";
import React from "react";

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  activeLabel?: string;
  inactiveLabel?: string;
  confirmOnDeactivate?: boolean;
  confirmOnActivate?: boolean;
  confirmText?: string;
  confirmTextActivate?: string;
  size?: "sm" | "md";
};

export default function Toggle({
  checked,
  onChange,
  activeLabel = "Aktif",
  inactiveLabel = "Tidak Aktif",
  confirmOnDeactivate = false,
  confirmOnActivate = false,
  confirmText = "Matikan status pengguna?",
  confirmTextActivate = "Nyalakan status pengguna?",
  size = "sm",
}: ToggleProps) {
  const isActive = !!checked;
  const cls = isActive
    ? "bg-green-600 hover:bg-green-700 text-white border-green-700/40"
    : "bg-rose-600 hover:bg-rose-700 text-white border-rose-700/40";
  const pad = size === "md" ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-xs";

  const handleClick = async () => {
    const next = !isActive;
    if (confirmOnDeactivate && isActive && !next) {
      const ok = await Swal.fire({
        title: "Konfirmasi",
        text: confirmText,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, matikan",
        cancelButtonText: "Batal",
      });
      if (!ok.isConfirmed) return;
    }
    if (confirmOnActivate && !isActive && next) {
      const ok = await Swal.fire({
        title: "Konfirmasi",
        text: confirmTextActivate,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Ya, nyalakan",
        cancelButtonText: "Batal",
      });
      if (!ok.isConfirmed) return;
    }
    onChange(next);
  };

  return (
    <button
      onClick={handleClick}
      role="switch"
      aria-checked={isActive}
      className={`inline-flex items-center rounded-full ${pad} font-medium border transition-colors ${cls}`}
      title={isActive ? "Matikan" : "Nyalakan"}
    >
      <span className="inline-block w-2 h-2 rounded-full mr-2 bg-white" />
      {isActive ? activeLabel : inactiveLabel}
    </button>
  );
}