import { NextResponse } from "next/server";

function getTokenFromReq(req: Request): string | null {
  try {
    const auth = (req.headers as any).get?.("authorization") || "";
    if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  } catch {}
  const cookieHeader = (req.headers as any).get?.("cookie") || "";
  const m = /(?:^|;\s*)token=([^;]+)/.exec(cookieHeader);
  return m ? m[1] : null;
}

export async function GET(req: Request) {
  const tok = getTokenFromReq(req);
  if (!tok || tok !== "demo-token") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Permissions selaras dengan seed SuperAdmin/Admin agar menu Sidebar muncul
  const permissions = [
    "manage",
    "menu_master_data",
    "menu_hak_akses",
    "menu_kas",
    "menu_produk",
    "menu_ruangan",
    "menu_setting",
    "menu_asset_perusahaan",
    "menu_presensi",
    "menu_payment",
    "menu_chat",
    "menu_ml",
  ];

  return NextResponse.json({ permissions });
}