"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileText, Upload, X } from "lucide-react";
import { downloadCSV } from "@/lib/csv";

import { Api, ApiError } from "@/lib/api";
import type { AcademicYear, ClassRef, Department } from "@/lib/types";
import FormField from "@/components/ui/FormField";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (created: number) => void;
}

// ---------- CSV parser (handles quoted cells) ----------

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === "," || ch === "\t") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (ch !== "\r") {
        cell += ch;
      }
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ---------- Column detection ----------

const ALIASES: Record<string, string[]> = {
  roll_no: ["roll_no", "rollno", "roll no", "roll", "roll_number", "roll#"],
  name: ["name", "full_name", "full name", "student_name", "student name", "student"],
  register_no: ["register_no", "regno", "reg_no", "reg no", "register no",
                "registration_no", "registration no", "register_number"],
  emis: ["emis", "emis_id", "emis id"],
  umis: ["umis", "umis_id", "umis id"],
  mobile: ["mobile", "mobile_number", "mobile number", "phone", "contact",
           "contact_no", "phone_number"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function detectColumns(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const normalized = headers.map(normalizeHeader);
  for (const [field, aliases] of Object.entries(ALIASES)) {
    for (let i = 0; i < normalized.length; i++) {
      const h = normalized[i]!;
      if (aliases.includes(h) || aliases.includes(h.replace(/\s/g, "_"))) {
        map[field] = i;
        break;
      }
    }
  }
  return map;
}

interface ParsedRow {
  roll_no?: string;
  name: string;
  register_no?: string;
  emis?: string;
  umis?: string;
  mobile?: string;
}
  function downloadTemplate() {
    downloadCSV(
      "student_import_template.csv",
      ["roll_no", "name", "register_no", "emis", "umis", "mobile"],
      [
        ["", "Aarthi S", "2023001", "EMIS123", "UMIS001", "9876543210"],
        ["", "Bharath K", "2023002", "EMIS124", "UMIS002", "9876543211"],
      ],
    );
  }
// ---------- Component ----------

export default function StudentImportModal({ open, onClose, onImported }: Props) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);

  const [yearId, setYearId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [classId, setClassId] = useState("");

  const [rawText, setRawText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [failedRows, setFailedRows] = useState<
    { index: number; name: string; roll_no: string; reason: string }[]
  >([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset when opening
  useEffect(() => {
    if (!open) return;
    setRawText("");
    setRows([]);
    setParseError(null);
    setServerError(null);
    setFailedRows([]);
    (async () => {
      try {
        const [y, d] = await Promise.all([Api.academicYears(), Api.departments()]);
        setYears(y);
        setDepartments(d);
        setYearId(y[0]?.id ?? "");
        const cs = d.find((x) => x.code.toUpperCase() === "CS");
        setDeptId(cs?.id ?? d[0]?.id ?? "");
      } catch {
        setServerError("Failed to load reference data.");
      }
    })();
  }, [open]);

  // Load classes when year/dept changes
  useEffect(() => {
    if (!open || !yearId || !deptId) return;
    setClassId("");
    setClasses([]);
    Api.classes(yearId, deptId)
      .then((c) => {
        setClasses(c);
        setClassId(c[0]?.id ?? "");
      })
      .catch(() => setServerError("Failed to load classes."));
  }, [open, yearId, deptId]);

  // Parse when text changes
  useEffect(() => {
    setParseError(null);
    setRows([]);
    setFailedRows([]);
    if (!rawText.trim()) return;

    try {
      const table = parseCSV(rawText);
      if (table.length < 2) {
        setParseError("Need a header row and at least one data row.");
        return;
      }
      const headers = table[0]!;
      const colMap = detectColumns(headers);

      if (colMap.name === undefined) {
        setParseError("Could not detect a 'name' column. Check headers.");
        return;
      }
      const parsed: ParsedRow[] = [];
      for (let i = 1; i < table.length; i++) {
        const cells = table[i]!;
        const get = (field: string) => {
          const idx = colMap[field];
          if (idx === undefined) return undefined;
          const v = (cells[idx] ?? "").trim();
          return v || undefined;
        };
        const name = get("name");
        if (!name) continue;
        parsed.push({
          name,
          roll_no: get("roll_no"),
          register_no: get("register_no"),
          emis: get("emis"),
          umis: get("umis"),
          mobile: get("mobile"),
        });
      }
      if (parsed.length === 0) {
        setParseError("No valid rows found.");
        return;
      }
      setRows(parsed);
    } catch {
      setParseError("Failed to parse data.");
    }
  }, [rawText]);

  // Escape to close
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
    const text = await file.text();
    setRawText(text);
  }

  async function submit() {
    if (!classId || !yearId || !deptId || rows.length === 0) return;
    setSubmitting(true);
    setServerError(null);
    setFailedRows([]);
    try {
      const res = await Api.importStudents({
        academic_year_id: yearId,
        department_id: deptId,
        class_id: classId,
        rows: rows.map((r) => ({
          roll_no: r.roll_no ?? null,
          name: r.name,
          register_no: r.register_no ?? null,
          emis: r.emis ?? null,
          umis: r.umis ?? null,
          mobile: r.mobile ?? null,
        })),
      });
      setFailedRows(res.failed);
      if (res.created > 0) onImported(res.created);
      if (res.failed.length === 0) {
        onClose();
      }
    } catch (e) {
      if (e instanceof ApiError) setServerError(e.message);
      else setServerError("Import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const preview = useMemo(() => rows.slice(0, 8), [rows]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sticky top-0 bg-white z-10">
          <h2 id="import-modal-title" className="text-lg font-semibold text-green-800">
            Import Students
          </h2>
          <button type="button" onClick={onClose} aria-label="Close"
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Scope selectors */}
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

          {/* File upload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-800">
                CSV file (or paste below)
              </label>
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1 text-xs text-green-700 hover:underline"
              >
                <Download size={14} /> Download template
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-md border border-gray-300
                                px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                <Upload size={16} /> Choose file
                <input type="file" accept=".csv,.txt,text/csv" className="hidden"
                       onChange={handleFile} />
              </label>
              <span className="text-xs text-gray-500">
                Headers: roll_no, name, register_no, emis, umis, mobile
              </span>
            </div>
          </div>

          {/* Paste area */}
          <div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={6}
              placeholder={`regno,name,emis,mobile,umis
2023001,Aarthi S,EMIS123,9876543210,UMIS001
2023002,Bharath K,EMIS124,9876543211,UMIS002`}
              className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
            />
          </div>

          {/* Parse feedback */}
          {parseError && (
            <div role="alert"
                 className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700
                            flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5" />
              {parseError}
            </div>
          )}

          {rows.length > 0 && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800
                            flex items-center gap-2">
              <CheckCircle2 size={16} />
              Parsed <b>{rows.length}</b> rows. Showing first {preview.length}.
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2">Roll</th>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">Reg No</th>
                    <th className="text-left px-3 py-2">EMIS</th>
                    <th className="text-left px-3 py-2">UMIS</th>
                    <th className="text-left px-3 py-2">Mobile</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-1.5">{r.roll_no ?? <i>auto</i>}</td>
                      <td className="px-3 py-1.5">{r.name}</td>
                      <td className="px-3 py-1.5">{r.register_no ?? "—"}</td>
                      <td className="px-3 py-1.5">{r.emis ?? "—"}</td>
                      <td className="px-3 py-1.5">{r.umis ?? "—"}</td>
                      <td className="px-3 py-1.5">{r.mobile ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Server errors */}
          {serverError && (
            <div role="alert"
                 className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </div>
          )}

          {/* Failed rows after import */}
          {failedRows.length > 0 && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
              <div className="font-medium mb-2">Some rows could not be imported:</div>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {failedRows.map((f) => (
                  <li key={f.index} className="text-xs">
                    Row {f.index + 2}: <b>{f.name}</b> ({f.roll_no}) — {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || rows.length === 0 || !classId}
            className="rounded-md bg-green-700 text-white px-4 py-2 text-sm
                       hover:bg-green-800 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <FileText size={16} />
            {submitting ? "Importing…" : `Import ${rows.length} students`}
          </button>
        </div>
      </div>
    </div>
  );
}