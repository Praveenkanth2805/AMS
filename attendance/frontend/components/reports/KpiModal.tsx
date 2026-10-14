"use client";

import { X } from "lucide-react";

interface Student {
  student_id: string;
  name: string;
  roll_no: string;
  percentage: number;
}

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  students: Student[];
  tone?: "success" | "warning" | "danger" | "muted";
  onClose: () => void;
}

const TONE: Record<string, string> = {
  success: "text-green-700 bg-green-50 border-green-200",
  warning: "text-yellow-800 bg-yellow-50 border-yellow-200",
  danger: "text-red-700 bg-red-50 border-red-200",
  muted: "text-gray-700 bg-gray-50 border-gray-200",
};

export default function KpiModal({
  open, title, subtitle, students, tone = "muted", onClose,
}: Props) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-lg bg-white shadow-xl">
        <div className={`flex items-center justify-between border-b px-5 py-3 rounded-t-lg ${TONE[tone]}`}>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="text-xs opacity-80">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close"
                  className="rounded-md p-1 hover:bg-white/50">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {students.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">
              No students in this bucket.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2 font-medium w-[120px]">Roll No</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium text-right w-[100px]">%</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.student_id} className="border-b border-gray-50">
                    <td className="px-3 py-1.5 tabular-nums text-gray-700">{s.roll_no}</td>
                    <td className="px-3 py-1.5">{s.name}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                      {s.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-3 flex justify-end">
          <button onClick={onClose}
                  className="rounded-md border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}