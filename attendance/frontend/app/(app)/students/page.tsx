"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Api, ApiError } from "@/lib/api";
import type { AcademicYear, ClassRef, Department, Student } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { type Column } from "@/components/ui/DataTable";
import SearchInput from "@/components/ui/SearchInput";
import FormField from "@/components/ui/FormField";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";

const schema = z.object({
  roll_no: z.string().trim().min(1, "Roll number is required."),
  name: z.string().trim().min(1, "Name is required."),
  register_no: z.string().trim().optional().or(z.literal("")),
  emis: z.string().trim().optional().or(z.literal("")),
  umis: z.string().trim().optional().or(z.literal("")),
  academic_year_id: z.string().min(1, "Required"),
  department_id: z.string().min(1, "Required"),
  class_id: z.string().min(1, "Required"),
});
type FormValues = z.infer<typeof schema>;

export default function StudentsPage() {
  const { push } = useToast();

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);
  const [rows, setRows] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { academic_year_id: "", department_id: "", class_id: "" },
  });

  // Load reference data
  useEffect(() => {
    (async () => {
      const [y, d] = await Promise.all([Api.academicYears(), Api.departments()]);
      setYears(y); setDepartments(d);
      form.setValue("academic_year_id", y[0]?.id ?? "");
      form.setValue("department_id", d[0]?.id ?? "");
    })().catch(() => setError("Failed to load reference data."));
  }, [form]);

  const watchAY = form.watch("academic_year_id");
  const watchDept = form.watch("department_id");

  useEffect(() => {
    if (!watchAY || !watchDept) return;
    // Reset incompatible class selection
    form.setValue("class_id", "");
    Api.classes(watchAY, watchDept).then((c) => {
      setClasses(c);
      form.setValue("class_id", c[0]?.id ?? "");
    });
  }, [watchAY, watchDept, form]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await Api.students({ q, page, page_size: 25 });
      setRows(res.items); setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load students.");
    } finally { setLoading(false); }
  }, [q, page]);

  useEffect(() => { load(); }, [load]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await Api.createStudent({
        ...values,
        register_no: values.register_no || null,
        emis: values.emis || null,
        umis: values.umis || null,
      });
      push("success", "Student created.");
      setShowForm(false);
      form.reset({ ...form.getValues(), roll_no: "", name: "", register_no: "", emis: "", umis: "" });
      load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "DUPLICATE_STUDENT")
        form.setError("roll_no", { message: "Roll number already exists in this class." });
      else push("error", e instanceof ApiError ? e.message : "Failed to create student.");
    }
  });

  const columns: Column<Student>[] = [
    { key: "roll", header: "Roll No", cell: (r) => r.roll_no },
    { key: "name", header: "Name", cell: (r) => r.name },
    { key: "reg", header: "Register No", cell: (r) => r.register_no ?? "—" },
    { key: "emis", header: "EMIS", cell: (r) => r.emis ?? "—" },
    { key: "status", header: "Status",
      cell: (r) => <StatusBadge value={r.is_active ? "active" : "inactive"} /> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      r.is_active ? (
        <button onClick={() => setConfirmId(r.id)} className="text-sm text-red-700 underline">
          Deactivate
        </button>
      ) : null
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="Students"
        description="Create, view and manage students."
        actions={
          <button onClick={() => setShowForm((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-md bg-green-700 px-3 py-2 text-sm
                             text-white hover:bg-green-800">
            <Plus size={16} /> Add Student
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <SearchInput value={q} onChange={(v) => { setPage(1); setQ(v); }}
                       placeholder="Search by name, roll or register no" />

          {loading && rows.length === 0 && <LoadingSkeleton rows={5} />}
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

        {showForm && (
          <form onSubmit={onSubmit} noValidate
                className="rounded-lg border border-gray-200 p-4 space-y-3 h-fit">
            <h2 className="font-semibold text-green-800">New Student</h2>

            <FormField label="Roll No" htmlFor="roll_no" required
                       error={form.formState.errors.roll_no?.message}>
              <input id="roll_no" {...form.register("roll_no")}
                     className="w-full rounded-md border border-gray-300 px-3 py-2" />
            </FormField>

            <FormField label="Name" htmlFor="name" required
                       error={form.formState.errors.name?.message}>
              <input id="name" {...form.register("name")}
                     className="w-full rounded-md border border-gray-300 px-3 py-2" />
            </FormField>

            <FormField label="Register No" htmlFor="register_no">
              <input id="register_no" {...form.register("register_no")}
                     className="w-full rounded-md border border-gray-300 px-3 py-2" />
            </FormField>

            <FormField label="EMIS" htmlFor="emis">
              <input id="emis" {...form.register("emis")}
                     className="w-full rounded-md border border-gray-300 px-3 py-2" />
            </FormField>

            <FormField label="UMIS" htmlFor="umis">
              <input id="umis" {...form.register("umis")}
                     className="w-full rounded-md border border-gray-300 px-3 py-2" />
            </FormField>

            <FormField label="Academic Year" htmlFor="academic_year_id" required>
              <select id="academic_year_id" {...form.register("academic_year_id")}
                      className="w-full rounded-md border border-gray-300 px-3 py-2">
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </FormField>

            <FormField label="Department" htmlFor="department_id" required>
              <select id="department_id" {...form.register("department_id")}
                      className="w-full rounded-md border border-gray-300 px-3 py-2">
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </FormField>

            <FormField label="Class" htmlFor="class_id" required
                       error={form.formState.errors.class_id?.message}>
              <select id="class_id" {...form.register("class_id")}
                      className="w-full rounded-md border border-gray-300 px-3 py-2">
                {classes.length === 0 && <option value="">No classes</option>}
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={form.formState.isSubmitting}
                      className="rounded-md bg-green-700 text-white px-3 py-2 text-sm
                                 disabled:opacity-60">
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmId}
        title="Deactivate student?"
        description="This preserves attendance history and hides the student from active rosters."
        confirmLabel="Deactivate" tone="danger"
        onCancel={() => setConfirmId(null)}
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
    </div>
  );
}