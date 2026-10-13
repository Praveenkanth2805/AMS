"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Api, ApiError } from "@/lib/api";
import type { AcademicYear, ClassFull, DepartmentFull } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { type Column } from "@/components/ui/DataTable";
import FormField from "@/components/ui/FormField";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ClassFormModal from "@/components/departments/ClassFormModal";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";

// ---------- Department modal (create / edit) ----------

const deptSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  code: z.string().trim().min(1, "Code is required.").max(32),
});
type DeptForm = z.infer<typeof deptSchema>;

function DepartmentFormModal({
  open, onClose, onSaved, editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: DepartmentFull | null;
}) {
  const form = useForm<DeptForm>({
    resolver: zodResolver(deptSchema),
    defaultValues: { name: "", code: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: editing?.name ?? "",
      code: editing?.code ?? "",
    });
  }, [open, editing, form]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) await Api.updateDepartment(editing.id, values);
      else await Api.createDepartment(values);
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.message.toLowerCase().includes("code"))
          form.setError("code", { message: "Code already exists." });
        else form.setError("root", { message: e.message });
      } else form.setError("root", { message: "Failed to save." });
    }
  });

  if (!open) return null;
  const { errors, isSubmitting } = form.formState;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="dept-modal-title"
         className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 id="dept-modal-title" className="text-lg font-semibold text-green-800">
            {editing ? "Edit Department" : "New Department"}
          </h2>
        </div>
        <form onSubmit={onSubmit} noValidate className="p-5 space-y-4">
          {errors.root && (
            <div role="alert"
                 className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errors.root.message}
            </div>
          )}
          <FormField label="Name" htmlFor="dept_name" required
                     error={errors.name?.message}>
            <input id="dept_name" autoFocus {...form.register("name")}
                   className="w-full rounded-md border border-gray-300 px-3 py-2" />
          </FormField>
          <FormField label="Code" htmlFor="dept_code" required
                     hint="Short code, e.g. CS, ECE, MECH"
                     error={errors.code?.message}>
            <input id="dept_code" {...form.register("code")}
                   className="w-full rounded-md border border-gray-300 px-3 py-2 uppercase" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
                    className="rounded-md bg-green-700 text-white px-4 py-2 text-sm
                               hover:bg-green-800 disabled:opacity-60">
              {isSubmitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Main page ----------

export default function DepartmentsPage() {
  const { push } = useToast();

  const [departments, setDepartments] = useState<DepartmentFull[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassFull[]>([]);

  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedYearId, setSelectedYearId] = useState<string>("");

  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDeptForm, setShowDeptForm] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentFull | null>(null);
  const [confirmDeptId, setConfirmDeptId] = useState<string | null>(null);

  const [showClassForm, setShowClassForm] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassFull | null>(null);
  const [confirmClassId, setConfirmClassId] = useState<string | null>(null);

  // Load departments + years once
  const loadDepartments = useCallback(async () => {
    setLoadingDepts(true);
    try {
      const [d, y] = await Promise.all([
        Api.departmentsAll(false),
        Api.academicYears(),
      ]);
      setDepartments(d);
      setYears(y);
      if (!selectedDeptId && d.length > 0) {
        setSelectedDeptId(d[0]?.id ?? null);
      }
      if (!selectedYearId && y.length > 0) {
        setSelectedYearId(y[0]?.id ?? "");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load data.");
    } finally {
      setLoadingDepts(false);
    }
  }, [selectedDeptId, selectedYearId]);

  useEffect(() => { loadDepartments(); /* eslint-disable-next-line */ }, []);

  // Load classes when selected dept / year changes
  const loadClasses = useCallback(async () => {
    if (!selectedDeptId) { setClasses([]); return; }
    setLoadingClasses(true);
    try {
      const rows = await Api.classesFull({
        department_id: selectedDeptId,
        academic_year_id: selectedYearId || undefined,
      });
      setClasses(rows);
    } catch (e) {
      push("error", e instanceof ApiError ? e.message : "Failed to load classes.");
    } finally {
      setLoadingClasses(false);
    }
  }, [selectedDeptId, selectedYearId, push]);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  const selectedDept = useMemo(
    () => departments.find((d) => d.id === selectedDeptId) ?? null,
    [departments, selectedDeptId],
  );

  const classColumns: Column<ClassFull>[] = [
    { key: "name", header: "Class", cell: (r) => r.name },
    { key: "section", header: "Section", cell: (r) => r.section ?? "—" },
    { key: "status", header: "Status",
      cell: (r) => <StatusBadge value={r.is_active ? "active" : "inactive"} /> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-3">
        <button onClick={() => { setEditingClass(r); setShowClassForm(true); }}
                className="inline-flex items-center gap-1 text-sm text-green-700 underline">
          <Pencil size={14} /> Edit
        </button>
        {r.is_active && (
          <button onClick={() => setConfirmClassId(r.id)}
                  className="text-sm text-red-700 underline">
            Deactivate
          </button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Manage departments and their classes."
        actions={
          <button
            onClick={() => { setEditingDept(null); setShowDeptForm(true); }}
            className="inline-flex items-center gap-2 rounded-md bg-green-700 px-3 py-2
                       text-sm text-white hover:bg-green-800">
            <Plus size={16} /> Add Department
          </button>
        }
      />

      {error && <ErrorState message={error} onRetry={loadDepartments} />}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* LEFT — Departments list */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-green-50">
            <div className="text-sm font-medium text-green-800">Departments</div>
          </div>

          {loadingDepts && <div className="p-4"><LoadingSkeleton rows={4} /></div>}

          {!loadingDepts && departments.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-500">
              No departments yet.
            </div>
          )}

          <ul className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
            {departments.map((d) => {
              const active = d.id === selectedDeptId;
              return (
                <li key={d.id}>
                  <button
                    onClick={() => setSelectedDeptId(d.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 transition-colors",
                      active ? "bg-green-50" : "hover:bg-gray-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className={cn("text-sm truncate",
                          active ? "font-semibold text-green-800" : "text-gray-900")}>
                          {d.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {d.code}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">›</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {selectedDept && (
            <div className="border-t border-gray-100 p-3 flex gap-2">
              <button
                onClick={() => { setEditingDept(selectedDept); setShowDeptForm(true); }}
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs
                           hover:bg-gray-50">
                Edit dept
              </button>
              <button
                onClick={() => setConfirmDeptId(selectedDept.id)}
                className="flex-1 rounded-md border border-red-200 px-3 py-1.5 text-xs
                           text-red-700 hover:bg-red-50">
                Deactivate
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — Classes panel */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {!selectedDept ? (
            <EmptyState title="Select a department"
                        description="Choose a department from the left to manage its classes." />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {selectedDept.name}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Code: {selectedDept.code}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Academic Year</label>
                  <select
                    value={selectedYearId}
                    onChange={(e) => setSelectedYearId(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => { setEditingClass(null); setShowClassForm(true); }}
                    className="inline-flex items-center gap-1 rounded-md bg-green-700 px-3 py-1.5
                               text-sm text-white hover:bg-green-800">
                    <Plus size={14} /> Add Class
                  </button>
                </div>
              </div>

              {loadingClasses && <LoadingSkeleton rows={3} />}

              {!loadingClasses && classes.length === 0 && (
                <EmptyState title="No classes in this department"
                            description="Add the first class for the selected academic year." />
              )}

              {!loadingClasses && classes.length > 0 && (
                <DataTable columns={classColumns} rows={classes}
                           getRowKey={(r) => r.id} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Department modal */}
      <DepartmentFormModal
        open={showDeptForm}
        editing={editingDept}
        onClose={() => { setShowDeptForm(false); setEditingDept(null); }}
        onSaved={() => {
          push("success", editingDept ? "Department updated." : "Department created.");
          loadDepartments();
        }}
      />

      {/* Class modal */}
      {selectedDeptId && (
        <ClassFormModal
          open={showClassForm}
          onClose={() => { setShowClassForm(false); setEditingClass(null); }}
          onSaved={() => {
            push("success", editingClass ? "Class updated." : "Class created.");
            loadClasses();
          }}
          departmentId={selectedDeptId}
          years={years}
          editing={editingClass}
          defaultAcademicYearId={selectedYearId}
        />
      )}

      {/* Confirm department deactivate */}
      <ConfirmDialog
        open={!!confirmDeptId}
        title="Deactivate department?"
        description="Students and classes remain but won't appear in new forms."
        confirmLabel="Deactivate" tone="danger"
        onCancel={() => setConfirmDeptId(null)}
        onConfirm={async () => {
          if (!confirmDeptId) return;
          try {
            await Api.deactivateDepartment(confirmDeptId);
            push("success", "Department deactivated.");
            if (confirmDeptId === selectedDeptId) setSelectedDeptId(null);
            setConfirmDeptId(null);
            loadDepartments();
          } catch {
            push("error", "Could not deactivate department.");
          }
        }}
      />

      {/* Confirm class deactivate */}
      <ConfirmDialog
        open={!!confirmClassId}
        title="Deactivate class?"
        description="Existing students under it remain active."
        confirmLabel="Deactivate" tone="danger"
        onCancel={() => setConfirmClassId(null)}
        onConfirm={async () => {
          if (!confirmClassId) return;
          try {
            await Api.deactivateClass(confirmClassId);
            push("success", "Class deactivated.");
            setConfirmClassId(null);
            loadClasses();
          } catch {
            push("error", "Could not deactivate class.");
          }
        }}
      />
    </div>
  );
}