import { Loader2 } from "lucide-react";

export default function AppGroupLoading() {
  return (
    <div className="flex-1 grid place-items-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <Loader2 className="animate-spin text-green-700" size={36} />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}