"use client";
import { WifiOff } from "lucide-react";

export default function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert"
         className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-yellow-900 text-sm flex items-start gap-3">
      <WifiOff size={18} className="mt-0.5" />
      <div className="flex-1">
        <div>You appear to be offline. Your draft is preserved.</div>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 underline">Retry</button>
        )}
      </div>
    </div>
  );
}