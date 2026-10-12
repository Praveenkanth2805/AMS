from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.academic import AcademicYear

settings = get_settings()


def today_institution_tz() -> date:
    return datetime.now(ZoneInfo(settings.INSTITUTIONAL_TIMEZONE)).date()


def academic_year_label(d: date, start_month: int) -> str:
    start_year = d.year if d.month >= start_month else d.year - 1
    return f"{start_year}\u2013{start_year + 1}"


def get_default_academic_year(db: Session) -> AcademicYear | None:
    label = academic_year_label(today_institution_tz(),
                                settings.ACADEMIC_YEAR_START_MONTH)
    return db.scalar(select(AcademicYear).where(AcademicYear.name == label))