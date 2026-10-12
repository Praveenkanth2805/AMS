from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.student import Student
from app.models.user import User
from app.services.academic_year import today_institution_tz

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(class_id: UUID = Query(...), academic_year_id: UUID = Query(...),
            db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    d = today_institution_tz()

    total = db.scalar(select(func.count()).select_from(Student).where(
        Student.class_id == class_id,
        Student.academic_year_id == academic_year_id,
        Student.is_active.is_(True),
    )) or 0

    session = db.scalar(select(AttendanceSession).where(
        AttendanceSession.class_id == class_id,
        AttendanceSession.attendance_date == d,
    ))

    present = 0
    if session:
        present = db.scalar(
            select(func.count()).select_from(AttendanceRecord).where(
                AttendanceRecord.session_id == session.id,
                AttendanceRecord.status == "present",
            )
        ) or 0

    absent = (session.record_count - present) if session else None
    pct = round(present / session.record_count * 100, 2) \
        if session and session.record_count else None

    return {
        "date": d.isoformat(),
        "total_active_students": total,
        "present": present,
        "absent": absent,
        "attendance_percentage": pct,
        "submitted": session is not None,
        "submitted_at": session.submitted_at if session else None,
    }