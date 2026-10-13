"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Api, ApiError } from "@/lib/api";
import type { AcademicYear, ClassRef, Department } from "@/lib/types";
import FormField from "@/components/ui/FormField";

const schema = z.object({
  roll_no: z.string().trim().min(1, "Roll number is required."),
  name: z.string().trim().min(1, "Name is required."),
  register_no: z.string().trim().optional().or(z.literal("")),
  emis: z.string().trim().optional().or(z.literal("")),
  umis: z.string().trim().optional().or(z.literal("")),
  mobile: z.string().trim().optional().or(z.literal("")),
  academic_year_id: z.string().min(1, "Required"),
  department_id: z.string().min(1, "Required"),
  class_id: z.string().min(1, "Required"),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function StudentFormModal({ open, onClose, onSaved }: Props) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      roll_no: "", name: "", register_no: "", emis: "", umis: "", mobile: "",
      academic_year_id: "", department_id: "", class_id: "",
    },
  });

  // Load reference data when modal opens
  useEffect(() => {
    if (!open) return;
    setServerError(null);
    form.reset();
    (async () => {
      try {
        const [y, d] = await Promise.all([Api.academicYears(), Api.departments()]);
        setYears(y);
        setDepartments(d);
        form.setValue("academic_year_id", y[0]?.id ?? "");
        // Default to CS if present, else first
        const cs = d.find((x) => x.code.toUpperCase() === "CS");
        form.setValue("department_id", cs?.id ?? d[0]?.id ?? "");
      } catch {
        setServerError("Failed to load reference data.");
      }
    })();
  }, [open, form]);

  const watchAY = form.watch("academic_year_id");
  const watchDept = form.watch("department_id");

  // Reload classes when year or department changes
  useEffect(() => {
    if (!open || !watchAY || !watchDept) return;
    form.setValue("class_id", "");
    setClasses([]);
    Api.classes(watchAY, watchDept)
      .then((c) => {
        setClasses(c);
        form.setValue("class_id", c[0]?.id ?? "");
      })
      .catch(() => setServerError("Failed to load classes."));
  }, [open, watchAY, watchDept, form]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await Api.createStudent({
        ...values,
        register_no: values.register_no || null,
        emis: values.emis || null,
        umis: values.umis || null,
         mobile: values.mobile || null,
      });
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === "DUPLICATE_STUDENT") {
        form.setError("roll_no", { message: "Roll number already exists in this class." });
      } else if (e instanceof ApiError) {
        setServerError(e.message);
      } else {
        setServerError("Failed to create student.");
      }
    }
  });

  if (!open) return null;

  const { errors, isSubmitting } = form.formState;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sticky top-0 bg-white z-10">
          <h2 id="student-modal-title" className="text-lg font-semibold text-green-800">
            Add Student
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} noValidate className="p-5 space-y-4">
          {serverError && (
            <div role="alert"
                 className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Roll No" htmlFor="roll_no" required error={errors.roll_no?.message}>
              <input id="roll_no" autoFocus {...form.register("roll_no")}
                     className="w-full rounded-md border border-gray-300 px-3 py-2" />
            </FormField>

            <FormField label="Name" htmlFor="name" required error={errors.name?.message}>
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
<FormField label="Mobile" htmlFor="mobile">
  <input id="mobile" type="tel" {...form.register("mobile")}
         className="w-full rounded-md border border-gray-300 px-3 py-2" />
</FormField>
            <FormField label="Academic Year" htmlFor="academic_year_id" required
                       error={errors.academic_year_id?.message}>
              <select id="academic_year_id" {...form.register("academic_year_id")}
                      className="w-full rounded-md border border-gray-300 px-3 py-2">
                {years.length === 0 && <option value="">Loading…</option>}
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </FormField>

            <FormField label="Department" htmlFor="department_id" required
                       error={errors.department_id?.message}>
              <select id="department_id" {...form.register("department_id")}
                      className="w-full rounded-md border border-gray-300 px-3 py-2">
                {departments.length === 0 && <option value="">Loading…</option>}
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </FormField>

            <FormField label="Class" htmlFor="class_id" required error={errors.class_id?.message}>
              <select id="class_id" {...form.register("class_id")}
                      className="w-full rounded-md border border-gray-300 px-3 py-2">
                {classes.length === 0 && <option value="">No classes</option>}
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.section ? `${c.name} · ${c.section}` : c.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
                    className="rounded-md bg-green-700 text-white px-4 py-2 text-sm
                               hover:bg-green-800 disabled:opacity-60">
              {isSubmitting ? "Saving…" : "Save Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}