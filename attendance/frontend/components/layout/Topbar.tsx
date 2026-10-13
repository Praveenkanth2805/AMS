"use client";
import { useRouter } from "next/navigation";
import { LogOut, UserCircle2 } from "lucide-react";
import { Api } from "@/lib/api";
import MobileNavigation from "./MobileNavigation";
import type { User } from "@/lib/types";

export default function Topbar({ user }: { user: User }) {
  const router = useRouter();

  async function logout() {
    try {
      await Api.logout();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <header className="z-30 flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <MobileNavigation />
        <span className="text-sm font-semibold text-green-800 md:hidden">
          SM&apos;s AMS
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-gray-700 sm:inline">
          {user.name}
        </span>
        <UserCircle2 size={20} className="text-gray-500" />
        <button
          onClick={logout}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </header>
  );
}
