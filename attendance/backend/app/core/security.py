from datetime import datetime, timedelta, timezone
from typing import Any
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["argon2"], argon2__type="ID", deprecated="auto")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _encode(sub: str, ttl: timedelta, typ: str, **claims: Any) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": sub, "typ": typ, "iat": now, "exp": now + ttl, **claims}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(user_id: str, role: str) -> str:
    return _encode(user_id, timedelta(minutes=settings.ACCESS_TOKEN_TTL_MIN),
                   "access", role=role)


def create_refresh_token(user_id: str) -> str:
    return _encode(user_id, timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS), "refresh")


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as e:
        raise ValueError("invalid_token") from e