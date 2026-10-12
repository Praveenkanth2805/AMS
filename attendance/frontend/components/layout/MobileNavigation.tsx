"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, LayoutDashboard, CalendarCheck, Users, FileBarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/attendance", label: "Attendance", Icon: CalendarCheck },
  { href: "/students", label: "Students", Icon: Users },
  { href: "/reports", label: "Reports", Icon: FileBarChart2 },
];

export default function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        className="md:hidden p-2 rounded-md hover:bg-gray-100"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu size={20} />
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl p-3">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="font-semibold text-green-800">Attendance</span>
              <button aria-label="Close navigation" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <nav aria-label="Mobile" className="mt-3 space-y-1">
              {ITEMS.map(({ href, label, Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link key={href} href={href}
                        className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                          active ? "bg-green-50 text-green-800 font-medium"
                                 : "text-gray-700 hover:bg-gray-50")}>
                    <Icon size={18} />{label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}