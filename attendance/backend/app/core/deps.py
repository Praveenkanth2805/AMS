from uuid import UUID
from dataclasses import dataclass
from fastapi import Cookie, Depends, Header, Request
from sqlalchemy.orm import Session

from app.core.errors import Forbidden, Unauthenticated
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User


@dataclass
class AuthUser:
    """Lightweight user identity — no DB hit per request."""
    id: UUID
    role: str
    email: str
    name: str


def _token_from_request(request: Request, cookie_token: str | None,
                        auth_header: str | None) -> str | None:
    if cookie_token:
        return cookie_token
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1]
    return None


def get_current_user(
    request: Request,
    access_token: str | None = Cookie(default=None, alias="access_token"),
    authorization: str | None = Header(default=None),
) -> AuthUser:
    token = _token_from_request(request, access_token, authorization)
    if not token:
        raise Unauthenticated()
    try:
        claims = decode_token(token)
    except ValueError:
        raise Unauthenticated()
    if claims.get("typ") != "access":
        raise Unauthenticated()

    return AuthUser(
        id=UUID(claims["sub"]),
        role=claims.get("role", "teacher"),
        email=claims.get("email", ""),
        name=claims.get("name", ""),
    )


def require_admin(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if user.role != "admin":
        raise Forbidden("admin role required")
    return user