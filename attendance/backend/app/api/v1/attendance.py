from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user
from app.core.errors import NotFound
from app.db.session import get_db
from app.models.attendance import AttendanceSession
from app.models.student import Student
from app.models.user import User
from app.schemas.attendance import (AttendanceSessionOut, AttendanceSubmit,
                                    AttendanceTodayResponse)
from app.services.academic_year import today_institution_tz
from app.services.attendance import submit_attendance

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.get("/today", response_model=AttendanceTodayResponse)
def today(class_id: UUID = Query(...), academic_year_id: UUID = Query(...),
          db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    d = today_institution_tz()
    session = db.scalar(
        select(AttendanceSession)
        .options(selectinload(AttendanceSession.records))
        .where(AttendanceSession.class_id == class_id,
               AttendanceSession.attendance_date == d)
    )
    students = db.scalars(
        select(Student).where(Student.class_id == class_id,
                              Student.academic_year_id == academic_year_id,
                              Student.is_active.is_(True))
        .order_by(Student.roll_no)
    ).all()
    return AttendanceTodayResponse(
        submitted=session is not None,
        session=AttendanceSessionOut.model_validate(session) if session else None,
        students=[{"id": str(s.id), "name": s.name, "roll_no": s.roll_no}
                  for s in students],
    )


@router.get("/sessions", response_model=list[AttendanceSessionOut])
def list_sessions(class_id: UUID | None = None,
                  db: Session = Depends(get_db),
                  _: User = Depends(get_current_user)):
    stmt = select(AttendanceSession).options(selectinload(AttendanceSession.records))
    if class_id:
        stmt = stmt.where(AttendanceSession.class_id == class_id)
    return list(db.scalars(stmt.order_by(AttendanceSession.attendance_date.desc())))


@router.get("/sessions/{session_id}", response_model=AttendanceSessionOut)
def get_session(session_id: UUID, db: Session = Depends(get_db),
                _: User = Depends(get_current_user)):
    s = db.scalar(
        select(AttendanceSession)
        .options(selectinload(AttendanceSession.records))
        .where(AttendanceSession.id == session_id)
    )
    if not s:
        raise NotFound("session not found")
    return s


@router.post("/sessions", response_model=AttendanceSessionOut, status_code=201)
def create_session(body: AttendanceSubmit, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    session = submit_attendance(db, body, user)
    return db.scalar(
        select(AttendanceSession)
        .options(selectinload(AttendanceSession.records))
        .where(AttendanceSession.id == session.id)
    )