"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { downloadCSV } from "@/lib/csv";

import { Api, ApiError } from "@/lib/api";
import type { AcademicYear, BulkImportResult, ClassRef, Department } from "@/lib/types";
import FormField from "@/components/ui/FormField";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface Parsed {
  date: string;               // YYYY-MM-DD
  name?: string;
  roll_no?: string;
}

const DATE_ALIASES = ["date", "attendance date", "att date", "day", "attendancedate"];
const NAME_ALIASES = ["name", "student name", "student_name", "full name"];
const ROLL_ALIASES = ["roll", "roll_no", "roll no", "rollno", "roll number"];

function normHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}
  function downloadTemplate() {
    downloadCSV(
      "attendance_import_template.csv",
      ["date", "name", "roll_no"],
      [
        ["01/10/2026", "Aarthi S", ""],
        ["01/10/2026", "Bharath K", ""],
        ["02/10/2026", "Aarthi S", ""],
        ["02/10/2026", "Bharath K", ""],
      ],
    );
  }
function toISODate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // Try dd/mm/yyyy or dd-mm-yyyy
  const m1 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m1) {
    const [, dd, mm, yyyy] = m1;
    return `${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
  }
  // Try yyyy-mm-dd
  const m2 = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m2) {
    const [, yyyy, mm, dd] = m2;
    return `${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  return null;
}

export default function AttendanceImportModal({ open, onClose, onImported }: Props) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);

  const [yearId, setYearId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [classId, setClassId] = useState("");

  const [rows, setRows] = useState<Parsed[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows([]); setFileName(null); setParseError(null);
    setServerError(null); setResult(null);
    (async () => {
      try {
        const [y, d] = await Promise.all([Api.academicYears(), Api.departments()]);
        setYears(y); setDepartments(d);
        setYearId(y[0]?.id ?? "");
        const cs = d.find((x) => x.code.toUpperCase() === "CS");
        setDeptId(cs?.id ?? d[0]?.id ?? "");
      } catch { setServerError("Failed to load reference data."); }
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !yearId || !deptId) return;
    setClassId(""); setClasses([]);
    Api.classes(yearId, deptId).then((c) => {
      setClasses(c); setClassId(c[0]?.id ?? "");
    });
  }, [open, yearId, deptId]);

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

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null); setResult(null); setRows([]);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]!]!;
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet,
        { defval: "" });

      if (json.length === 0) {
        setParseError("Sheet is empty.");
        return;
      }

      // Detect columns
      const headers = Object.keys(json[0]!);
      const lower = headers.map(normHeader);
      const find = (aliases: string[]) => {
        for (let i = 0; i < lower.length; i++) {
          if (aliases.includes(lower[i]!)) return headers[i]!;
        }
        return null;
      };
      const dateCol = find(DATE_ALIASES);
      const nameCol = find(NAME_ALIASES);
      const rollCol = find(ROLL_ALIASES);

      if (!dateCol) {
        setParseError(`No date column found. Headers: ${headers.join(", ")}`);
        return;
      }
      if (!nameCol && !rollCol) {
        setParseError("Need a name or roll_no column.");
        return;
      }

      const parsed: Parsed[] = [];
      for (const r of json) {
        const d = toISODate(r[dateCol]);
        if (!d) continue;
        parsed.push({
          date: d,
          name: nameCol ? String(r[nameCol] ?? "").trim() || undefined : undefined,
          roll_no: rollCol ? String(r[rollCol] ?? "").trim() || undefined : undefined,
        });
      }

      if (parsed.length === 0) {
        setParseError("No valid rows (missing/invalid dates).");
        return;
      }
      setRows(parsed);
    } catch {
      setParseError("Could not read the file. Is it a valid Excel/CSV?");
    }
  }

  async function submit() {
    if (!classId || !yearId || rows.length === 0) return;
    setSubmitting(true); setServerError(null); setResult(null);
    try {
      const res = await Api.bulkImportAttendance({
        academic_year_id: yearId,
        class_id: classId,
        rows: rows.map((r) => ({
          date: r.date,
          name: r.name ?? null,
          roll_no: r.roll_no ?? null,
        })),
      });
      setResult(res);
      onImported();
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : "Import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const uniqueDates = useMemo(
    () => Array.from(new Set(rows.map((r) => r.date))).sort(),
    [rows],
  );

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="imp-modal-title"
         className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sticky top-0 bg-white z-10">
          <h2 id="imp-modal-title" className="text-lg font-semibold text-green-800">
            Import Attendance (Excel / CSV)
          </h2>
          <button type="button" onClick={onClose} aria-label="Close"
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            For each unique <b>date</b> in the file, a session will be created with
            <b> all students marked present</b>. Existing sessions for a date are skipped.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Academic Year" htmlFor="imp_ay" required>
              <select id="imp_ay" value={yearId} onChange={(e) => setYearId(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2">
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </FormField>
            <FormField label="Department" htmlFor="imp_dept" required>
              <select id="imp_dept" value={deptId} onChange={(e) => setDeptId(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2">
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </FormField>
            <FormField label="Class" htmlFor="imp_class" required>
              <select id="imp_class" value={classId} onChange={(e) => setClassId(e.target.value)}
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-800">
                Excel / CSV file
              </label>
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1 text-xs text-green-700 hover:underline"
              >
                <Download size={14} /> Download template
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-md border border-gray-300
                                px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                <Upload size={16} /> Choose file
                <input type="file" accept=".xlsx,.xls,.csv,text/csv" className="hidden"
                       onChange={handleFile} />
              </label>
              {fileName && (
                <span className="text-xs text-gray-600 inline-flex items-center gap-1">
                  <FileSpreadsheet size={14} /> {fileName}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Required: <b>date</b> column. Optional: <b>name</b> or <b>roll_no</b>.
              Dates can be <code>YYYY-MM-DD</code> or <code>DD/MM/YYYY</code>.
              One row per student per date.
            </p>
          </div>

          {parseError && (
            <div role="alert"
                 className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700
                            flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5" /> {parseError}
            </div>
          )}

          {rows.length > 0 && !result && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800
                            flex items-center gap-2">
              <CheckCircle2 size={16} />
              Parsed <b>{rows.length}</b> rows · <b>{uniqueDates.length}</b> unique date(s)
            </div>
          )}

          {uniqueDates.length > 0 && !result && (
            <div className="rounded-md border border-gray-200 max-h-40 overflow-y-auto p-3">
              <div className="text-xs font-medium text-gray-700 mb-2">Dates to import:</div>
              <div className="flex flex-wrap gap-1">
                {uniqueDates.map((d) => (
                  <span key={d}
                        className="inline-block rounded bg-green-50 border border-green-200
                                   px-2 py-0.5 text-xs text-green-800 font-mono">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {serverError && (
            <div role="alert"
                 className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </div>
          )}

          {result && (
            <div className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900 space-y-2">
              <div className="font-medium">Import complete</div>
              <div>
                ✅ <b>{result.sessions_created}</b> session(s) created ·{" "}
                <b>{result.students_per_session}</b> students each
              </div>
              {result.dates_skipped.length > 0 && (
                <div className="text-yellow-800">
                  ⏭ Skipped (already existed): {result.dates_skipped.join(", ")}
                </div>
              )}
              {result.unknown_names.length > 0 && (
                <div className="text-yellow-800">
                  ⚠ Names not found in class: {result.unknown_names.slice(0, 10).join(", ")}
                  {result.unknown_names.length > 10 && ` +${result.unknown_names.length - 10} more`}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button type="button" onClick={submit}
                    disabled={submitting || rows.length === 0 || !classId}
                    className="rounded-md bg-green-700 text-white px-4 py-2 text-sm
                               hover:bg-green-800 disabled:opacity-60 inline-flex items-center gap-2">
              <FileSpreadsheet size={16} />
              {submitting ? "Importing…" : `Import ${uniqueDates.length} date(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}