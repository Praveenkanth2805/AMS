"""Startup bootstrap: create tables, add missing columns, seed defaults.

Runs on FastAPI startup. Idempotent — safe to run on every restart.
Not a replacement for a real migration pipeline in high-scale production,
but the same ergonomics as `create_all` + a light schema-diff.
"""
from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import inspect, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine

# Import models so they register with Base.metadata
import app.models  # noqa: F401
from app.models.academic import AcademicYear
from app.models.user import User
from app.services.academic_year import academic_year_label, today_institution_tz

log = logging.getLogger("bootstrap")
settings = get_settings()


# ---------- schema sync --------------------------------------------------

def _column_ddl(col) -> str:
    """Build an ADD COLUMN fragment from a SQLAlchemy Column."""
    try:
        col_type = col.type.compile(dialect=postgresql.dialect())
    except Exception:
        col_type = "TEXT"

    # Always add as nullable — existing rows can't satisfy NOT NULL.
    # The app layer still enforces NOT NULL on inserts.
    default_sql = ""
    if col.default is not None:
        arg = getattr(col.default, "arg", None)
        if isinstance(arg, str):
            default_sql = f" DEFAULT '{arg}'"
        elif isinstance(arg, bool):
            default_sql = f" DEFAULT {'true' if arg else 'false'}"
        elif isinstance(arg, (int, float)):
            default_sql = f" DEFAULT {arg}"

    return f'ADD COLUMN IF NOT EXISTS "{col.name}" {col_type}{default_sql}'


def _sync_missing_columns(eng: Engine) -> None:
    """Add any columns present in models but missing in the DB."""
    inspector = inspect(eng)
    existing_tables = set(inspector.get_table_names())

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue

        db_cols = {c["name"] for c in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name in db_cols:
                continue
            ddl = _column_ddl(col)
            sql = f'ALTER TABLE "{table.name}" {ddl}'
            log.warning("auto-migrate: %s", sql)
            with eng.begin() as conn:
                conn.execute(text(sql))


def ensure_schema() -> None:
    """Create all tables and add any missing columns."""
    if not settings.AUTO_CREATE_TABLES:
        log.info("AUTO_CREATE_TABLES=false — skipping schema sync")
        return

    log.info("Creating tables (if missing)...")
    Base.metadata.create_all(bind=engine)

    log.info("Syncing missing columns...")
    _sync_missing_columns(engine)


# ---------- data seeding -------------------------------------------------

def _seed_admin(db: Session) -> None:
    email = settings.BOOTSTRAP_ADMIN_EMAIL.strip().lower()
    if not email:
        return
    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        return

    if len(settings.BOOTSTRAP_ADMIN_PASSWORD) < 8:
        log.warning("BOOTSTRAP_ADMIN_PASSWORD too short — skipping admin seed")
        return

    db.add(User(
        name=settings.BOOTSTRAP_ADMIN_NAME.strip() or "Administrator",
        email=email,
        password_hash=hash_password(settings.BOOTSTRAP_ADMIN_PASSWORD),
        role="admin",
        is_active=True,
    ))
    db.commit()
    log.warning("Seeded bootstrap admin: %s", email)


def _seed_current_academic_year(db: Session) -> None:
    label = academic_year_label(today_institution_tz(),
                                settings.ACADEMIC_YEAR_START_MONTH)
    existing = db.scalar(select(AcademicYear).where(AcademicYear.name == label))
    if existing:
        return

    today = today_institution_tz()
    start_year = today.year if today.month >= settings.ACADEMIC_YEAR_START_MONTH \
        else today.year - 1
    db.add(AcademicYear(
        name=label,
        start_date=date(start_year, settings.ACADEMIC_YEAR_START_MONTH, 1),
        end_date=date(start_year + 1, settings.ACADEMIC_YEAR_START_MONTH, 1),
        is_active=True,
    ))
    db.commit()
    log.warning("Seeded academic year: %s", label)


def seed_defaults() -> None:
    if not settings.AUTO_SEED_DEFAULTS:
        log.info("AUTO_SEED_DEFAULTS=false — skipping seeding")
        return

    with SessionLocal() as db:
        try:
            _seed_admin(db)
            _seed_current_academic_year(db)
        except Exception as e:
            db.rollback()
            log.exception("Seeding failed: %s", e)


# ---------- public entrypoint -------------------------------------------

def bootstrap_database() -> None:
    """Called from FastAPI lifespan. Full startup sequence."""
    log.info("=== Bootstrap start (env=%s) ===", settings.APP_ENV)
    ensure_schema()
    seed_defaults()
    log.info("=== Bootstrap complete ===")