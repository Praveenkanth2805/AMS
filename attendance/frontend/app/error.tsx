"use client";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-6">
      <div className="max-w-md mx-auto rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto text-red-600 mb-3" size={32} />
        <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
        <p className="text-sm text-red-700 mt-1">
          We could not complete the request. Please try again.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 text-white text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  );
}