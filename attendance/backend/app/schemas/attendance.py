from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field, field_validator

from app.services.attendance_rules import PERIODS_PER_DAY


class AttendanceItem(BaseModel):
    """One student's per-period marks for a single day."""
    student_id: UUID
    periods: list[bool] = Field(min_length=PERIODS_PER_DAY,
                                max_length=PERIODS_PER_DAY)

    @field_validator("periods")
    @classmethod
    def _exact_length(cls, v: list[bool]) -> list[bool]:
        if len(v) != PERIODS_PER_DAY:
            raise ValueError(f"must have exactly {PERIODS_PER_DAY} periods")
        return v


class AttendanceSubmit(BaseModel):
    academic_year_id: UUID
    class_id: UUID
    attendance_date: date | None = None
    records: list[AttendanceItem] = Field(min_length=1)

    @field_validator("records")
    @classmethod
    def _no_dup_students(cls, v: list[AttendanceItem]) -> list[AttendanceItem]:
        ids = [r.student_id for r in v]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate student ids in submission")
        return v


class AttendanceRecordOut(BaseModel):
    student_id: UUID
    status: str
    periods: list[bool] | None = None   # None for legacy single-status rows

    class Config:
        from_attributes = True


class AttendanceSessionOut(BaseModel):
    id: UUID
    class_id: UUID
    academic_year_id: UUID
    attendance_date: date
    submitted_by: UUID
    submitted_at: datetime
    record_count: int
    records: list[AttendanceRecordOut] = []

    class Config:
        from_attributes = True


class AttendanceTodayResponse(BaseModel):
    submitted: bool
    session: AttendanceSessionOut | None = None
    students: list[dict] = []


# ---------- Bulk import ----------

class AttendanceBulkRow(BaseModel):
    date: date
    name: str | None = None
    roll_no: str | None = None


class AttendanceBulkImportRequest(BaseModel):
    academic_year_id: UUID
    class_id: UUID
    rows: list[AttendanceBulkRow] = Field(min_length=1, max_length=20000)


class AttendanceBulkImportResult(BaseModel):
    sessions_created: int
    dates_created: list[str]
    dates_skipped: list[str]
    students_per_session: int
    unknown_names: list[str]


# ---------- Update (edit mode) ----------

class AttendanceUpdateRequest(BaseModel):
    records: list[AttendanceItem] = Field(min_length=1)

    @field_validator("records")
    @classmethod
    def _no_dup(cls, v: list[AttendanceItem]) -> list[AttendanceItem]:
        ids = [r.student_id for r in v]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate student ids")
        return v