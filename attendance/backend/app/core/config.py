from functools import lru_cache
from typing import Literal
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_ENV: Literal["dev", "test", "prod"] = "dev"
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = Field(..., min_length=32)
    ACCESS_TOKEN_TTL_MIN: int = 30
    REFRESH_TOKEN_TTL_DAYS: int = 7

    DATABASE_URL: str
    REDIS_URL: str | None = None

    ACADEMIC_YEAR_START_MONTH: int = 6
    INSTITUTIONAL_TIMEZONE: str = "Asia/Kolkata"

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    COOKIE_DOMAIN: str | None = None
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"

    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_WRITE: str = "60/minute"

    AUTO_CREATE_TABLES: bool = True
    AUTO_SEED_DEFAULTS: bool = True

    BOOTSTRAP_ADMIN_EMAIL: str = "admin@example.com"
    BOOTSTRAP_ADMIN_PASSWORD: str = "ChangeMe123!"
    BOOTSTRAP_ADMIN_NAME: str = "Administrator"

    @field_validator("ACADEMIC_YEAR_START_MONTH")
    @classmethod
    def _month(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("ACADEMIC_YEAR_START_MONTH must be 1..12")
        return v

    @field_validator("SECRET_KEY")
    @classmethod
    def _reject_placeholder(cls, v: str) -> str:
        if "changeme" in v.lower() or "change-this" in v.lower():
            # allow in dev, but reject in prod
            import os
            if os.getenv("APP_ENV") == "prod":
                raise ValueError("SECRET_KEY must not be a placeholder in prod")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()