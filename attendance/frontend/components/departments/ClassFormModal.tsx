"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Api, ApiError } from "@/lib/api";
import type { AcademicYear, ClassFull } from "@/lib/types";
import FormField from "@/components/ui/FormField";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  section: z.string().trim().optional().or(z.literal("")),
  academic_year_id: z.string().min(1, "Required"),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  departmentId: string;
  years: AcademicYear[];
  editing?: ClassFull | null;
  defaultAcademicYearId?: string;
}

export default function ClassFormModal({
  open, onClose, onSaved, departmentId, years,
  editing = null, defaultAcademicYearId,
}: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", section: "", academic_year_id: "" },
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name,
        section: editing.section ?? "",
        academic_year_id: editing.academic_year_id,
      });
    } else {
      form.reset({
        name: "",
        section: "",
        academic_year_id: defaultAcademicYearId ?? years[0]?.id ?? "",
      });
    }
  }, [open, editing, defaultAcademicYearId, years, form]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        await Api.updateClass(editing.id, {
          name: values.name,
          section: values.section || null,
        });
      } else {
        await Api.createClass({
          name: values.name,
          section: values.section || null,
          department_id: departmentId,
          academic_year_id: values.academic_year_id,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to save class.";
      if (msg.toLowerCase().includes("already"))
        form.setError("name", { message: "A class with this name/section already exists." });
      else form.setError("root", { message: msg });
    }
  });

  if (!open) return null;
  const { errors, isSubmitting } = form.formState;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="class-modal-title"
         className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 id="class-modal-title" className="text-lg font-semibold text-green-800">
            {editing ? "Edit Class" : "Add Class"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close"
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate className="p-5 space-y-4">
          {errors.root && (
            <div role="alert"
                 className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errors.root.message}
            </div>
          )}

          <FormField label="Class Name" htmlFor="class_name" required
                     hint="e.g. III Year, B.Sc CS"
                     error={errors.name?.message}>
            <input id="class_name" autoFocus {...form.register("name")}
                   className="w-full rounded-md border border-gray-300 px-3 py-2" />
          </FormField>

          <FormField label="Section" htmlFor="class_section"
                     hint="Optional — e.g. A, B">
            <input id="class_section" {...form.register("section")}
                   className="w-full rounded-md border border-gray-300 px-3 py-2" />
          </FormField>

          {!editing && (
            <FormField label="Academic Year" htmlFor="class_ay" required
                       error={errors.academic_year_id?.message}>
              <select id="class_ay" {...form.register("academic_year_id")}
                      className="w-full rounded-md border border-gray-300 px-3 py-2">
                {years.length === 0 && <option value="">Loading…</option>}
                {years.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </FormField>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
                    className="rounded-md bg-green-700 text-white px-4 py-2 text-sm
                               hover:bg-green-800 disabled:opacity-60">
              {isSubmitting ? "Saving…" : (editing ? "Update" : "Create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}