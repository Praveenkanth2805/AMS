"use client";

import { useState } from "react";
import { LogOut, UserCircle2, Loader2 } from "lucide-react";
import { Api } from "@/lib/api";
import MobileNavigation from "./MobileNavigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { User } from "@/lib/types";

export default function Topbar({ user }: { user: User }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function doLogout() {
    setSigningOut(true);
    try {
      await Api.logout();
    } catch {
      // Navigation continues even if the logout request fails.
    } finally {
      setSigningOut(false);
      setConfirmOpen(false);
      window.location.href = "/login";
    }
  }

  return (
    <>
      <header className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
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
            onClick={() => setConfirmOpen(true)}
            disabled={signingOut}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {signingOut ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogOut size={16} />
            )}
            <span className="hidden sm:inline">
              {signingOut ? "Signing out…" : "Sign out"}
            </span>
          </button>
        </div>
      </header>

      <ConfirmDialog
        open={confirmOpen}
        title="Sign out?"
        description="You will need to sign in again to access your account."
        confirmLabel={signingOut ? "Signing out…" : "Sign out"}
        cancelLabel="Stay signed in"
        tone="danger"
        onCancel={() => !signingOut && setConfirmOpen(false)}
        onConfirm={doLogout}
      />
    </>
  );
}