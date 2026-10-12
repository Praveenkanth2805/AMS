from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.academic import AcademicYear, Class, Department

router = APIRouter(tags=["academic"])


@router.get("/academic-years")
def list_academic_years(db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = db.scalars(select(AcademicYear).order_by(AcademicYear.start_date.desc()))
    return [{"id": str(r.id), "name": r.name, "is_active": r.is_active} for r in rows]


@router.get("/departments")
def list_departments(db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = db.scalars(select(Department).where(Department.is_active.is_(True))
                      .order_by(Department.name))
    return [{"id": str(r.id), "name": r.name, "code": r.code} for r in rows]


@router.get("/classes")
def list_classes(academic_year_id: UUID = Query(...),
                 department_id: UUID = Query(...),
                 db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = db.scalars(select(Class).where(
        Class.academic_year_id == academic_year_id,
        Class.department_id == department_id,
        Class.is_active.is_(True),
    ).order_by(Class.name))
    return [{"id": str(r.id), "name": r.name, "section": r.section} for r in rows]