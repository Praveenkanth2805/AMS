"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";

import { Api, ApiError } from "@/lib/api";
import type { Student } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { type Column } from "@/components/ui/DataTable";
import SearchInput from "@/components/ui/SearchInput";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StudentFormModal from "@/components/students/StudentFormModal";
import StudentImportModal from "@/components/students/StudentImportModal";
import StudentCard from "@/components/students/StudentCard";
import { useCanWrite } from "@/components/providers/UserProvider";
import { useToast } from "@/components/ui/ToastProvider";

const PAGE_SIZE = 25;

export default function StudentsPage() {
  const { push } = useToast();
  const canWrite = useCanWrite();

  const [rows, setRows] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [showImport, setShowImport] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await Api.students({ q, page, page_size: PAGE_SIZE });
      setRows(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load students.");
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(s: Student) {
    setEditing(s);
    setShowForm(true);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Column<Student>[] = [
    { key: "roll", header: "Roll No", cell: (r) => r.roll_no },
    { key: "name", header: "Name", cell: (r) => r.name },
    { key: "reg", header: "Register No", cell: (r) => r.register_no ?? "—" },
    { key: "emis", header: "EMIS", cell: (r) => r.emis ?? "—" },
    { key: "umis", header: "UMIS", cell: (r) => r.umis ?? "—" },
    { key: "mobile", header: "Mobile", cell: (r) => r.mobile ?? "—" },
    ...(canWrite
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            cell: (r: Student) => (
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => openEdit(r)}
                  className="inline-flex items-center gap-1 text-sm text-green-700 hover:underline"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(r)}
                  className="inline-flex items-center gap-1 text-sm text-red-700 hover:underline"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col h-full -m-4 lg:-m-6">
      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6 space-y-3">
        <PageHeader
          title="Students"
          description={
            canWrite
              ? "Create, view and manage students."
              : "View student roster. Contact an admin to make changes."
          }
          actions={
            canWrite && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImport(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-green-700
                             px-3 py-2 text-sm text-green-700 hover:bg-green-50"
                >
                  <Upload size={16} /> Import
                </button>
                <button
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 rounded-md bg-green-700 px-3 py-2
                             text-sm text-white hover:bg-green-800"
                >
                  <Plus size={16} /> Add Student
                </button>
              </div>
            )
          }
        />

        <SearchInput
          value={q}
          onChange={(v) => {
            setPage(1);
            setQ(v);
          }}
          placeholder="Search by name, roll or register no"
        />

        {loading && rows.length === 0 && <LoadingSkeleton rows={8} />}
        {error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && rows.length === 0 && (
          <EmptyState
            title="No students found"
            description={
              canWrite
                ? "Adjust your search or add a new student."
                : "Adjust your search."
            }
          />
        )}

        {rows.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {rows.map((s) => (
                <StudentCard
                  key={s.id}
                  student={s}
                  canWrite={canWrite}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pinned footer — always at bottom of viewport */}
      {rows.length > 0 && !loading && (
        <div className="shrink-0 border-t border-gray-200 bg-white/95 backdrop-blur
                        px-4 lg:px-6 py-0 flex items-center justify-between
                        text-sm text-gray-600">
          <span>
            Total: <b className="text-gray-900">{total}</b>
            <span className="mx-1 text-gray-300">·</span>
            Page <b className="text-gray-900">{page}</b> of{" "}
            <b className="text-gray-900">{totalPages}</b>
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-gray-300 px-3 py-0.5 text-sm
                         hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-gray-300 px-3 py-1 text-sm
                         hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <StudentFormModal
        open={showForm}
        editing={editing}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        onSaved={() => {
          push("success", editing ? "Student updated." : "Student created.");
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
        open={!!deleteTarget}
        title="Delete student permanently?"
        description={
          deleteTarget
            ? `This will remove ${deleteTarget.name} (${deleteTarget.roll_no}) AND all their attendance records. Sessions that become empty are removed too. This cannot be undone.`
            : ""
        }
        confirmLabel={deleting ? "Deleting…" : "Delete forever"}
        cancelLabel="Cancel"
        tone="danger"
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          try {
            const res = await Api.hardDeleteStudent(deleteTarget.id);
            push(
              "success",
              `${deleteTarget.name} deleted. ${res.attendance_records_removed} attendance record(s) removed.`,
            );
            setDeleteTarget(null);
            load();
          } catch (e) {
            push(
              "error",
              e instanceof ApiError ? e.message : "Could not delete student.",
            );
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}