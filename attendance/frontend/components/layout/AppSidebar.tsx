"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, LayoutDashboard, Users, FileBarChart2 } from "lucide-react";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/attendance", label: "Attendance", Icon: CalendarCheck },
  { href: "/students", label: "Students", Icon: Users },
  { href: "/reports", label: "Reports", Icon: FileBarChart2 },
];

export default function AppSidebar({ user }: { user: User }) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-56 lg:w-64 flex-col border-r border-gray-200 bg-white">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="font-semibold text-green-800">Attendance</div>
        <div className="text-xs text-gray-500 mt-0.5">{user.role}</div>
      </div>
      <nav aria-label="Main" className="p-3 space-y-1">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                    active ? "bg-green-50 text-green-800 font-medium"
                           : "text-gray-700 hover:bg-gray-50")}>
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}