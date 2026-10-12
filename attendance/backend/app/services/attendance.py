from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import (AttendanceAlreadySubmitted, Forbidden, ValidationError)
from app.models.academic import Class
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.student import Student
from app.models.user import User
from app.schemas.attendance import AttendanceSubmit
from app.services.academic_year import today_institution_tz


def submit_attendance(db: Session, payload: AttendanceSubmit,
                      user: User) -> AttendanceSession:
    attendance_date = payload.attendance_date or today_institution_tz()

    klass = db.get(Class, payload.class_id)
    if not klass or klass.academic_year_id != payload.academic_year_id:
        raise ValidationError("class does not belong to academic year")
    if not klass.is_active:
        raise ValidationError("class is inactive")

    if user.role not in ("admin", "teacher"):
        raise Forbidden()

    existing = db.scalar(
        select(AttendanceSession).where(
            AttendanceSession.class_id == payload.class_id,
            AttendanceSession.attendance_date == attendance_date,
        )
    )
    if existing:
        raise AttendanceAlreadySubmitted()

    active_students = {
        s.id: s for s in db.scalars(
            select(Student).where(
                Student.class_id == payload.class_id,
                Student.academic_year_id == payload.academic_year_id,
                Student.is_active.is_(True),
            )
        )
    }
    if not active_students:
        raise ValidationError("no active students in the selected class")

    submitted_ids = {r.student_id for r in payload.records}
    missing = set(active_students) - submitted_ids
    extras = submitted_ids - set(active_students)
    if missing:
        raise ValidationError(
            "submission incomplete",
            details={"missing_student_ids": [str(i) for i in missing]},
        )
    if extras:
        raise ValidationError(
            "records include students outside the selected class",
            details={"unknown_student_ids": [str(i) for i in extras]},
        )

    session = AttendanceSession(
        class_id=payload.class_id,
        academic_year_id=payload.academic_year_id,
        attendance_date=attendance_date,
        submitted_by=user.id,
        record_count=len(payload.records),
    )
    db.add(session)
    try:
        db.flush()
        db.add_all([
            AttendanceRecord(
                session_id=session.id,
                student_id=r.student_id,
                attendance_date=attendance_date,
                status=r.status,
                marked_by=user.id,
            )
            for r in payload.records
        ])
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise AttendanceAlreadySubmitted() from e

    db.refresh(session)
    return session