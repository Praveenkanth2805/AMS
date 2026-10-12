"use client";
import { useRouter } from "next/navigation";
import { LogOut, UserCircle2 } from "lucide-react";
import { Api } from "@/lib/api";
import MobileNavigation from "./MobileNavigation";
import type { User } from "@/lib/types";

export default function Topbar({ user }: { user: User }) {
  const router = useRouter();

  async function logout() {
    try { await Api.logout(); } finally { router.replace("/login"); }
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3
                       border-b border-gray-200 bg-white/95 backdrop-blur px-4 py-3">
      <div className="flex items-center gap-2">
        <MobileNavigation />
        <span className="text-sm text-gray-500 md:hidden">Attendance</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-sm text-gray-700">{user.name}</span>
        <UserCircle2 size={20} className="text-gray-500" />
        <button onClick={logout}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </header>
  );
}