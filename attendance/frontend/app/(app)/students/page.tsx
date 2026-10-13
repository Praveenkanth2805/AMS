"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Upload } from "lucide-react";

import { Api, ApiError } from "@/lib/api";
import type { Student } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { type Column } from "@/components/ui/DataTable";
import SearchInput from "@/components/ui/SearchInput";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StudentFormModal from "@/components/students/StudentFormModal";
import { useToast } from "@/components/ui/ToastProvider";
import StudentImportModal from "@/components/students/StudentImportModal";

export default function StudentsPage() {
  const { push } = useToast();
const [showImport, setShowImport] = useState(false);
const [confirmHardDelete, setConfirmHardDelete] = useState(false);
  const [rows, setRows] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await Api.students({ q, page, page_size: 25 });
      setRows(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load students.");
    } finally { setLoading(false); }
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<Student>[] = [
    { key: "roll", header: "Roll No", cell: (r) => r.roll_no },
    { key: "name", header: "Name", cell: (r) => r.name },
    { key: "reg", header: "Register No", cell: (r) => r.register_no ?? "—" },
    { key: "emis", header: "EMIS", cell: (r) => r.emis ?? "—" },
    { key: "status", header: "Status",
      cell: (r) => <StatusBadge value={r.is_active ? "active" : "inactive"} /> },
        { key: "actions", header: "", align: "right", cell: (r) => (
      r.is_active ? (
        <div className="flex justify-end gap-3">
          <button onClick={() => setConfirmId(r.id)}
                  className="text-sm text-gray-600 hover:text-gray-900 underline">
            Deactivate
          </button>
          <button onClick={() => { setConfirmId(null); setConfirmHardDelete(true); setConfirmId(r.id); }}
                  className="text-sm text-red-700 underline">
            Delete
          </button>
        </div>
      ) : null
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="Students"
        description="Create, view and manage students."
        actions={
  <div className="flex gap-2">
    <button
      onClick={() => setShowImport(true)}
      className="inline-flex items-center gap-2 rounded-md border border-green-700
                 px-3 py-2 text-sm text-green-700 hover:bg-green-50"
    >
      <Upload size={16} /> Import
    </button>
    <button
      onClick={() => setShowForm(true)}
      className="inline-flex items-center gap-2 rounded-md bg-green-700 px-3 py-2 text-sm
                 text-white hover:bg-green-800"
    >
      <Plus size={16} /> Add Student
    </button>
  </div>
}
      />

      <div className="space-y-3">
        <SearchInput value={q} onChange={(v) => { setPage(1); setQ(v); }}
                     placeholder="Search by name, roll or register no" />

        {loading && rows.length === 0 && (
          <div className="rounded-lg border border-gray-200 overflow-hidden animate-pulse">
            <div className="h-10 bg-green-50/50" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 border-t border-gray-100 bg-gray-50/40" />
            ))}
          </div>
        )}
        {error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && rows.length === 0 && (
          <EmptyState title="No students found"
                      description="Adjust your search or add a new student." />
        )}

        {rows.length > 0 && (
          <>
            <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Total: {total}</span>
              <div className="flex gap-2">
                <button disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50">
                  Prev
                </button>
                <button disabled={page * 25 >= total}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50">
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <StudentFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={() => {
          push("success", "Student created.");
          load();
        }}
      />
<StudentImportModal
  open={showImport}
  onClose={() => setShowImport(false)}
  onImported={(n) => {
    push("success", `${n} students imported.`);
    load();
  }}
/>
      <ConfirmDialog
        open={!!confirmId}
        title="Deactivate student?"
        description="This preserves attendance history and hides the student from active rosters."
        confirmLabel="Deactivate" tone="danger"
        onCancel={() => { setConfirmId(null); setConfirmHardDelete(false); }}
        onConfirm={async () => {
          if (!confirmId) return;
          try {
            await Api.deactivateStudent(confirmId);
            push("success", "Student deactivated.");
            setConfirmId(null);
            load();
          } catch {
            push("error", "Could not deactivate student.");
          }
        }}
      />
            <ConfirmDialog
        open={!!confirmId && confirmHardDelete}
        title="Permanently delete student?"
        description="This removes the student AND all their attendance records. Sessions that become empty are removed too. This cannot be undone."
        confirmLabel="Delete forever" tone="danger"
        onCancel={() => { setConfirmId(null); setConfirmHardDelete(false); }}
        onConfirm={async () => {
          if (!confirmId) return;
          try {
            const res = await Api.hardDeleteStudent(confirmId);
            push("success",
              `Student deleted. ${res.attendance_records_removed} attendance record(s) removed.`);
            setConfirmId(null);
            setConfirmHardDelete(false);
            load();
          } catch {
            push("error", "Could not delete student.");
          }
        }}
      />
    </div>
  );
}