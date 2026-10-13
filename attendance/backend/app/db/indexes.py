"""Run-once index creation. Idempotent — runs on every startup, ~50ms."""
import logging

from sqlalchemy import text

from app.db.session import engine

log = logging.getLogger("indexes")

INDEXES = [
    # Students
    ("ix_students_class_id",
     "CREATE INDEX IF NOT EXISTS ix_students_class_id ON students (class_id)"),
    ("ix_students_department_id",
     "CREATE INDEX IF NOT EXISTS ix_students_department_id ON students (department_id)"),
    ("ix_students_academic_year_id",
     "CREATE INDEX IF NOT EXISTS ix_students_academic_year_id ON students (academic_year_id)"),
    ("ix_students_is_active",
     "CREATE INDEX IF NOT EXISTS ix_students_is_active ON students (is_active) WHERE is_active = true"),

    # Classes
    ("ix_classes_dept_ay",
     "CREATE INDEX IF NOT EXISTS ix_classes_dept_ay ON classes (department_id, academic_year_id)"),

    # Attendance sessions — hot for /today and /reports
    ("ix_sessions_date",
     "CREATE INDEX IF NOT EXISTS ix_sessions_date ON attendance_sessions (attendance_date DESC)"),
    ("ix_sessions_class_date",
     "CREATE INDEX IF NOT EXISTS ix_sessions_class_date ON attendance_sessions (class_id, attendance_date DESC)"),

    # Attendance records — hot for reports and per-student history
    ("ix_records_date",
     "CREATE INDEX IF NOT EXISTS ix_records_date ON attendance_records (attendance_date DESC)"),
    ("ix_records_session",
     "CREATE INDEX IF NOT EXISTS ix_records_session ON attendance_records (session_id)"),
    ("ix_records_student_date",
     "CREATE INDEX IF NOT EXISTS ix_records_student_date ON attendance_records (student_id, attendance_date DESC)"),
]


def ensure_indexes() -> None:
    with engine.begin() as conn:
        for name, ddl in INDEXES:
            try:
                conn.execute(text(ddl))
            except Exception as e:
                log.warning("index %s skipped: %s", name, e)
    log.info("indexes: ensured %d indexes", len(INDEXES))