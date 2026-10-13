from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_admin
from app.core.errors import NotFound, ValidationError
from app.db.session import get_db
from app.models.academic import AcademicYear, Class, Department
from app.models.user import User
from app.schemas.academic import (ClassCreate, ClassOut, ClassUpdate,
                                  DepartmentCreate, DepartmentOut,
                                  DepartmentUpdate)

router = APIRouter(tags=["academic"])


# ================= Academic Years =================

@router.get("/academic-years")
def list_academic_years(db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = db.scalars(select(AcademicYear).order_by(AcademicYear.start_date.desc()))
    return [{"id": str(r.id), "name": r.name, "is_active": r.is_active} for r in rows]


# ================= Departments =================

@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(include_inactive: bool = False,
                     db: Session = Depends(get_db),
                     _: User = Depends(get_current_user)):
    stmt = select(Department).order_by(Department.name)
    if not include_inactive:
        stmt = stmt.where(Department.is_active.is_(True))
    return list(db.scalars(stmt))


@router.post("/departments", response_model=DepartmentOut, status_code=201)
def create_department(body: DepartmentCreate,
                      db: Session = Depends(get_db),
                      _: User = Depends(require_admin)):
    dept = Department(**body.model_dump())
    db.add(dept)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise ValidationError("department code already exists") from e
    db.refresh(dept)
    return dept


@router.patch("/departments/{dept_id}", response_model=DepartmentOut)
def update_department(dept_id: UUID, body: DepartmentUpdate,
                      db: Session = Depends(get_db),
                      _: User = Depends(require_admin)):
    d = db.get(Department, dept_id)
    if not d:
        raise NotFound("department not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(d, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise ValidationError("department code already exists") from e
    db.refresh(d)
    return d


@router.delete("/departments/{dept_id}", status_code=204)
def deactivate_department(dept_id: UUID,
                          db: Session = Depends(get_db),
                          _: User = Depends(require_admin)):
    d = db.get(Department, dept_id)
    if not d:
        raise NotFound("department not found")
    d.is_active = False
    db.commit()


# ================= Classes =================

@router.get("/classes", response_model=list[ClassOut])
def list_classes(
    academic_year_id: UUID | None = Query(None),
    department_id: UUID | None = Query(None),
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Class).order_by(Class.name, Class.section)
    if academic_year_id:
        stmt = stmt.where(Class.academic_year_id == academic_year_id)
    if department_id:
        stmt = stmt.where(Class.department_id == department_id)
    if not include_inactive:
        stmt = stmt.where(Class.is_active.is_(True))
    return list(db.scalars(stmt))


@router.post("/classes", response_model=ClassOut, status_code=201)
def create_class(body: ClassCreate,
                 db: Session = Depends(get_db),
                 _: User = Depends(require_admin)):
    dept = db.get(Department, body.department_id)
    if not dept:
        raise ValidationError("department not found")
    ay = db.get(AcademicYear, body.academic_year_id)
    if not ay:
        raise ValidationError("academic year not found")

    klass = Class(**body.model_dump())
    db.add(klass)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise ValidationError(
            "class already exists in this department and academic year"
        ) from e
    db.refresh(klass)
    return klass


@router.patch("/classes/{class_id}", response_model=ClassOut)
def update_class(class_id: UUID, body: ClassUpdate,
                 db: Session = Depends(get_db),
                 _: User = Depends(require_admin)):
    c = db.get(Class, class_id)
    if not c:
        raise NotFound("class not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise ValidationError("class already exists") from e
    db.refresh(c)
    return c


@router.delete("/classes/{class_id}", status_code=204)
def deactivate_class(class_id: UUID,
                     db: Session = Depends(get_db),
                     _: User = Depends(require_admin)):
    c = db.get(Class, class_id)
    if not c:
        raise NotFound("class not found")
    c.is_active = False
    db.commit()