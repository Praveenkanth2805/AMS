import type { ApiErrorBody } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  get isRateLimited() { return this.code === "RATE_LIMITED"; }
  get isUnauthenticated() { return this.code === "UNAUTHENTICATED"; }
  get isForbidden() { return this.code === "FORBIDDEN"; }
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
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Network unavailable.");
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
    api<void>(`/students/${id}`, { method: "DELETE" }),

  attendanceToday: (classId: string, academicYearId: string) =>
    api<{
      submitted: boolean;
      session: import("./types").AttendanceSession | null;
      students: { id: string; name: string; roll_no: string }[];
    }>(`/attendance/today?class_id=${classId}&academic_year_id=${academicYearId}`),
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
      submitted_dates: string[];
      rows: {
        student_id: string; name: string; roll_no: string;
        present: number; absent: number; total_records: number; percentage: number;
      }[];
    }>(`/reports/attendance?${qs.toString()}`);
  },
};