from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class StudentBase(BaseModel):
    roll_no: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    register_no: str | None = Field(default=None, max_length=64)
    emis: str | None = Field(default=None, max_length=64)
    umis: str | None = Field(default=None, max_length=64)
    mobile: str | None = Field(default=None, max_length=20)
    department_id: UUID
    class_id: UUID
    academic_year_id: UUID

    @field_validator("roll_no", "name")
    @classmethod
    def _trim_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("emis", "umis", "register_no", "mobile")
    @classmethod
    def _trim_optional(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    roll_no: str | None = None
    name: str | None = None
    register_no: str | None = None
    emis: str | None = None
    umis: str | None = None
    mobile: str | None = None
    is_active: bool | None = None

    @field_validator("roll_no", "name")
    @classmethod
    def _trim_not_blank_opt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class StudentOut(StudentBase):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------- Bulk import ----------

class StudentImportRow(BaseModel):
    roll_no: str | None = None
    name: str = Field(min_length=1, max_length=200)
    register_no: str | None = None
    emis: str | None = None
    umis: str | None = None
    mobile: str | None = None

    @field_validator("name")
    @classmethod
    def _trim_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v


class StudentImportRequest(BaseModel):
    academic_year_id: UUID
    department_id: UUID
    class_id: UUID
    rows: list[StudentImportRow] = Field(min_length=1, max_length=2000)


class StudentImportResult(BaseModel):
    created: int
    failed: list[dict]