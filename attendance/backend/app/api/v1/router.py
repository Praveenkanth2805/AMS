from fastapi import APIRouter

from app.api.v1 import (academic, attendance, auth, config, dashboard, reports,
                        students)

api = APIRouter(prefix="/api/v1")
api.include_router(config.router)          # ← new
api.include_router(auth.router)
api.include_router(academic.router)
api.include_router(students.router)
api.include_router(attendance.router)
api.include_router(dashboard.router)
api.include_router(reports.router)