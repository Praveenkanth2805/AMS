from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.errors import DuplicateStudent, NotFound, ValidationError
from app.db.session import get_db
from app.models.academic import Class
from app.models.student import Student
from app.models.user import User
from app.schemas.common import Page
from app.schemas.student import StudentCreate, StudentOut, StudentUpdate

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
                   user: User = Depends(get_current_user)):
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
                   _: User = Depends(get_current_user)):
    s = db.get(Student, student_id)
    if not s:
        raise NotFound("student not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{student_id}", status_code=204)
def deactivate_student(student_id: UUID, db: Session = Depends(get_db),
                       _: User = Depends(get_current_user)):
    s = db.get(Student, student_id)
    if not s:
        raise NotFound("student not found")
    s.is_active = False
    db.commit()

from app.schemas.student import (StudentCreate, StudentImportRequest,
                                 StudentImportResult, StudentOut, StudentUpdate)


@router.post("/import", response_model=StudentImportResult, status_code=201)
def import_students(body: StudentImportRequest,
                    db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    """Bulk create. Validates class relationship. Auto-generates roll_no
    if missing (sequential within the class)."""
    _assert_relationship(db, body.class_id, body.department_id,
                         body.academic_year_id)

    # Find current max numeric roll_no suffix (for auto-generation)
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
        except IntegrityError as e:
            db.rollback()
            failed.append({
                "index": idx, "name": row.name, "roll_no": roll,
                "reason": "duplicate or constraint violation",
            })
            # Restart transaction for subsequent rows
            db.begin()

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return StudentImportResult(created=0, failed=[{"index": -1,
            "name": "*", "roll_no": "*", "reason": "batch commit failed"}])

    return StudentImportResult(created=created, failed=failed)