import { redirect } from "next/navigation";

export default function Home() {
  // Server-side redirect agar root selalu mengarah ke /login
  redirect("/login");
}
