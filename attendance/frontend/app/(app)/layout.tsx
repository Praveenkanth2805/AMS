import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ServerApiError, serverFetchMe, type ServerUser } from "@/lib/api-server";
import AppSidebar from "@/components/layout/AppSidebar";
import Topbar from "@/components/layout/Topbar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieHeader = cookies().toString();

  if (!cookieHeader.includes("access_token=")) {
    redirect("/login");
  }

  let user: ServerUser;
  try {
    user = await serverFetchMe(cookieHeader);
  } catch (err) {
    if (err instanceof ServerApiError) {
      if (err.isUnauthenticated) redirect("/login");
      throw new Error(`Auth check failed: ${err.message}`);
    }
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
