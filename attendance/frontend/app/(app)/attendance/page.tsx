"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, CheckCircle2, Loader2, RotateCcw, Upload,
} from "lucide-react";

import { Api, ApiError } from "@/lib/api";
import type {
  AcademicYear, AttendanceStatus, ClassRef, Department,
} from "@/lib/types";
import AttendanceImportModal from "@/components/attendance/AttendanceImportModal";
import { cn } from "@/lib/utils";

type Row = { id: string; name: string; roll_no: string; status: AttendanceStatus };

function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AttendancePage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);

  const [yearId, setYearId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [classId, setClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(() => localToday());

  const [rows, setRows] = useState<Row[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowEdit, setAllowEdit] = useState(false);

  const [showImport, setShowImport] = useState(false);

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

  useEffect(() => {
    if (!yearId || !classId) return;
    setLoading(true);
    setError(null);
    setSubmitted(false);
    setDirty(false);
    setSessionId(null);

    Api.attendanceToday(classId, yearId, selectedDate)
      .then((res) => {
        if (res.submitted && res.session) {
          setSubmitted(true);
          setSessionId(res.session.id);
          const recordMap = new Map(
            res.session.records.map((r) => [r.student_id, r.status] as const),
          );
          setRows(
            res.students.map((s) => ({
              id: s.id,
              name: s.name,
              roll_no: s.roll_no,
              status: (recordMap.get(s.id) ?? "absent") as AttendanceStatus,
            })),
          );
        } else {
          setRows(
            res.students.map((s) => ({
              ...s,
              status: "absent" as const,
            })),
          );
        }
      })
      .catch(() => setError("Failed to load attendance."))
      .finally(() => setLoading(false));
  }, [classId, yearId, selectedDate, showImport]);

  const present = useMemo(
    () => rows.filter((r) => r.status === "present").length,
    [rows],
  );
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
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: r.status === "present" ? "absent" : "present" }
          : r,
      ),
    );
    if (submitted) setDirty(true);
  }

  async function submit() {
    if (submitted && !allowEdit) return;
    if (submitted && !dirty) return;
    setSubmitting(true);
    setError(null);

    try {
      if (submitted && sessionId && allowEdit) {
        const res = await Api.updateAttendanceRecords(
          sessionId,
          rows.map((r) => ({ student_id: r.id, status: r.status })),
        );
        const recordMap = new Map(
          res.records.map((r) => [r.student_id, r.status] as const),
        );
        setRows((prev) =>
          prev.map((r) => ({
            ...r,
            status: (recordMap.get(r.id) ?? r.status) as AttendanceStatus,
          })),
        );
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

  const editable = !submitted || allowEdit;
  const submitLabel = submitted
    ? dirty
      ? "Save Changes"
      : "Saved"
    : "Submit Attendance";

  const today = localToday();
  const isPastDate = selectedDate < today;

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          <label className="flex flex-col text-sm min-w-0">
            <span className="text-gray-600 mb-0.5 text-xs whitespace-nowrap">Date</span>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full h-9 rounded-md border border-gray-300 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </label>

          <Selector
            label="Academic Year"
            value={yearId}
            onChange={setYearId}
            options={years.map((y) => ({ value: y.id, label: y.name }))}
          />
          <Selector
            label="Department"
            value={deptId}
            onChange={setDeptId}
            options={departments.map((d) => ({
              value: d.id,
              label: `${d.name} (${d.code})`,
            }))}
          />
          <Selector
            label="Class"
            value={classId}
            onChange={setClassId}
            options={classes.map((c) => ({
              value: c.id,
              label: c.section ? `${c.name} · ${c.section}` : c.name,
            }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          {isPastDate && (
            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 whitespace-nowrap">
              Past date
            </span>
          )}

          <button
            onClick={setAllPresent}
            disabled={!editable || rows.length === 0}
            className="rounded-md bg-green-700 text-white h-8 px-3 text-sm font-medium disabled:opacity-50"
          >
            Present All
          </button>
          <button
            onClick={setAllAbsent}
            disabled={!editable || rows.length === 0}
            className="rounded-md border border-red-200 text-red-700 h-8 px-3 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
          >
            Absent All
          </button>

          <span className="text-sm text-gray-600">
            <b className="text-green-700">{present}</b>
            <span className="text-gray-400 mx-1">/</span>
            <b className="text-red-600">{absent}</b>
            <span className="text-gray-400 mx-1">/</span>
            {rows.length}
          </span>

          {submitted && !allowEdit && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
              <CheckCircle2 size={12} /> Read-only
            </span>
          )}
          {submitted && allowEdit && (
            <span className="inline-flex items-center gap-1 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5">
              <CheckCircle2 size={12} /> Editable
            </span>
          )}

          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-green-700 h-8 px-3 text-sm text-green-700 hover:bg-green-50 ml-auto"
          >
            <Upload size={14} /> Import
          </button>

          {rows.length > 0 && editable && (
            <button
              onClick={submit}
              disabled={submitting || (submitted && !dirty)}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-700 text-white h-8 px-4 text-sm font-medium disabled:opacity-60"
            >
              {submitting ? <Loader2 className="animate-spin" size={14} /> : null}
              {submitting ? "Saving…" : submitLabel}
            </button>
          )}
        </div>
      </section>

      {error && <ErrorBlock message={error} compact />}

      {loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center">
          <p className="text-sm text-gray-500">No active students in this class.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-green-50 text-green-900 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-[120px]">Roll No</th>
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-right px-3 py-2 font-medium w-[110px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                  <td className="px-3 py-1.5 tabular-nums text-gray-700">{r.roll_no}</td>
                  <td className="px-3 py-1.5">{r.name}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      disabled={!editable}
                      onClick={() => toggle(r.id)}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium border min-w-[68px]",
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
      )}

      {/* Bottom centered save button — mirrors the top one */}
      {rows.length > 0 && editable && !loading && (
        <div className="flex justify-center pt-2">
          <button
            onClick={submit}
            disabled={submitting || (submitted && !dirty)}
            className="inline-flex items-center gap-2 rounded-md bg-green-700
                       text-white h-10 px-6 text-sm font-medium
                       disabled:opacity-60 hover:bg-green-800"
          >
            {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
            {submitting ? "Saving…" : submitLabel}
          </button>
        </div>
      )}

      <AttendanceImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => {
          /* reload triggered by showImport in deps */
        }}
      />
    </div>
  );
}

function Selector({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col text-sm min-w-0">
      <span className="text-gray-600 mb-0.5 text-xs whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-md border border-gray-300 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
      >
        {options.length === 0 && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LoadingBlock() {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-9 bg-green-50/50" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-8 border-t border-gray-100 bg-gray-50/40" />
      ))}
    </div>
  );
}

function ErrorBlock({
  message,
  compact = false,
}: {
  message: string;
  compact?: boolean;
}) {
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
