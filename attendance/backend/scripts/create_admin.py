"""Bootstrap an admin user. Idempotent.

Usage:
    python -m scripts.create_admin --email admin@example.com --name "Admin" \
        --password 'StrongPass123!'
"""
import argparse
import getpass
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--email", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--password", default=None)
    p.add_argument("--role", default="admin", choices=["admin", "teacher"])
    args = p.parse_args()

    password = args.password or getpass.getpass("Password: ")
    if len(password) < 8:
        print("Password must be at least 8 characters.", file=sys.stderr)
        return 2

    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == args.email.lower()))
        if existing:
            print(f"User {args.email} already exists.")
            return 0
        db.add(User(
            name=args.name.strip(),
            email=args.email.lower().strip(),
            password_hash=hash_password(password),
            role=args.role,
            is_active=True,
        ))
        db.commit()
        print(f"Created {args.role} {args.email}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())