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