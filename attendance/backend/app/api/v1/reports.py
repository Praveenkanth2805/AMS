import csv
import io
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.student import Student
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


# ======================= Helpers =======================

def _working_dates(db: Session, start: date, end: date,
                   class_id: UUID | None) -> set[date]:
    """Dates in [start,end] where at least one student in the scope was
    present. All other dates are treated as leave (Saturday/Sunday or
    holidays) and are excluded from the denominator."""
    stmt = (
        select(AttendanceRecord.attendance_date)
        .where(
            AttendanceRecord.attendance_date.between(start, end),
            AttendanceRecord.status == "present",
        )
        .distinct()
    )
    if class_id:
        stmt = stmt.where(AttendanceRecord.session_id.in_(
            select(AttendanceSession.id).where(
                AttendanceSession.class_id == class_id
            )
        ))
    return {d for (d,) in db.execute(stmt)}


def _report_rows(db: Session, start: date, end: date,
                 class_id: UUID | None, department_id: UUID | None,
                 academic_year_id: UUID | None) -> list[dict]:
    """Per-student rollup using only working dates as the denominator."""
    working = _working_dates(db, start, end, class_id)

    # Load attendance records within the date range, filtered to working dates
    record_stmt = (
        select(AttendanceRecord.student_id, AttendanceRecord.status)
        .where(AttendanceRecord.attendance_date.in_(working) if working else False)
    )
    student_stmt = select(Student).where(Student.is_active.is_(True))
    if class_id:
        student_stmt = student_stmt.where(Student.class_id == class_id)
    if department_id:
        student_stmt = student_stmt.where(Student.department_id == department_id)
    if academic_year_id:
        student_stmt = student_stmt.where(Student.academic_year_id == academic_year_id)

    students = list(db.scalars(student_stmt.order_by(Student.roll_no)))
    student_ids = {s.id for s in students}

    # Build per-student present count on working days
    present_by_student: dict = {}
    if working and student_ids:
        rows = db.execute(
            select(AttendanceRecord.student_id,
                   func.count().label("present_count"))
            .where(
                AttendanceRecord.attendance_date.in_(working),
                AttendanceRecord.status == "present",
                AttendanceRecord.student_id.in_(student_ids),
            )
            .group_by(AttendanceRecord.student_id)
        )
        present_by_student = {sid: cnt for sid, cnt in rows}

    total_working = len(working)
    out = []
    for s in students:
        present = present_by_student.get(s.id, 0)
        absent = total_working - present
        pct = round(present / total_working * 100, 2) if total_working else 0.0
        out.append({
            "student_id": str(s.id),
            "name": s.name,
            "roll_no": s.roll_no,
            "present": present,
            "absent": absent,
            "total_records": total_working,
            "percentage": pct,
        })
    return out


def _submitted_dates(db: Session, start: date, end: date,
                     class_id: UUID | None) -> list[str]:
    stmt = (
        select(AttendanceSession.attendance_date)
        .where(AttendanceSession.attendance_date.between(start, end))
        .distinct()
    )
    if class_id:
        stmt = stmt.where(AttendanceSession.class_id == class_id)
    return sorted(d.isoformat() for (d,) in db.execute(stmt))


# ======================= Endpoints =======================

@router.get("/attendance")
def attendance_report(
    start: date,
    end: date,
    class_id: UUID | None = None,
    department_id: UUID | None = None,
    academic_year_id: UUID | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if end < start:
        return {"error": {"code": "VALIDATION_ERROR",
                          "message": "end must be >= start"}}

    working_dates = _working_dates(db, start, end, class_id)
    rows = _report_rows(db, start, end, class_id, department_id, academic_year_id)
    submitted = _submitted_dates(db, start, end, class_id)

    total_records = sum(r["total_records"] for r in rows)
    total_present = sum(r["present"] for r in rows)
    total_absent = sum(r["absent"] for r in rows)
    overall_pct = round(total_present / total_records * 100, 2) if total_records else 0.0

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "filters": {
            "class_id": str(class_id) if class_id else None,
            "department_id": str(department_id) if department_id else None,
            "academic_year_id": str(academic_year_id) if academic_year_id else None,
        },
        "summary": {
            "total_students": len(rows),
            "total_records": total_records,
            "total_present": total_present,
            "total_absent": total_absent,
            "attendance_percentage": overall_pct,
            "working_days": len(working_dates),
            "submitted_sessions": len(submitted),
        },
        "working_dates": sorted(d.isoformat() for d in working_dates),
        "submitted_dates": submitted,
        "rows": rows,
    }


@router.get("/kpi")
def kpi_report(
    start: date,
    end: date,
    class_id: UUID | None = None,
    department_id: UUID | None = None,
    academic_year_id: UUID | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return students bucketed by attendance percentage for the range."""
    rows = _report_rows(db, start, end, class_id, department_id, academic_year_id)

    full = [r for r in rows if r["total_records"] > 0 and r["percentage"] >= 100]
    mid = [r for r in rows if 70 <= r["percentage"] < 100]
    low = [r for r in rows if r["total_records"] > 0 and r["percentage"] < 70]
    no_data = [r for r in rows if r["total_records"] == 0]

    def _strip(rows_: list[dict]) -> list[dict]:
        return [{"student_id": r["student_id"], "name": r["name"],
                 "roll_no": r["roll_no"], "percentage": r["percentage"]}
                for r in rows_]

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "buckets": {
            "full": {"count": len(full), "students": _strip(full)},
            "mid":  {"count": len(mid),  "students": _strip(mid)},
            "low":  {"count": len(low),  "students": _strip(low)},
            "no_data": {"count": len(no_data), "students": _strip(no_data)},
        },
    }


@router.get("/students/{student_id}/attendance")
def student_history(student_id: UUID, start: date, end: date,
                    db: Session = Depends(get_db),
                    _: User = Depends(get_current_user)):
    rows = db.execute(
        select(AttendanceRecord.attendance_date,
               AttendanceRecord.status,
               AttendanceRecord.periods)
        .where(AttendanceRecord.student_id == student_id,
               AttendanceRecord.attendance_date.between(start, end))
        .order_by(AttendanceRecord.attendance_date)
    ).all()
    return {
        "student_id": str(student_id),
        "records": [
            {"date": d.isoformat(), "status": s, "periods": p}
            for d, s, p in rows
        ],
    }


@router.get("/attendance/export")
def export_csv(start: date, end: date,
               class_id: UUID | None = None,
               department_id: UUID | None = None,
               academic_year_id: UUID | None = None,
               db: Session = Depends(get_db),
               _: User = Depends(get_current_user)):
    rows = _report_rows(db, start, end, class_id, department_id, academic_year_id)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=["roll_no", "name", "present", "absent",
                                        "total_records", "percentage"])
    w.writeheader()
    w.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition":
                 f'attachment; filename="attendance_{start}_{end}.csv"'},
    )