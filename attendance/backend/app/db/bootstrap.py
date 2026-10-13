"""Startup bootstrap. Fast path: only inspects once, reuses connection.

Runs on FastAPI startup. Idempotent.
Admin users are NOT auto-created — use `python -m scripts.create_admin`.
"""
from __future__ import annotations

import logging
import time
from datetime import date

from sqlalchemy import inspect, select, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import Base, SessionLocal, engine

import app.models  # noqa: F401
from app.models.academic import AcademicYear
from app.services.academic_year import academic_year_label, today_institution_tz

log = logging.getLogger("bootstrap")
settings = get_settings()


# ---------- reset (dev only) --------------------------------------------

def _reset_schema() -> None:
    log.warning("RESET_DB=true — dropping all tables and enums")
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(text(f'DROP TABLE IF EXISTS "{table.name}" CASCADE'))
        for enum_name in ("user_role", "attendance_status"):
            conn.execute(text(f'DROP TYPE IF EXISTS {enum_name} CASCADE'))
    log.warning("Schema reset complete.")


# ---------- schema sync (single inspection pass) -------------------------

def _sync_schema(eng: Engine) -> None:
    """Single-inspection schema sync: create missing tables, add missing columns.
    One pg_catalog round-trip per table, zero redundant inspections."""
    t0 = time.monotonic()

    # ONE inspector, ONE connection, reused for everything below
    with eng.connect() as conn:
        insp = inspect(conn)
        existing_tables = set(insp.get_table_names())
        log.info("schema: %d existing tables", len(existing_tables))

        created_tables: list[str] = []
        added_columns: list[str] = []

        for table in Base.metadata.sorted_tables:
            # --- Missing table → create it fresh ---
            if table.name not in existing_tables:
                table.create(bind=conn, checkfirst=False)
                created_tables.append(table.name)
                continue

            # --- Existing table → check for missing columns ---
            db_cols = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in db_cols:
                    continue
                ddl = _column_ddl(col)
                sql = f'ALTER TABLE "{table.name}" {ddl}'
                conn.execute(text(sql))
                added_columns.append(f"{table.name}.{col.name}")

        conn.commit()

    elapsed = (time.monotonic() - t0) * 1000
    if created_tables or added_columns:
        log.warning(
            "schema: created=%s added_columns=%s (%.0f ms)",
            created_tables or "none", added_columns or "none", elapsed,
        )
    else:
        log.info("schema: up-to-date (%.0f ms)", elapsed)


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


def _check_type_drift(eng: Engine) -> None:
    """Only runs if users table exists. Cheap: one get_columns call."""
    with eng.connect() as conn:
        insp = inspect(conn)
        if "users" not in set(insp.get_table_names()):
            return
        for col in insp.get_columns("users"):
            if col["name"] == "id":
                coltype = str(col["type"]).lower()
                if "uuid" not in coltype:
                    raise RuntimeError(
                        f"users.id type mismatch: found '{coltype}', expected UUID. "
                        "Set RESET_DB=true (dev) or drop the stale schema."
                    )


def ensure_schema() -> None:
    if settings.RESET_DB:
        _reset_schema()
        Base.metadata.create_all(bind=engine)
        return

    if not settings.AUTO_CREATE_TABLES:
        log.info("AUTO_CREATE_TABLES=false — skipping schema sync")
        return

    _check_type_drift(engine)
    _sync_schema(engine)


# ---------- seeding ------------------------------------------------------

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


def bootstrap_database() -> None:
    t0 = time.monotonic()
    log.info("=== Bootstrap start (env=%s, reset=%s) ===",
             settings.APP_ENV, settings.RESET_DB)
    ensure_schema()
    seed_defaults()

    try:
        from app.models.user import User
        with SessionLocal() as db:
            admin_exists = db.scalar(
                select(User).where(User.role == "admin", User.is_active.is_(True))
            )
        if not admin_exists:
            log.warning(
                "No active admin user. Create one with:\n"
                "    python -m scripts.create_admin "
                "--email you@example.com --name 'Your Name' --role admin"
            )
    except Exception:
        pass

    elapsed = (time.monotonic() - t0) * 1000
    log.info("=== Bootstrap complete (%.0f ms) ===", elapsed)