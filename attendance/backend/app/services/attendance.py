from collections import defaultdict
from datetime import date as date_type

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import (AttendanceAlreadySubmitted, Forbidden, NotFound,
                             ValidationError)
from app.models.academic import Class
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.student import Student
from app.models.user import User
from app.schemas.attendance import AttendanceSubmit
from app.services.academic_year import today_institution_tz
from app.services.attendance_rules import compute_day_status


def _to_record(student_id, attendance_date: date_type,
               periods: list[bool], session_id, marked_by):
    return AttendanceRecord(
        session_id=session_id,
        student_id=student_id,
        attendance_date=attendance_date,
        status=compute_day_status(periods),
        periods=periods,
        marked_by=marked_by,
    )


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
        raise ValidationError("submission incomplete",
                              details={"missing_student_ids": [str(i) for i in missing]})
    if extras:
        raise ValidationError("records include students outside the selected class",
                              details={"unknown_student_ids": [str(i) for i in extras]})

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
            _to_record(r.student_id, attendance_date, r.periods, session.id, user.id)
            for r in payload.records
        ])
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise AttendanceAlreadySubmitted() from e

    db.refresh(session)
    return session


def update_session_records(db: Session, session_id, records, user: User):
    settings = get_settings()
    if not settings.ALLOW_ATTENDANCE_EDIT:
        raise Forbidden("attendance editing is disabled")

    session = db.get(AttendanceSession, session_id)
    if not session:
        raise NotFound("session not found")

    active = {
        s.id for s in db.scalars(
            select(Student).where(
                Student.class_id == session.class_id,
                Student.academic_year_id == session.academic_year_id,
                Student.is_active.is_(True),
            )
        )
    }
    incoming = {r.student_id for r in records}
    if incoming != active:
        missing = active - incoming
        extra = incoming - active
        raise ValidationError("records must match the active roster exactly",
                              details={
                                  "missing_student_ids": [str(i) for i in missing],
                                  "unknown_student_ids": [str(i) for i in extra],
                              })

    db.execute(delete(AttendanceRecord).where(
        AttendanceRecord.session_id == session.id
    ))
    db.flush()

    db.add_all([
        _to_record(r.student_id, session.attendance_date, r.periods,
                   session.id, user.id)
        for r in records
    ])
    session.record_count = len(records)
    db.commit()
    db.refresh(session)
    return session


def bulk_import_attendance(db: Session, payload, user: User) -> dict:
    """Bulk import: all students marked present in all periods on each date."""
    from app.services.attendance_rules import PERIODS_PER_DAY
    klass = db.get(Class, payload.class_id)
    if not klass or klass.academic_year_id != payload.academic_year_id:
        raise ValidationError("class does not belong to academic year")

    students = list(db.scalars(
        select(Student).where(
            Student.class_id == payload.class_id,
            Student.academic_year_id == payload.academic_year_id,
            Student.is_active.is_(True),
        )
    ))
    if not students:
        raise ValidationError("no active students in the selected class")

    student_names_lower = {s.name.strip().lower() for s in students}
    unknown_names: set[str] = set()
    for r in payload.rows:
        if r.name:
            n = r.name.strip()
            if n and n.lower() not in student_names_lower:
                unknown_names.add(n)

    unique_dates: set[date_type] = {r.date for r in payload.rows}
    existing_dates = {
        d for (d,) in db.execute(
            select(AttendanceSession.attendance_date).where(
                AttendanceSession.class_id == payload.class_id,
                AttendanceSession.attendance_date.in_(unique_dates),
            )
        )
    }

    created: list[str] = []
    skipped: list[str] = []
    present_periods = [True] * PERIODS_PER_DAY

    for d in sorted(unique_dates):
        if d in existing_dates:
            skipped.append(d.isoformat())
            continue
        session = AttendanceSession(
            class_id=payload.class_id,
            academic_year_id=payload.academic_year_id,
            attendance_date=d,
            submitted_by=user.id,
            record_count=len(students),
        )
        db.add(session)
        try:
            db.flush()
            db.add_all([
                _to_record(s.id, d, present_periods, session.id, user.id)
                for s in students
            ])
            db.commit()
            created.append(d.isoformat())
        except IntegrityError:
            db.rollback()
            skipped.append(d.isoformat())

    return {
        "sessions_created": len(created),
        "dates_created": created,
        "dates_skipped": skipped,
        "students_per_session": len(students),
        "unknown_names": sorted(unknown_names),
    }