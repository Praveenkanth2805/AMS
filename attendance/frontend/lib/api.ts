import type { ApiErrorBody } from "./types";

// Client-only base URL. Empty string = same-origin (Next.js rewrites handle /api/v1/*).
// Server Components must use lib/api-server.ts instead.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

const IS_SERVER = typeof window === "undefined";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
  get isRateLimited() { return this.code === "RATE_LIMITED"; }
  get isUnauthenticated() { return this.code === "UNAUTHENTICATED"; }
  get isForbidden() { return this.code === "FORBIDDEN"; }
  get isNetworkError() { return this.code === "NETWORK_ERROR"; }
}

type Opts = Omit<RequestInit, "body"> & { body?: unknown; json?: boolean };

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const { body, json = true, headers, ...rest } = opts;

  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      ...rest,
      credentials: "include", // cookie-based sessions
      headers: {
        "Content-Type": "application/json",
        ...(headers ?? {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (IS_SERVER) {
      // Guardrail: this file is for the browser only. Server Components
      // should import from lib/api-server.ts (absolute URL + cookie forwarding).
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        "lib/api.ts was used on the server. Use lib/api-server.ts in Server Components.",
      );
    }
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      e instanceof Error ? e.message : "Network unavailable.",
    );
  }

  if (res.status === 204) return undefined as T;

  const payload = json ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const errBody = (payload ?? {}) as ApiErrorBody;
    const code = errBody?.error?.code ?? "INTERNAL_ERROR";
    const msg = errBody?.error?.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, code, msg, errBody?.error?.details);
  }

  return payload as T;
}

export const Api = {
  login: (email: string, password: string) =>
    api<import("./types").User>("/auth/login", { method: "POST", body: { email, password } }),
  logout: () => api<void>("/auth/logout", { method: "POST" }),
  me: () => api<import("./types").User>("/auth/me"),

    departmentsAll: (includeInactive = false) =>
    api<import("./types").DepartmentFull[]>(
      `/departments?include_inactive=${includeInactive}`),
  createDepartment: (body: { name: string; code: string }) =>
    api<import("./types").DepartmentFull>("/departments", { method: "POST", body }),
  updateDepartment: (id: string, body: Partial<{ name: string; code: string; is_active: boolean }>) =>
    api<import("./types").DepartmentFull>(`/departments/${id}`, { method: "PATCH", body }),
  deactivateDepartment: (id: string) =>
    api<void>(`/departments/${id}`, { method: "DELETE" }),

    classesFull: (params: {
    academic_year_id?: string;
    department_id?: string;
    include_inactive?: boolean;
  } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    });
    return api<import("./types").ClassFull[]>(`/classes?${qs.toString()}`);
  },
  createClass: (body: {
    name: string;
    section?: string | null;
    department_id: string;
    academic_year_id: string;
  }) => api<import("./types").ClassFull>("/classes", { method: "POST", body }),
  updateClass: (id: string,
                body: Partial<{ name: string; section: string | null; is_active: boolean }>) =>
    api<import("./types").ClassFull>(`/classes/${id}`, { method: "PATCH", body }),
  deactivateClass: (id: string) =>
    api<void>(`/classes/${id}`, { method: "DELETE" }),

    importStudents: (body: {
    academic_year_id: string;
    department_id: string;
    class_id: string;
    rows: Array<{
      roll_no?: string | null;
      name: string;
      register_no?: string | null;
      emis?: string | null;
      umis?: string | null;
      mobile?: string | null;
    }>;
  }) => api<{ created: number; failed: { index: number; name: string; roll_no: string; reason: string }[] }>(
    "/students/import", { method: "POST", body }),
   
      publicConfig: () => api<import("./types").PublicConfig>("/config"),

  bulkImportAttendance: (body: {
    academic_year_id: string;
    class_id: string;
    rows: Array<{ date: string; name?: string | null; roll_no?: string | null }>;
  }) => api<import("./types").BulkImportResult>(
    "/attendance/bulk-import", { method: "POST", body }),

  updateAttendanceRecords: (sessionId: string, records: { student_id: string; status: string }[]) =>
    api<import("./types").AttendanceSession>(
      `/attendance/sessions/${sessionId}/records`,
      { method: "PUT", body: { records } }),

  academicYears: () => api<import("./types").AcademicYear[]>("/academic-years"),
  departments: () => api<import("./types").Department[]>("/departments"),
  classes: (ayId: string, deptId: string) =>
    api<import("./types").ClassRef[]>(
      `/classes?academic_year_id=${ayId}&department_id=${deptId}`),

  students: (params: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) =>
      v !== undefined && v !== "" && qs.set(k, String(v)));
    return api<{ items: import("./types").Student[]; total: number; page: number; page_size: number }>(
      `/students?${qs.toString()}`);
  },
  createStudent: (body: unknown) =>
    api<import("./types").Student>("/students", { method: "POST", body }),
  updateStudent: (id: string, body: unknown) =>
    api<import("./types").Student>(`/students/${id}`, { method: "PATCH", body }),
    deactivateStudent: (id: string) =>
    api<{ id: string; mode: string; attendance_records_removed: number }>(
      `/students/${id}`, { method: "DELETE" }),

  hardDeleteStudent: (id: string) =>
    api<{ id: string; mode: string; attendance_records_removed: number }>(
      `/students/${id}?hard=true`, { method: "DELETE" }),

    attendanceToday: (classId: string, academicYearId: string, date?: string) => {
    const qs = new URLSearchParams({
      class_id: classId,
      academic_year_id: academicYearId,
    });
    if (date) qs.set("date", date);
    return api<{
      submitted: boolean;
      session: import("./types").AttendanceSession | null;
      students: { id: string; name: string; roll_no: string }[];
    }>(`/attendance/today?${qs.toString()}`);
  },

  submitAttendance: (body: unknown) =>
    api<import("./types").AttendanceSession>("/attendance/sessions", { method: "POST", body }),

  dashboardSummary: (classId: string, academicYearId: string) =>
    api<import("./types").DashboardSummary>(
      `/dashboard/summary?class_id=${classId}&academic_year_id=${academicYearId}`),

  attendanceReport: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && qs.set(k, v));
    return api<{
      range: { start: string; end: string };
      filters: Record<string, string | null>;
      summary: {
        total_students: number;
        total_records: number;
        total_present: number;
        total_absent: number;
        attendance_percentage: number;
        submitted_sessions: number;
      };
      submitted_dates: string[];
      rows: {
        student_id: string;
        name: string;
        roll_no: string;
        present: number;
        absent: number;
        total_records: number;
        percentage: number;
      }[];
    }>(`/reports/attendance?${qs.toString()}`);
  },
};