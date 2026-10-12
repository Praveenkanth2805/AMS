import { redirect } from "next/navigation";
import { Api, ApiError } from "@/lib/api";
import AppSidebar from "@/components/layout/AppSidebar";
import Topbar from "@/components/layout/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Note: middleware also redirects, but backend is authoritative (spec §7).
  let user;
  try {
    user = await Api.me();
  } catch (err) {
    if (err instanceof ApiError && err.isUnauthenticated) redirect("/login");
    throw err;
  }

  return (
    <div className="min-h-screen flex bg-white text-gray-900">
      <AppSidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}