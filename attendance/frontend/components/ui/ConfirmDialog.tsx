"use client";
import { useEffect, useRef } from "react";

export default function ConfirmDialog({
  open, title, description, confirmLabel = "Confirm",
  cancelLabel = "Cancel", tone = "default", onConfirm, onCancel,
}: {
  open: boolean; title: string; description?: string;
  confirmLabel?: string; cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cfm-title"
         className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 id="cfm-title" className="text-lg font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-600 mt-2">{description}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            {cancelLabel}
          </button>
          <button ref={ref} onClick={onConfirm}
                  className={`rounded-md px-3 py-2 text-sm text-white ${
                    tone === "danger" ? "bg-red-600 hover:bg-red-700"
                                      : "bg-green-700 hover:bg-green-800"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}