"use client";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function ErrorState({
  message, onRetry,
}: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert"
         className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700 text-sm flex items-start gap-3">
      <AlertCircle size={18} className="mt-0.5" />
      <div className="flex-1">
        <div>{message}</div>
        {onRetry && (
          <button onClick={onRetry}
                  className="mt-2 inline-flex items-center gap-1 text-red-800 underline">
            <RotateCcw size={14} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}