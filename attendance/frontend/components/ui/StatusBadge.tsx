import { cn } from "@/lib/utils";

const MAP: Record<string, string> = {
  present: "bg-green-100 text-green-800 border-green-200",
  absent:  "bg-red-50 text-red-700 border-red-200",
  active:  "bg-green-100 text-green-800 border-green-200",
  inactive:"bg-gray-100 text-gray-700 border-gray-200",
  admin:   "bg-brand-100 text-brand-800 border-brand-200",
  teacher: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function StatusBadge({
  value, className,
}: { value: string; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
      MAP[value] ?? "bg-gray-100 text-gray-700 border-gray-200",
      className,
    )}>
      {value}
    </span>
  );
}