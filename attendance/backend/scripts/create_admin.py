"""Manage admin/teacher users.

Usage:
    # Create new user
    python -m scripts.create_admin --email a@b.com --name "A" --role admin

    # Update password of existing user
    python -m scripts.create_admin --email a@b.com --name "A" \
        --password 'NewPass123!' --update-password

    # List users
    python -m scripts.create_admin --list
"""
import argparse
import getpass
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User


def _get_password(cli_pw: str | None) -> str:
    pw = cli_pw or getpass.getpass("Password: ")
    if len(pw) < 8:
        print("Password must be at least 8 characters.", file=sys.stderr)
        sys.exit(2)
    return pw


def _list_users() -> None:
    with SessionLocal() as db:
        rows = db.scalars(select(User).order_by(User.email)).all()
        if not rows:
            print("No users yet.")
            return
        print(f"{'email':<40} {'name':<25} {'role':<10} active")
        print("-" * 90)
        for u in rows:
            print(f"{u.email:<40} {u.name:<25} {u.role:<10} {u.is_active}")
    sys.exit(0)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--email")
    p.add_argument("--name")
    p.add_argument("--password", default=None)
    p.add_argument("--role", default="admin", choices=["admin", "teacher"])
    p.add_argument("--update-password", action="store_true")
    p.add_argument("--reset-role", action="store_true")
    p.add_argument("--list", action="store_true")
    args = p.parse_args()

    if args.list:
        _list_users()

    if not args.email or not args.name:
        p.error("--email and --name are required (or use --list)")

    email = args.email.strip().lower()

    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == email))

        if existing:
            if not (args.update_password or args.reset_role):
                print(f"User {email} already exists.")
                print("  → To change password: add --update-password")
                print("  → To change role:     add --reset-role")
                return 0
            if args.update_password:
                existing.password_hash = hash_password(_get_password(args.password))
                print(f"Updated password for {email}")
            if args.reset_role:
                existing.role = args.role
                print(f"Updated role for {email} → {args.role}")
            db.commit()
            return 0

        db.add(User(
            name=args.name.strip(),
            email=email,
            password_hash=hash_password(_get_password(args.password)),
            role=args.role,
            is_active=True,
        ))
        db.commit()
        print(f"Created {args.role} {email}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())