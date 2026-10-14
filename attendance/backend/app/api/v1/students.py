from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_admin
from app.core.errors import (DuplicateStudent, Forbidden, NotFound,
                             ValidationError)
from app.db.session import get_db
from app.models.academic import Class
from app.models.attendance import AttendanceRecord
from app.models.student import Student
from app.models.user import User
from app.schemas.common import Page
from app.schemas.student import (StudentCreate, StudentImportRequest,
                                 StudentImportResult, StudentOut, StudentUpdate)

router = APIRouter(prefix="/students", tags=["students"])


def _assert_relationship(db: Session, class_id: UUID, department_id: UUID,
                         academic_year_id: UUID) -> None:
    klass = db.get(Class, class_id)
    if not klass:
        raise ValidationError("class not found")
    if klass.department_id != department_id:
        raise ValidationError("class does not belong to department")
    if klass.academic_year_id != academic_year_id:
        raise ValidationError("class does not belong to academic year")


@router.get("", response_model=Page[StudentOut])
def list_students(
    q: str | None = None,
    class_id: UUID | None = None,
    department_id: UUID | None = None,
    academic_year_id: UUID | None = None,
    include_inactive: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Student)
    if not include_inactive:
        stmt = stmt.where(Student.is_active.is_(True))
    if class_id:
        stmt = stmt.where(Student.class_id == class_id)
    if department_id:
        stmt = stmt.where(Student.department_id == department_id)
    if academic_year_id:
        stmt = stmt.where(Student.academic_year_id == academic_year_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Student.name.ilike(like),
                              Student.roll_no.ilike(like),
                              Student.register_no.ilike(like)))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Student.roll_no)
                      .offset((page - 1) * page_size).limit(page_size)).all()
    return Page[StudentOut](items=rows, total=total, page=page, page_size=page_size)


@router.post("", response_model=StudentOut, status_code=201)
def create_student(body: StudentCreate, db: Session = Depends(get_db),
                   user: User = Depends(require_admin)):
    _assert_relationship(db, body.class_id, body.department_id, body.academic_year_id)
    student = Student(**body.model_dump())
    db.add(student)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise DuplicateStudent("roll number already exists in class") from e
    db.refresh(student)
    return student


@router.post("/import", response_model=StudentImportResult, status_code=201)
def import_students(body: StudentImportRequest,
                    db: Session = Depends(get_db),
                    user: User = Depends(require_admin)):
    _assert_relationship(db, body.class_id, body.department_id,
                         body.academic_year_id)

    def _parse_roll_suffix(rn: str) -> int | None:
        try:
            return int("".join(ch for ch in rn if ch.isdigit()) or "-1")
        except ValueError:
            return None

    existing = db.scalars(
        select(Student.roll_no).where(
            Student.class_id == body.class_id,
            Student.academic_year_id == body.academic_year_id,
        )
    ).all()
    used_rolls = set(existing)
    max_num = max((_parse_roll_suffix(r) or 0) for r in existing) if existing else 0

    created = 0
    failed: list[dict] = []

    for idx, row in enumerate(body.rows):
        roll = (row.roll_no or "").strip()
        if not roll:
            max_num += 1
            roll = str(max_num)

        if roll in used_rolls:
            failed.append({
                "index": idx, "name": row.name, "roll_no": roll,
                "reason": "duplicate roll number in this class",
            })
            continue

        try:
            student = Student(
                roll_no=roll,
                name=row.name,
                register_no=row.register_no,
                emis=row.emis,
                umis=row.umis,
                mobile=row.mobile,
                department_id=body.department_id,
                class_id=body.class_id,
                academic_year_id=body.academic_year_id,
                is_active=True,
            )
            db.add(student)
            db.flush()
            used_rolls.add(roll)
            created += 1
        except IntegrityError:
            db.rollback()
            failed.append({
                "index": idx, "name": row.name, "roll_no": roll,
                "reason": "duplicate or constraint violation",
            })
            db.begin()

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return StudentImportResult(created=0, failed=[{"index": -1,
            "name": "*", "roll_no": "*", "reason": "batch commit failed"}])

    return StudentImportResult(created=created, failed=failed)


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: UUID, db: Session = Depends(get_db),
                _: User = Depends(get_current_user)):
    s = db.get(Student, student_id)
    if not s:
        raise NotFound("student not found")
    return s


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(student_id: UUID, body: StudentUpdate,
                   db: Session = Depends(get_db),
                   _: User = Depends(require_admin)):
    s = db.get(Student, student_id)
    if not s:
        raise NotFound("student not found")

    data = body.model_dump(exclude_unset=True)
    # Handle roll_no conflict explicitly for a clean error
    if "roll_no" in data and data["roll_no"]:
        conflict = db.scalar(
            select(Student).where(
                Student.class_id == s.class_id,
                Student.academic_year_id == s.academic_year_id,
                Student.roll_no == data["roll_no"],
                Student.id != s.id,
            )
        )
        if conflict:
            raise DuplicateStudent("roll number already exists in class")

    for k, v in data.items():
        setattr(s, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise DuplicateStudent("roll number already exists in class") from e
    db.refresh(s)
    return s


@router.delete("/{student_id}", status_code=200)
def delete_student(
    student_id: UUID,
    hard: bool = Query(False, description="If true, permanently deletes the student AND their attendance records."),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Soft delete by default. Pass ?hard=true to permanently remove the
    student plus every attendance record referencing them.

    Hard delete is admin-only, and it also updates the parent session's
    record_count so historical totals stay consistent.
    """
    s = db.get(Student, student_id)
    if not s:
        raise NotFound("student not found")

    if not hard:
        s.is_active = False
        db.commit()
        return {"id": str(s.id), "mode": "deactivated",
                "attendance_records_removed": 0}

    # ---- Hard delete path ----
    # 1. Find affected sessions so we can decrement record_count
    affected_sessions = db.execute(
        select(AttendanceRecord.session_id, func.count())
        .where(AttendanceRecord.student_id == student_id)
        .group_by(AttendanceRecord.session_id)
    ).all()

    # 2. Delete attendance records for this student
    result = db.execute(
        delete(AttendanceRecord).where(AttendanceRecord.student_id == student_id)
    )
    removed = result.rowcount or 0

    # 3. Decrement record_count on each affected session.
    #    If a session drops to 0 records, delete the empty session too.
    from app.models.attendance import AttendanceSession
    for session_id, count in affected_sessions:
        session = db.get(AttendanceSession, session_id)
        if not session:
            continue
        session.record_count = max(0, session.record_count - count)
        if session.record_count == 0:
            db.delete(session)

    # 4. Delete the student itself
    db.delete(s)
    db.commit()

    return {
        "id": str(student_id),
        "mode": "hard_deleted",
        "attendance_records_removed": removed,
    }