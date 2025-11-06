import { NextResponse } from "next/server";

function getTokenFromReq(req: Request): string | null {
  try {
    // From Authorization header
    const auth = (req.headers as any).get?.("authorization") || "";
    if (auth.toLowerCase().startsWith("bearer ")) {
      return auth.slice(7).trim();
    }
  } catch {}
  return null;
}

export async function GET(req: Request) {
  // Demo-only implementation: validates the token set by /api/auth/login
  const token = getTokenFromReq(req) || null;
  const cookieHeader = (req.headers as any).get?.("cookie") || "";
  const cookieToken = /(?:^|;\s*)token=([^;]+)/.exec(cookieHeader)?.[1] || null;
  const effective = token || cookieToken;

  if (!effective || effective !== "demo-token") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: 1,
    nama: "Super Admin",
    email: "superadmin@example.com",
    role: "admin",
    roles: ["admin"],
    status: "aktif",
  });
}