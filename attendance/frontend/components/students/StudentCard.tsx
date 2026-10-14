"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Student } from "@/lib/types";

interface Props {
  student: Student;
  canWrite: boolean;
  onEdit: (s: Student) => void;
  onDelete: (s: Student) => void;
}

export default function StudentCard({ student, canWrite, onEdit, onDelete }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {student.name}
          </div>
          <div className="text-xs text-gray-500 tabular-nums">
            Roll: {student.roll_no}
          </div>
        </div>
        {canWrite && (
          <div className="shrink-0 flex items-center gap-1">
            <button
              onClick={() => onEdit(student)}
              aria-label="Edit student"
              className="inline-flex items-center gap-1 rounded-md border border-gray-300
                         px-2 py-1 text-xs hover:bg-gray-50"
            >
              <Pencil size={12} /> Edit
            </button>
            <button
              onClick={() => onDelete(student)}
              aria-label="Delete student"
              className="inline-flex items-center gap-1 rounded-md border border-red-200
                         px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <Field label="Register No" value={student.register_no} />
        <Field label="EMIS" value={student.emis} />
        <Field label="UMIS" value={student.umis} />
        <Field label="Mobile" value={student.mobile} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-gray-400">{label}</div>
      <div className="text-gray-800 truncate">{value || "—"}</div>
    </div>
  );
}