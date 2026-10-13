import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="min-h-screen grid place-items-center bg-white">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <Loader2 className="animate-spin text-green-700" size={36} />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}