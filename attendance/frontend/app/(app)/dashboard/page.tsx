"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, Users, XCircle } from "lucide-react";
import { Api, ApiError } from "@/lib/api";
import type { AcademicYear, ClassRef, DashboardSummary, Department } from "@/lib/types";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import NetworkError from "@/components/ui/NetworkError";
import FilterBar,{ FilterField } from "@/components/ui/FilterBar";

export default function DashboardPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);
  const [yearId, setYearId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [classId, setClassId] = useState("");

  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ kind: "api" | "network"; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [y, d] = await Promise.all([Api.academicYears(), Api.departments()]);
      setYears(y); setDepartments(d);
      setYearId(y[0]?.id ?? ""); setDeptId(d[0]?.id ?? "");
    })().catch(() => setError({ kind: "api", msg: "Failed to load filters." }));
  }, []);

  useEffect(() => {
    if (!yearId || !deptId) return;
    setClasses([]); setClassId("");
    Api.classes(yearId, deptId).then((c) => {
      setClasses(c); setClassId(c[0]?.id ?? "");
    });
  }, [yearId, deptId]);

  const load = useCallback(async () => {
    if (!classId || !yearId) return;
    setLoading(true); setError(null);
    try {
      setData(await Api.dashboardSummary(classId, yearId));
    } catch (err) {
      if (err instanceof ApiError && err.code === "NETWORK_ERROR")
        setError({ kind: "network", msg: "Network unavailable." });
      else setError({ kind: "api", msg: "Could not load dashboard." });
    } finally { setLoading(false); }
  }, [classId, yearId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader title="Dashboard" description={data ? `Date: ${data.date}` : undefined} />

      <FilterBar>
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
      </FilterBar>

      <div className="mt-6">
        {error?.kind === "network" && <NetworkError onRetry={load} />}
        {error?.kind === "api" && <ErrorState message={error.msg} onRetry={load} />}
        {loading && !data && <LoadingSkeleton rows={3} />}

        {data && (
          <>
            {!data.submitted && (
              <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3
                              text-sm text-yellow-900">
                Attendance not submitted for {data.date}. Absences are not confirmed.
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total active students" value={data.total_active_students} Icon={Users} />
              <StatCard label="Present" value={data.submitted ? data.present : "—"}
                        Icon={CheckCircle2} tone="success" />
              <StatCard label="Absent" value={data.submitted ? (data.absent ?? "—") : "—"}
                        Icon={XCircle} tone="danger" />
              <StatCard label="Attendance %"
                        value={data.attendance_percentage != null
                          ? `${data.attendance_percentage}%` : "—"}
                        Icon={CalendarCheck} />
            </div>

            {data.submitted && data.submitted_at && (
              <p className="mt-3 text-xs text-gray-500">
                Submitted at {new Date(data.submitted_at).toLocaleString()}
              </p>
            )}

            {!data.submitted && data.total_active_students === 0 && (
              <EmptyState title="No active students in this class"
                          description="Add students or select a different class." />
            )}
          </>
        )}
      </div>
    </div>
  );
}