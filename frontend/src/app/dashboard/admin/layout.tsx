import Sidebar from "../../components/Sidebar";
import ChatWidget from "../../components/ChatWidget";
import SessionGuard from "../../components/SessionGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <SessionGuard />
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-64">
        {children}
      </main>
      <ChatWidget />
    </div>
  );
}