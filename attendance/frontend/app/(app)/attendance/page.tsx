"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";

import { Api, ApiError } from "@/lib/api";
import type { AcademicYear, AttendanceStatus, ClassRef, Department } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = { id: string; name: string; roll_no: string; status: AttendanceStatus };

const DRAFT_KEY = "attendance.draft.v1";

export default function AttendancePage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);

  const [yearId, setYearId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [classId, setClassId] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load reference data
  useEffect(() => {
    (async () => {
      const [y, d] = await Promise.all([Api.academicYears(), Api.departments()]);
      setYears(y);
      setDepartments(d);
      setYearId(y[0]?.id ?? "");
      setDeptId(d[0]?.id ?? "");
    })().catch(() => setError("Failed to load academic data."));
  }, []);

  // Reload classes when year or department changes
  useEffect(() => {
    if (!yearId || !deptId) return;
    setClasses([]);
    setClassId("");
    Api.classes(yearId, deptId)
      .then((c) => {
        setClasses(c);
        setClassId(c[0]?.id ?? "");
      })
      .catch(() => setError("Failed to load classes."));
  }, [yearId, deptId]);

  // Load attendance state when class changes
  useEffect(() => {
    if (!yearId || !classId) return;
    setLoading(true);
    setError(null);
    setSubmitted(false);
    Api.attendanceToday(classId, yearId)
      .then((res) => {
        if (res.submitted && res.session) {
          setSubmitted(true);
          setRows(res.session.records.map((r) => {
            const s = res.students.find((x) => x.id === r.student_id);
            return { id: r.student_id, name: s?.name ?? "", roll_no: s?.roll_no ?? "", status: r.status };
          }));
        } else {
          // Default to absent (spec §3.4)
          setRows(res.students.map((s) => ({ ...s, status: "absent" as const })));
        }
      })
      .catch(() => setError("Failed to load attendance."))
      .finally(() => setLoading(false));
  }, [classId, yearId]);

  // Persist local draft so a failed request does not lose work (spec §9)
  useEffect(() => {
    if (!submitted && rows.length) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ classId, rows }));
    }
  }, [rows, classId, submitted]);

  const present = useMemo(() => rows.filter((r) => r.status === "present").length, [rows]);
  const absent = rows.length - present;

  function setAllPresent() {
    setRows((prev) => prev.map((r) => ({ ...r, status: "present" })));
  }
  function toggle(id: string) {
    setRows((prev) => prev.map((r) =>
      r.id === id ? { ...r, status: r.status === "present" ? "absent" : "present" } : r));
  }

  async function submit() {
    if (submitted || !classId || rows.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await Api.submitAttendance({
        academic_year_id: yearId,
        class_id: classId,
        records: rows.map((r) => ({ student_id: r.id, status: r.status })),
      });
      setSubmitted(true);
      setRows(res.records.map((r) => {
        const existing = rows.find((x) => x.id === r.student_id)!;
        return { ...existing, status: r.status };
      }));
      localStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "ATTENDANCE_ALREADY_SUBMITTED")
          setError("Attendance was already submitted. Reloading…");
        else if (err.isRateLimited)
          setError("Too many requests. Please wait a moment.");
        else if (err.code === "NETWORK_ERROR")
          setError("Network unavailable. Your draft is preserved — retry when online.");
        else setError(err.message);
      } else setError("Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end gap-3">
        <Selector label="Academic Year" value={yearId} onChange={setYearId}
          options={years.map((y) => ({ value: y.id, label: y.name }))} />
        <Selector label="Department" value={deptId} onChange={setDeptId}
          options={departments.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))} />
        <Selector label="Class" value={classId} onChange={setClassId}
          options={classes.map((c) => ({ value: c.id, label: c.section ? `${c.name} · ${c.section}` : c.name }))} />
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
              disabled={submitted || rows.length === 0}
              className="rounded-md bg-green-700 text-white px-4 py-2 font-medium disabled:opacity-50"
            >
              Present All
            </button>
            <span className="text-sm text-gray-600">
              Present <b className="text-green-700">{present}</b> · Absent{" "}
              <b className="text-red-600">{absent}</b> · Total {rows.length}
            </span>
            {submitted && (
              <span className="inline-flex items-center gap-1 text-sm text-green-700">
                <CheckCircle2 size={16} /> Submitted — read-only
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
                        disabled={submitted}
                        onClick={() => toggle(r.id)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium border",
                          r.status === "present"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200",
                          submitted && "opacity-70 cursor-not-allowed",
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

          {!submitted && rows.length > 0 && (
            <button
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-green-700 text-white px-5 py-2.5 font-medium disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
              {submitting ? "Submitting…" : "Submit Attendance"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Selector({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void;
     options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col text-sm">
      <span className="text-gray-600 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 min-w-[180px] focus:outline-none focus:ring-2 focus:ring-green-600"
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
    <div
      role="alert"
      className={cn(
        "rounded-md border border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-2",
        compact ? "px-3 py-2" : "p-4",
      )}
    >
      <AlertCircle size={16} />
      {message}
      <RotateCcw size={14} className="ml-auto opacity-60" />
    </div>
  );
}