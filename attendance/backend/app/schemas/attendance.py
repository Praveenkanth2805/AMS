from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class AttendanceItem(BaseModel):
    student_id: UUID
    status: str = Field(pattern="^(present|absent)$")


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