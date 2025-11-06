import { NextResponse } from "next/server";

type LoginBody = { email?: string; password?: string };

const DEMO_USERS: Record<string, { password: string; user: any }> = {
  "superadmin@example.com": {
    password: "password123",
    user: {
      id: 1,
      nama: "Super Admin",
      email: "superadmin@example.com",
      role: "superadmin",
      roles: ["SuperAdmin"],
      status: "aktif",
    },
  },
  "admin@local": {
    password: "admin123",
    user: {
      id: 2,
      nama: "Admin Local",
      email: "admin@local",
      role: "admin",
      roles: ["Admin"],
      status: "aktif",
    },
  },
  "programmer@gmail.com": {
    password: "password",
    user: {
      id: 3,
      nama: "Programmer",
      email: "programmer@gmail.com",
      role: "superadmin",
      roles: ["SuperAdmin"],
      status: "aktif",
    },
  },
};

export async function POST(req: Request) {
  try {
    const body: LoginBody = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const entry = DEMO_USERS[email];
    if (!entry || entry.password !== password) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }

    const token = "demo-token";
    const res = NextResponse.json({ token, user: entry.user });
    // Set cookie agar middleware bisa mendeteksi token
    res.cookies.set("token", token, { path: "/", maxAge: 60 * 60 * 24 });
    return res;
  } catch {
    return NextResponse.json({ error: "Login gagal" }, { status: 400 });
  }
}