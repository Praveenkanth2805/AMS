from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(prefix="/config", tags=["config"])


@router.get("")
def public_config():
    """Frontend-readable flags. No secrets."""
    s = get_settings()
    return {
        "allow_attendance_edit": s.ALLOW_ATTENDANCE_EDIT,
        "academic_year_start_month": s.ACADEMIC_YEAR_START_MONTH,
        "institutional_timezone": s.INSTITUTIONAL_TIMEZONE,
    }