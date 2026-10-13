from uuid import UUID
from pydantic import BaseModel, Field, field_validator


# ---------- Department ----------

class DepartmentBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=32)
    is_active: bool = True

    @field_validator("name", "code")
    @classmethod
    def _trim_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    is_active: bool | None = None


class DepartmentOut(DepartmentBase):
    id: UUID

    class Config:
        from_attributes = True


# ---------- Class ----------

class ClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    section: str | None = Field(default=None, max_length=32)
    department_id: UUID
    academic_year_id: UUID

    @field_validator("name")
    @classmethod
    def _trim_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("section")
    @classmethod
    def _trim_section(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class ClassUpdate(BaseModel):
    name: str | None = None
    section: str | None = None
    is_active: bool | None = None


class ClassOut(BaseModel):
    id: UUID
    name: str
    section: str | None
    department_id: UUID
    academic_year_id: UUID
    is_active: bool

    class Config:
        from_attributes = True