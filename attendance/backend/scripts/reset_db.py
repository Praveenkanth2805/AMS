"""Reset the application schema. Supabase-safe (does NOT drop public schema).

Drops only our tables + enums in FK-safe order, recreating the schema is
handled by the app bootstrap on next startup.

Usage:
    python -m scripts.reset_db
    python -m scripts.reset_db --yes      # no prompt
"""
import argparse
import logging
import sys
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import engine, Base

import app.models  # noqa: F401 — register tables

settings = get_settings()

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("reset_db")


# Order matters: children before parents (FK-safe even without CASCADE).
DROP_ORDER = [
    "attendance_records",
    "attendance_sessions",
    "students",
    "classes",
    "departments",
    "academic_years",
    "users",
]

ENUMS_TO_DROP = ["attendance_status", "user_role"]


def _redact(dsn: str) -> str:
    """Hide password when echoing the URL."""
    if "@" not in dsn:
        return dsn
    head, tail = dsn.split("@", 1)
    if ":" in head:
        scheme_user = head.rsplit(":", 1)[0]
        return f"{scheme_user}:***@{tail}"
    return dsn


def _drop_tables() -> None:
    log.info("Dropping application tables...")
    with engine.begin() as conn:
        for table in DROP_ORDER:
            sql = f'DROP TABLE IF EXISTS "{table}" CASCADE'
            log.info("  %s", sql)
            conn.execute(text(sql))

        # Drop enums only if unused (Supabase may have shared ones — usually not)
        for enum in ENUMS_TO_DROP:
            try:
                log.info('  DROP TYPE IF EXISTS "%s"', enum)
                conn.execute(text(f'DROP TYPE IF EXISTS "{enum}"'))
            except Exception as e:
                log.warning("  Could not drop type %s: %s", enum, e)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--yes", "-y", action="store_true",
                   help="Skip interactive confirmation.")
    args = p.parse_args()

    log.info("APP_ENV      : %s", settings.APP_ENV)
    log.info("DATABASE_URL : %s", _redact(settings.DATABASE_URL))
    log.info("Tables to drop: %s", ", ".join(DROP_ORDER))

    if settings.APP_ENV == "prod":
        print("Refusing to reset with APP_ENV=prod.", file=sys.stderr)
        return 1

    if not args.yes:
        answer = input("This will DROP all app tables. Type 'yes' to continue: ")
        if answer.strip().lower() != "yes":
            print("Aborted.")
            return 1

    try:
        _drop_tables()
    except Exception as e:
        log.exception("Reset failed: %s", e)
        return 1

    log.info("Done. Restart the server to recreate tables.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())