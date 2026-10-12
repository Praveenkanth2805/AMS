from functools import wraps
from fastapi import Request

from app.core.config import get_settings
from app.core.errors import RateLimited

settings = get_settings()

_redis = None
if settings.REDIS_URL:
    try:
        import redis.asyncio as aioredis
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    except Exception:
        _redis = None


def _client_key(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(spec: str):
    limit_str, window = spec.split("/")
    limit = int(limit_str)
    window_secs = {"second": 1, "minute": 60, "hour": 3600}[window]

    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            if _redis is None:
                return await fn(*args, **kwargs)
            request: Request | None = kwargs.get("request")
            if request is None:
                for a in args:
                    if isinstance(a, Request):
                        request = a
                        break
            if request is None:
                return await fn(*args, **kwargs)

            key = f"rl:{request.url.path}:{_client_key(request)}"
            async with _redis.pipeline(transaction=True) as pipe:
                pipe.incr(key)
                pipe.expire(key, window_secs, nx=True)
                count, _ = await pipe.execute()
            if int(count) > limit:
                raise RateLimited()
            return await fn(*args, **kwargs)
        return wrapper
    return decorator