import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  // Redirect ke halaman default Admin agar tidak 404
  redirect("/dashboard/admin/users");
}
