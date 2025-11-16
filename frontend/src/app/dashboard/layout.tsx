import AnnouncementBanner from "../components/AnnouncementBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-purple-100">
      <AnnouncementBanner />
      <main className="min-w-0">{children}</main>
    </div>
  );
}