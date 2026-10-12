"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type Kind = "success" | "error" | "info";
interface Toast { id: string; kind: Kind; message: string }
interface Ctx { push: (kind: Kind, message: string) => void }

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Kind, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="true"
           className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map((t) => (
          <div key={t.id}
               role={t.kind === "error" ? "alert" : "status"}
               className={`flex items-start gap-3 rounded-md shadow-lg px-4 py-3 text-sm border
                 ${t.kind === "success" ? "bg-green-50 border-green-200 text-green-800"
                 : t.kind === "error" ? "bg-red-50 border-red-200 text-red-800"
                 : "bg-gray-50 border-gray-200 text-gray-800"}`}>
            {t.kind === "success" && <CheckCircle2 size={18} />}
            {t.kind === "error" && <AlertCircle size={18} />}
            {t.kind === "info" && <Info size={18} />}
            <span className="flex-1">{t.message}</span>
            <button aria-label="Dismiss"
                    onClick={() => setToasts((s) => s.filter((x) => x.id !== t.id))}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}