"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Api, ApiError } from "@/lib/api";
import type { AcademicYear, ClassRef, Department } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { FilterBar, FilterField } from "@/components/ui/FilterBar";

type Row = {
  student_id: string; name: string; roll_no: string;
  present: number; absent: number; total_records: number; percentage: number;
};

type Report = {
  range: { start: string; end: string };
  filters: Record<string, string | null>;
  submitted_dates: string[];
  rows: Row[];
};

function isoDaysAgo(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);

  const [start, setStart] = useState(isoDaysAgo(30));
  const [end, setEnd] = useState(isoDaysAgo(0));
  const [yearId, setYearId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [classId, setClassId] = useState("");

  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [y, d] = await Promise.all([Api.academicYears(), Api.departments()]);
      setYears(y); setDepartments(d);
      setYearId(y[0]?.id ?? ""); setDeptId(d[0]?.id ?? "");
    })().catch(() => setError("Failed to load filters."));
  }, []);

  useEffect(() => {
    if (!yearId || !deptId) return;
    Api.classes(yearId, deptId).then((c) => {
      setClasses(c); setClassId(c[0]?.id ?? "");
    });
  }, [yearId, deptId]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await Api.attendanceReport({
        start, end, class_id: classId || undefined,
        department_id: deptId || undefined, academic_year_id: yearId || undefined,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load report.");
    } finally { setLoading(false); }
  }, [start, end, classId, deptId, yearId]);

  const columns: Column<Row>[] = [
    { key: "roll", header: "Roll No", cell: (r) => r.roll_no },
    { key: "name", header: "Name", cell: (r) => r.name },
    { key: "present", header: "Present", align: "right", cell: (r) => r.present },
    { key: "absent", header: "Absent", align: "right", cell: (r) => r.absent },
    { key: "total", header: "Records", align: "right", cell: (r) => r.total_records },
    { key: "pct", header: "%", align: "right",
      cell: (r) => `${r.percentage.toFixed(2)}%` },
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
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${base}/api/v1/reports/attendance/export?${qs}`,
                              { credentials: "include" });
      if (!res.ok) throw new Error("export_failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `attendance_${start}_${end}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Could not export CSV. Please try again.");
    }
  }

  return (
    <div>
      <PageHeader title="Reports" description="Submitted attendance only. Unsubmitted dates are excluded."
        actions={
          <button onClick={exportCsv}
                  className="inline-flex items-center gap-2 rounded-md bg-green-700 px-3 py-2
                             text-sm text-white hover:bg-green-800">
            <Download size={16} /> Export CSV
          </button>
        } />

      <FilterBar>
        <FilterField label="From">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                 className="rounded-md border border-gray-300 px-3 py-2" />
        </FilterField>
        <FilterField label="To">
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                 className="rounded-md border border-gray-300 px-3 py-2" />
        </FilterField>
        <FilterField label="Academic Year">
          <select value={yearId} onChange={(e) => setYearId(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2">
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </FilterField>
        <FilterField label="Department">
          <select value={deptId} onChange={(e) => setDeptId(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2">
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </FilterField>
        <FilterField label="Class">
          <select value={classId} onChange={(e) => setClassId(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FilterField>
        <button onClick={load}
                className="rounded-md bg-green-700 text-white px-4 py-2 text-sm hover:bg-green-800">
          Apply
        </button>
      </FilterBar>

      {exportError && <div className="mt-3"><ErrorState message={exportError} /></div>}

      <div className="mt-6">
        {loading && <LoadingSkeleton rows={4} />}
        {error && <ErrorState message={error} onRetry={load} />}

        {data && !loading && !error && (
          <>
            <div className="text-xs text-gray-500 mb-2">
              Range: {data.range.start} → {data.range.end} ·
              Submitted sessions: {data.submitted_dates.length}
            </div>
            {data.rows.length === 0 ? (
              <EmptyState title="No attendance records in this range"
                          description="Try a wider date range or different filters." />
            ) : (
              <DataTable columns={columns} rows={data.rows} getRowKey={(r) => r.student_id} />
            )}
          </>
        )}
      </div>
    </div>
  );
}