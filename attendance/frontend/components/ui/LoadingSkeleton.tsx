import { cn } from "@/lib/utils";

export default function LoadingSkeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}