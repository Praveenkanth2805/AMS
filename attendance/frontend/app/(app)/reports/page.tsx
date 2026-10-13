"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Users, CheckCircle2, XCircle, Percent } from "lucide-react";
import { Api, ApiError } from "@/lib/api";
import type { AcademicYear, ClassRef, Department } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { type Column } from "@/components/ui/DataTable";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import FilterBar,{  FilterField } from "@/components/ui/FilterBar";

type Row = {
  student_id: string; name: string; roll_no: string;
  present: number; absent: number; total_records: number; percentage: number;
};

type Summary = {
  total_students: number;
  total_records: number;
  total_present: number;
  total_absent: number;
  attendance_percentage: number;
  submitted_sessions: number;
};

type Report = {
  range: { start: string; end: string };
  filters: Record<string, string | null>;
  summary: Summary;
  submitted_dates: string[];
  rows: Row[];
};

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfYearISO() {
  const d = new Date();
  const y = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1;
  // June 1 of academic year
  return `${y}-06-01`;
}

export default function ReportsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);

  const [start, setStart] = useState(startOfYearISO());
  const [end, setEnd] = useState(todayISO());
  const [yearId, setYearId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [classId, setClassId] = useState("");

  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Load years + departments once
  useEffect(() => {
    (async () => {
      try {
        const [y, d] = await Promise.all([Api.academicYears(), Api.departments()]);
        setYears(y);
        setDepartments(d);
        setYearId(y[0]?.id ?? "");
        setDeptId(d[0]?.id ?? "");
      } catch {
        setError("Failed to load filters.");
      }
    })();
  }, []);

  // Reload classes when year or dept changes
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await Api.attendanceReport({
        start,
        end,
        class_id: classId || undefined,
        department_id: deptId || undefined,
        academic_year_id: yearId || undefined,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, [start, end, classId, deptId, yearId]);

  // Auto-load once filters are ready
  useEffect(() => {
    if (yearId && deptId && classId) load();
  }, [yearId, deptId, classId, load]);

  const columns: Column<Row>[] = [
    { key: "roll", header: "Roll No", cell: (r) => r.roll_no },
    { key: "name", header: "Name", cell: (r) => r.name },
    { key: "present", header: "Present", align: "right", cell: (r) => r.present },
    { key: "absent", header: "Absent", align: "right", cell: (r) => r.absent },
    { key: "total", header: "Records", align: "right", cell: (r) => r.total_records },
    {
      key: "pct",
      header: "%",
      align: "right",
      cell: (r) => (r.total_records === 0 ? "—" : `${r.percentage.toFixed(1)}%`),
    },
  ];

  async function exportCsv() {
    setExportError(null);
    try {
      const qs = new URLSearchParams({
        start, end,
        ...(classId && { class_id: classId }),
        ...(deptId && { department_id: deptId }),
        ...(yearId && { academic_year_id: yearId }),
      });
      const base = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${base}/api/v1/reports/attendance/export?${qs}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("export_failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${start}_${end}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Could not export CSV. Please try again.");
    }
  }

  const summary = data?.summary;

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Attendance summary. Only submitted sessions count."
        actions={
          <button
            onClick={exportCsv}
            disabled={!data || data.rows.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-green-700 px-3 py-2
                       text-sm text-white hover:bg-green-800 disabled:opacity-50"
          >
            <Download size={16} /> Export CSV
          </button>
        }
      />

      <FilterBar>
        <FilterField label="From">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </FilterField>
        <FilterField label="To">
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </FilterField>
        <FilterField label="Academic Year">
          <select
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Department">
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Class">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            {classes.length === 0 && <option value="">—</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.section ? `${c.name} · ${c.section}` : c.name}
              </option>
            ))}
          </select>
        </FilterField>
        <button
          onClick={load}
          className="self-end rounded-md bg-green-700 text-white px-4 py-2 text-sm
                     hover:bg-green-800"
        >
          Apply
        </button>
      </FilterBar>

      {exportError && (
        <div className="mt-3">
          <ErrorState message={exportError} />
        </div>
      )}

      <div className="mt-6 space-y-4">
        {loading && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}
                     className="rounded-lg border border-gray-200 p-4 space-y-3 animate-pulse">
                  <div className="h-3 w-20 rounded bg-gray-100" />
                  <div className="h-7 w-16 rounded bg-gray-100" />
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 border-b border-gray-100 bg-gray-50/50 animate-pulse" />
              ))}
            </div>
          </>
        )}

        {error && <ErrorState message={error} onRetry={load} />}

        {data && !loading && !error && (
          <>
            {/* Range / sessions line */}
            <div className="text-xs text-gray-500">
              Range: <b>{data.range.start}</b> → <b>{data.range.end}</b> ·{" "}
              Submitted sessions: <b>{data.summary.submitted_sessions}</b>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Students"
                value={summary?.total_students ?? 0}
                Icon={Users}
              />
              <StatCard
                label="Present"
                value={summary?.total_present ?? 0}
                Icon={CheckCircle2}
                tone="success"
              />
              <StatCard
                label="Absent"
                value={summary?.total_absent ?? 0}
                Icon={XCircle}
                tone="danger"
              />
              <StatCard
                label="Attendance %"
                value={
                  summary && summary.total_records > 0
                    ? `${summary.attendance_percentage.toFixed(1)}%`
                    : "—"
                }
                Icon={Percent}
              />
            </div>

            {/* Table or empty state */}
            {data.rows.length === 0 ? (
              <EmptyState
                title="No students found"
                description="Adjust department/class filters or add students."
              />
            ) : summary && summary.total_records === 0 ? (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3
                              text-sm text-yellow-900">
                No attendance has been submitted in this range. Student list shown with 0 records.
              </div>
            ) : null}

            {data.rows.length > 0 && (
              <DataTable
                columns={columns}
                rows={data.rows}
                getRowKey={(r) => r.student_id}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}