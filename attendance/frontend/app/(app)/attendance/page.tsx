"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, CheckCircle2, Loader2, RotateCcw, Upload,
} from "lucide-react";

import { Api, ApiError } from "@/lib/api";
import type {
  AcademicYear, AttendanceStatus, ClassRef, Department, PublicConfig,
} from "@/lib/types";
import AttendanceImportModal from "@/components/attendance/AttendanceImportModal";
import { cn } from "@/lib/utils";

type Row = { id: string; name: string; roll_no: string; status: AttendanceStatus };

export default function AttendancePage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);

  const [yearId, setYearId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [classId, setClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dirty, setDirty] = useState(false);           // edit-mode changes pending
  const [error, setError] = useState<string | null>(null);
  const [allowEdit, setAllowEdit] = useState(false);

  const [showImport, setShowImport] = useState(false);

  // Load reference data + public config
  useEffect(() => {
    (async () => {
      const [y, d, cfg] = await Promise.all([
        Api.academicYears(),
        Api.departments(),
        Api.publicConfig(),
      ]);
      setYears(y);
      setDepartments(d);
      setAllowEdit(cfg.allow_attendance_edit);
      setYearId(y[0]?.id ?? "");
      setDeptId(d[0]?.id ?? "");
    })().catch(() => setError("Failed to load academic data."));
  }, []);

  // Classes reload
  useEffect(() => {
    if (!yearId || !deptId) return;
    setClasses([]); setClassId("");
    Api.classes(yearId, deptId)
      .then((c) => { setClasses(c); setClassId(c[0]?.id ?? ""); })
      .catch(() => setError("Failed to load classes."));
  }, [yearId, deptId]);

  // Load session for selected date
  useEffect(() => {
    if (!yearId || !classId) return;
    setLoading(true); setError(null); setSubmitted(false);
    setDirty(false); setSessionId(null);
    Api.attendanceToday(classId, yearId, selectedDate)
      .then((res) => {
        if (res.submitted && res.session) {
          setSubmitted(true);
          setSessionId(res.session.id);
          const byId = new Map(res.students.map((s) => [s.id, s]));
          setRows(res.session.records.map((r) => {
            const s = byId.get(r.student_id);
            return {
              id: r.student_id,
              name: s?.name ?? "",
              roll_no: s?.roll_no ?? "",
              status: r.status,
            };
          }));
        } else {
          setRows(res.students.map((s) => ({ ...s, status: "absent" as const })));
        }
      })
      .catch(() => setError("Failed to load attendance."))
      .finally(() => setLoading(false));
    }, [classId, yearId, selectedDate, showImport]);

  const present = useMemo(() => rows.filter((r) => r.status === "present").length, [rows]);
  const absent = rows.length - present;

  function setAllPresent() {
    setRows((prev) => prev.map((r) => ({ ...r, status: "present" })));
    if (submitted) setDirty(true);
  }
  function setAllAbsent() {
    setRows((prev) => prev.map((r) => ({ ...r, status: "absent" })));
    if (submitted) setDirty(true);
  }
  function toggle(id: string) {
    setRows((prev) => prev.map((r) =>
      r.id === id ? { ...r, status: r.status === "present" ? "absent" : "present" } : r));
    if (submitted) setDirty(true);
  }

  async function submit() {
    if (submitted && !allowEdit) return;
    if (submitted && !dirty) return;
    setSubmitting(true); setError(null);

    try {
      if (submitted && sessionId && allowEdit) {
        // Update existing session
        const res = await Api.updateAttendanceRecords(
          sessionId,
          rows.map((r) => ({ student_id: r.id, status: r.status })),
        );
        setRows(res.records.map((r) => {
          const existing = rows.find((x) => x.id === r.student_id);
          return {
            id: r.student_id,
            name: existing?.name ?? "",
            roll_no: existing?.roll_no ?? "",
            status: r.status,
          };
        }));
        setDirty(false);
      } else {
        const res = await Api.submitAttendance({
          academic_year_id: yearId,
          class_id: classId,
          attendance_date: selectedDate,
          records: rows.map((r) => ({ student_id: r.id, status: r.status })),
        });
        setSubmitted(true);
        setSessionId(res.id);
        setDirty(false);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "ATTENDANCE_ALREADY_SUBMITTED")
          setError("Attendance was already submitted. Reload the page.");
        else if (err.isRateLimited)
          setError("Too many requests. Please wait a moment.");
        else if (err.code === "NETWORK_ERROR")
          setError("Network unavailable. Your changes are preserved — retry.");
        else setError(err.message);
      } else setError("Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  // Effective edit permission for the UI
  const editable = !submitted || allowEdit;
  const submitLabel = submitted
    ? (dirty ? "Save Changes" : "Saved")
    : "Submit Attendance";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end gap-3">
         <label className="flex flex-col text-sm sm:w-[170px]">
          <span className="text-gray-600 mb-1">Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max="2999-12-31"
            className="w-full rounded-md border border-gray-300 px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          {selectedDate !== new Date().toISOString().slice(0, 10) && (
          <span className="self-end mb-2 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
            Viewing past/future date
          </span>
        )}
        </label>
        <Selector label="Academic Year" value={yearId} onChange={setYearId}
          options={years.map((y) => ({ value: y.id, label: y.name }))} />
        <Selector label="Department" value={deptId} onChange={setDeptId}
          options={departments.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))} />
        <Selector label="Class" value={classId} onChange={setClassId}
          options={classes.map((c) => ({
            value: c.id, label: c.section ? `${c.name} · ${c.section}` : c.name,
          }))} />
        <button
          onClick={() => setShowImport(true)}
          className="self-end inline-flex items-center gap-2 rounded-md border border-green-700
                     px-3 py-2 text-sm text-green-700 hover:bg-green-50"
        >
          <Upload size={16} /> Import Excel
        </button>
      </header>

      {loading ? (
        <LoadingBlock />
      ) : error && rows.length === 0 ? (
        <ErrorBlock message={error} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={setAllPresent}
              disabled={!editable || rows.length === 0}
              className="rounded-md bg-green-700 text-white px-4 py-2 font-medium disabled:opacity-50"
            >
              Present All
            </button>
            <button
              onClick={setAllAbsent}
              disabled={!editable || rows.length === 0}
              className="rounded-md border border-red-200 text-red-700 px-4 py-2 font-medium
                         hover:bg-red-50 disabled:opacity-50"
            >
              Absent All
            </button>
            <span className="text-sm text-gray-600">
              Present <b className="text-green-700">{present}</b> · Absent{" "}
              <b className="text-red-600">{absent}</b> · Total {rows.length}
            </span>
            {submitted && !allowEdit && (
              <span className="inline-flex items-center gap-1 text-sm text-green-700">
                <CheckCircle2 size={16} /> Submitted — read-only
              </span>
            )}
            {submitted && allowEdit && (
              <span className="inline-flex items-center gap-1 text-sm text-yellow-700">
                <CheckCircle2 size={16} /> Submitted — edit mode enabled
              </span>
            )}
          </div>

          {error && <ErrorBlock message={error} compact />}

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-green-50 text-green-900">
                <tr>
                  <th className="text-left px-4 py-2">Roll No</th>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-right px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-4 py-2">{r.roll_no}</td>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        disabled={!editable}
                        onClick={() => toggle(r.id)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium border",
                          r.status === "present"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200",
                          !editable && "opacity-70 cursor-not-allowed",
                        )}
                      >
                        {r.status === "present" ? "Present" : "Absent"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > 0 && editable && (
            <button
              onClick={submit}
              disabled={submitting || (submitted && !dirty)}
              className="inline-flex items-center gap-2 rounded-md bg-green-700 text-white
                         px-5 py-2.5 font-medium disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
              {submitting ? "Saving…" : submitLabel}
            </button>
          )}
        </>
      )}

      <AttendanceImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => { /* reload happens via the effect watching showImport */ }}
      />
    </div>
  );
}

function Selector({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void;
     options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col text-sm flex-1 sm:min-w-[160px]">
      <span className="text-gray-600 mb-1 whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2
                   focus:outline-none focus:ring-2 focus:ring-green-600"
      >
        {options.length === 0 && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function LoadingBlock() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-10 bg-gray-100 rounded" />
      <div className="h-10 bg-gray-100 rounded" />
      <div className="h-10 bg-gray-100 rounded" />
    </div>
  );
}

function ErrorBlock({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div role="alert"
         className={cn(
           "rounded-md border border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-2",
           compact ? "px-3 py-2" : "p-4",
         )}>
      <AlertCircle size={16} />
      {message}
      <RotateCcw size={14} className="ml-auto opacity-60" />
    </div>
  );
}