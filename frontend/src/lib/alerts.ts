"use client";

import Swal from "sweetalert2";

export async function confirmDelete(title: string, text?: string, confirmText = "Ya, hapus") {
  const res = await Swal.fire({ title, text, icon: "warning", showCancelButton: true, confirmButtonText: confirmText });
  return res.isConfirmed;
}

export async function confirm(title: string, text?: string, confirmText = "Ya") {
  const res = await Swal.fire({ title, text, icon: "question", showCancelButton: true, confirmButtonText: confirmText });
  return res.isConfirmed;
}

export function success(title: string, text?: string) {
  return Swal.fire({ title, text, icon: "success" });
}

export function error(title: string, text?: string) {
  return Swal.fire({ title, text, icon: "error" });
}

export function warn(title: string, text?: string) {
  return Swal.fire({ title, text, icon: "warning" });
}

export function notifyBell(title: string, html?: string) {
  const bellSvg = `
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='48' height='48'>
      <path fill='currentColor' d='M12 2a6 6 0 0 0-6 6v3.59l-1.29 1.3A1 1 0 0 0 5 14h14a1 1 0 0 0 .73-1.71L18 11.59V8a6 6 0 0 0-6-6Zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3Z'/>
    </svg>
  `;
  return Swal.fire({
    title,
    html,
    iconHtml: bellSvg,
    customClass: {
      popup: 'rounded-2xl shadow-xl',
      title: 'text-xl font-semibold',
    },
    background: '#ffffff',
    color: '#111827',
    showCloseButton: true,
    showConfirmButton: false,
  });
}