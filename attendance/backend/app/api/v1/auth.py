from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import AuthUser, get_current_user
from app.core.errors import NotFound, Unauthenticated
from app.core.rate_limit import rate_limit
from app.core.security import (create_access_token, create_refresh_token,
                               decode_token, verify_password)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _cookie_domain() -> str | None:
    d = (settings.COOKIE_DOMAIN or "").strip()
    return d or None


def _cookie_kwargs() -> dict:
    return dict(
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=_cookie_domain(),
        path="/",
    )


def _set_session_cookies(response: Response, access: str, refresh: str) -> None:
    kw = _cookie_kwargs()
    response.set_cookie("access_token", access,
                        max_age=settings.ACCESS_TOKEN_TTL_MIN * 60, **kw)
    response.set_cookie("refresh_token", refresh,
                        max_age=settings.REFRESH_TOKEN_TTL_DAYS * 86400, **kw)


@router.post("/login", response_model=UserOut)
@rate_limit(settings.RATE_LIMIT_LOGIN)
async def login(request: Request, response: Response,
                body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise Unauthenticated("Invalid credentials.")

    access = create_access_token(str(user.id), user.role, user.email, user.name)
    refresh = create_refresh_token(str(user.id))
    _set_session_cookies(response, access, refresh)
    return user


@router.post("/refresh", response_model=UserOut)
async def refresh(response: Response, db: Session = Depends(get_db),
                  refresh_token: str | None = None):
    if not refresh_token:
        raise Unauthenticated()
    try:
        claims = decode_token(refresh_token)
    except ValueError:
        raise Unauthenticated()
    if claims.get("typ") != "refresh":
        raise Unauthenticated()
    user = db.get(User, claims["sub"])
    if not user or not user.is_active:
        raise Unauthenticated()
    access = create_access_token(str(user.id), user.role, user.email, user.name)
    response.set_cookie("access_token", access,
                        max_age=settings.ACCESS_TOKEN_TTL_MIN * 60,
                        **_cookie_kwargs())
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    kw = _cookie_kwargs()
    response.delete_cookie("access_token", path="/", domain=kw["domain"])
    response.delete_cookie("refresh_token", path="/", domain=kw["domain"])


@router.get("/me", response_model=UserOut)
async def me(auth: AuthUser = Depends(get_current_user),
             db: Session = Depends(get_db)):
    """Always reads fresh user from DB — safe, called ~once per page load.
    Also picks up deactivations/role changes without waiting for token expiry."""
    user = db.get(User, auth.id)
    if not user or not user.is_active:
        raise Unauthenticated()
    return user