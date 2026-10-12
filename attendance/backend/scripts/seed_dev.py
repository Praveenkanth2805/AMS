"""Seed a dev dataset: AY, department, class, 10 students.

Usage:
    python -m scripts.seed_dev
"""
from datetime import date

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.academic import AcademicYear, Class, Department
from app.models.student import Student
from app.services.academic_year import (academic_year_label,
                                        today_institution_tz)
from app.core.config import get_settings

settings = get_settings()


def main() -> None:
    with SessionLocal() as db:
        label = academic_year_label(today_institution_tz(),
                                    settings.ACADEMIC_YEAR_START_MONTH)
        ay = db.scalar(select(AcademicYear).where(AcademicYear.name == label))
        if not ay:
            today = today_institution_tz()
            start_year = (today.year
                          if today.month >= settings.ACADEMIC_YEAR_START_MONTH
                          else today.year - 1)
            ay = AcademicYear(
                name=label,
                start_date=date(start_year, settings.ACADEMIC_YEAR_START_MONTH, 1),
                end_date=date(start_year + 1, settings.ACADEMIC_YEAR_START_MONTH, 1),
                is_active=True,
            )
            db.add(ay)
            db.flush()
            print(f"Created academic year: {label}")
        else:
            print(f"Academic year exists: {label}")

        dept = db.scalar(select(Department).where(Department.code == "CS"))
        if not dept:
            dept = Department(name="Computer Science", code="CS", is_active=True)
            db.add(dept)
            db.flush()
            print("Created department: CS")
        else:
            print("Department exists: CS")

        klass = db.scalar(select(Class).where(
            Class.department_id == dept.id,
            Class.academic_year_id == ay.id,
            Class.name == "III Year",
            Class.section == "A",
        ))
        if not klass:
            klass = Class(
                name="III Year", section="A",
                department_id=dept.id, academic_year_id=ay.id,
                is_active=True,
            )
            db.add(klass)
            db.flush()
            print("Created class: III Year - A")
        else:
            print("Class exists: III Year - A")

        created = 0
        for i in range(1, 11):
            roll = f"CS{1000 + i}"
            exists = db.scalar(select(Student).where(
                Student.class_id == klass.id,
                Student.academic_year_id == ay.id,
                Student.roll_no == roll,
            ))
            if exists:
                continue
            db.add(Student(
                roll_no=roll,
                name=f"Student {i}",
                department_id=dept.id,
                class_id=klass.id,
                academic_year_id=ay.id,
                is_active=True,
            ))
            created += 1

        db.commit()
        print(f"Created {created} students.")
        print("Done.")


if __name__ == "__main__":
    main()