from typing import Any
from fastapi import Request, status
from fastapi.responses import JSONResponse


class AppError(Exception):
    code = "INTERNAL_ERROR"
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    message = "Something went wrong."

    def __init__(self, message: str | None = None, details: Any = None):
        self.message = message or self.message
        self.details = details
        super().__init__(self.message)


class ValidationError(AppError):
    code, status_code, message = "VALIDATION_ERROR", 422, "Invalid request data."


class Unauthenticated(AppError):
    code, status_code, message = "UNAUTHENTICATED", 401, "Authentication required."


class Forbidden(AppError):
    code, status_code, message = "FORBIDDEN", 403, "You do not have access."


class NotFound(AppError):
    code, status_code, message = "NOT_FOUND", 404, "Resource not found."


class DuplicateStudent(AppError):
    code, status_code, message = "DUPLICATE_STUDENT", 409, "Student already exists in scope."


class AttendanceAlreadySubmitted(AppError):
    code, status_code, message = "ATTENDANCE_ALREADY_SUBMITTED", 409, \
        "Attendance for this class and date has already been submitted."


class RateLimited(AppError):
    code, status_code, message = "RATE_LIMITED", 429, "Too many requests. Try again later."


class DatabaseError(AppError):
    code, status_code, message = "DATABASE_ERROR", 500, "Database operation failed."


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message,
                           "details": exc.details}},
    )


import logging
_log = logging.getLogger("errors")


async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    _log.exception(
        "Unhandled error on %s %s",
        request.method, request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR",
                           "message": "Unexpected server error."}},
    )