"""Startup bootstrap: create tables, sync columns, seed defaults.

Runs on FastAPI startup. Idempotent — safe to run on every restart.

Admin users are NOT auto-created — use `python -m scripts.create_admin`.
Only the current academic year is auto-seeded (derived from date, no secrets).
"""
from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import inspect, select, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import Base, SessionLocal, engine

import app.models  # noqa: F401 — registers all tables
from app.models.academic import AcademicYear
from app.services.academic_year import academic_year_label, today_institution_tz

log = logging.getLogger("bootstrap")
settings = get_settings()


# ---------- reset (dev only) --------------------------------------------

def _reset_schema() -> None:
    """Drop every table + enum. Destructive. Only runs when RESET_DB=true."""
    log.warning("RESET_DB=true — dropping all tables and enums")
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(text(f'DROP TABLE IF EXISTS "{table.name}" CASCADE'))
        for enum_name in ("user_role", "attendance_status"):
            conn.execute(text(f'DROP TYPE IF EXISTS {enum_name} CASCADE'))
    log.warning("Schema reset complete.")


# ---------- pre-flight type check ---------------------------------------

def _check_type_drift() -> None:
    """Detect INTEGER vs UUID drift on shared PK columns (users.id, etc.)."""
    insp = inspect(engine)
    existing = set(insp.get_table_names())
    if "users" not in existing:
        return

    for col in insp.get_columns("users"):
        if col["name"] == "id":
            coltype = str(col["type"]).lower()
            if "uuid" not in coltype:
                log.error(
                    "SCHEMA DRIFT: users.id is %s, expected UUID. "
                    "Drop the old table or run RESET_DB=true.",
                    coltype,
                )
                raise RuntimeError(
                    f"users.id type mismatch: found '{coltype}', expected UUID. "
                    "Set RESET_DB=true in .env (dev only) or drop the stale schema."
                )


# ---------- schema sync --------------------------------------------------

def _column_ddl(col) -> str:
    try:
        col_type = col.type.compile(dialect=postgresql.dialect())
    except Exception:
        col_type = "TEXT"

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
    if settings.RESET_DB:
        _reset_schema()
        Base.metadata.create_all(bind=engine)
        return

    if not settings.AUTO_CREATE_TABLES:
        log.info("AUTO_CREATE_TABLES=false — skipping schema sync")
        return

    _check_type_drift()
    log.info("Creating tables (if missing)...")
    Base.metadata.create_all(bind=engine)
    log.info("Syncing missing columns...")
    _sync_missing_columns(engine)


# ---------- seeding (academic year only) ---------------------------------

def _seed_current_academic_year(db: Session) -> None:
    label = academic_year_label(today_institution_tz(),
                                settings.ACADEMIC_YEAR_START_MONTH)
    if db.scalar(select(AcademicYear).where(AcademicYear.name == label)):
        return
    today = today_institution_tz()
    start_year = (today.year
                  if today.month >= settings.ACADEMIC_YEAR_START_MONTH
                  else today.year - 1)
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
            _seed_current_academic_year(db)
        except Exception as e:
            db.rollback()
            log.exception("Seeding failed: %s", e)


# ---------- entrypoint ---------------------------------------------------

def bootstrap_database() -> None:
    log.info("=== Bootstrap start (env=%s, reset=%s) ===",
             settings.APP_ENV, settings.RESET_DB)
    ensure_schema()
    seed_defaults()

    # Warn if no admin exists yet.
    try:
        from app.models.user import User
        with SessionLocal() as db:
            admin_exists = db.scalar(
                select(User).where(User.role == "admin", User.is_active.is_(True))
            )
        if not admin_exists:
            log.warning(
                "No active admin user found. Create one with:\n"
                "    python -m scripts.create_admin "
                "--email you@example.com --name 'Your Name' --role admin"
            )
    except Exception:
        # Table might not exist yet on very first boot before create_all
        pass

    log.info("=== Bootstrap complete ===")