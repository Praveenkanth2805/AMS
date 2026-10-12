import csv
import io
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.student import Student
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


def _report_rows(db: Session, start: date, end: date,
                 class_id: UUID | None, department_id: UUID | None,
                 academic_year_id: UUID | None) -> list[dict]:
    stmt = (
        select(
            AttendanceRecord.student_id,
            Student.name,
            Student.roll_no,
            func.count().label("total_records"),
            func.sum((AttendanceRecord.status == "present").cast(func.INTEGER)).label("present"),
        )
        .join(Student, Student.id == AttendanceRecord.student_id)
        .join(AttendanceSession, AttendanceSession.id == AttendanceRecord.session_id)
        .where(AttendanceRecord.attendance_date.between(start, end))
        .group_by(AttendanceRecord.student_id, Student.name, Student.roll_no)
        .order_by(Student.roll_no)
    )
    if class_id:
        stmt = stmt.where(AttendanceSession.class_id == class_id)
    if department_id:
        stmt = stmt.where(Student.department_id == department_id)
    if academic_year_id:
        stmt = stmt.where(Student.academic_year_id == academic_year_id)

    rows = []
    for r in db.execute(stmt):
        total = int(r.total_records or 0)
        present = int(r.present or 0)
        rows.append({
            "student_id": str(r.student_id),
            "name": r.name,
            "roll_no": r.roll_no,
            "present": present,
            "absent": total - present,
            "total_records": total,
            "percentage": round(present / total * 100, 2) if total else 0.0,
        })
    return rows


@router.get("/attendance")
def attendance_report(start: date, end: date,
                      class_id: UUID | None = None,
                      department_id: UUID | None = None,
                      academic_year_id: UUID | None = None,
                      db: Session = Depends(get_db),
                      _: User = Depends(get_current_user)):
    if end < start:
        return {"error": {"code": "VALIDATION_ERROR",
                          "message": "end must be >= start"}}
    rows = _report_rows(db, start, end, class_id, department_id, academic_year_id)

    missing_q = select(AttendanceSession.attendance_date).distinct()
    if class_id:
        missing_q = missing_q.where(AttendanceSession.class_id == class_id)
    submitted_dates = {r for (r,) in db.execute(missing_q)}

    return {
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "filters": {
            "class_id": str(class_id) if class_id else None,
            "department_id": str(department_id) if department_id else None,
            "academic_year_id": str(academic_year_id) if academic_year_id else None,
        },
        "submitted_dates": sorted(d.isoformat() for d in submitted_dates),
        "rows": rows,
    }


@router.get("/students/{student_id}/attendance")
def student_history(student_id: UUID, start: date, end: date,
                    db: Session = Depends(get_db),
                    _: User = Depends(get_current_user)):
    rows = db.execute(
        select(AttendanceRecord.attendance_date, AttendanceRecord.status)
        .where(AttendanceRecord.student_id == student_id,
               AttendanceRecord.attendance_date.between(start, end))
        .order_by(AttendanceRecord.attendance_date)
    ).all()
    return {"student_id": str(student_id),
            "records": [{"date": d.isoformat(), "status": s} for d, s in rows]}


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