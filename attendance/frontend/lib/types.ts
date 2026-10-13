export type Role = "admin" | "teacher";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AcademicYear { id: string; name: string; is_active: boolean; }
export interface Department { id: string; name: string; code: string; }
export interface ClassRef { id: string; name: string; section: string | null; }

export interface Student {
  id: string;
  roll_no: string;
  name: string;
  register_no: string | null;
  emis: string | null;
  umis: string | null;
  mobile: string | null;
  department_id: string;
  class_id: string;
  academic_year_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus = "present" | "absent";

export interface AttendanceSession {
  id: string;
  class_id: string;
  academic_year_id: string;
  attendance_date: string;
  submitted_by: string;
  submitted_at: string;
  record_count: number;
  records: { student_id: string; status: AttendanceStatus }[];
}

export interface DashboardSummary {
  date: string;
  total_active_students: number;
  present: number;
  absent: number | null;
  attendance_percentage: number | null;
  submitted: boolean;
  submitted_at: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface DepartmentFull {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface ClassFull {
  id: string;
  name: string;
  section: string | null;
  department_id: string;
  academic_year_id: string;
  is_active: boolean;
}
export interface PublicConfig {
  allow_attendance_edit: boolean;
  academic_year_start_month: number;
  institutional_timezone: string;
}

export interface BulkImportResult {
  sessions_created: number;
  dates_created: string[];
  dates_skipped: string[];
  students_per_session: number;
  unknown_names: string[];
}