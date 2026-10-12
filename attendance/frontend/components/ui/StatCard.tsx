import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export default function StatCard({
  label, value, hint, Icon, tone = "default",
}: {
  label: string; value: string | number; hint?: string;
  Icon?: LucideIcon; tone?: "default" | "success" | "danger" | "muted";
}) {
  const toneCls = {
    default: "border-gray-200",
    success: "border-green-200",
    danger:  "border-red-200",
    muted:   "border-gray-200",
  }[tone];

  return (
    <div className={cn("rounded-lg border bg-white p-4", toneCls)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        {Icon && <Icon size={18} className="text-gray-400" />}
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}