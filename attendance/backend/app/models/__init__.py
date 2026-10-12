# app/models/__init__.py
from app.models.user import User
from app.models.academic import AcademicYear, Department, Class
from app.models.student import Student
from app.models.attendance import AttendanceSession, AttendanceRecord

__all__ = [
    "User", "AcademicYear", "Department", "Class",
    "Student", "AttendanceSession", "AttendanceRecord",
]