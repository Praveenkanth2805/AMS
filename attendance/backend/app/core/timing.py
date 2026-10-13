"""Request-level timing. Logs slow requests."""
import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

log = logging.getLogger("timing")

SLOW_MS = 500  # log anything slower than this


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        t0 = time.monotonic()
        response = await call_next(request)
        elapsed = (time.monotonic() - t0) * 1000
        response.headers["X-Response-Time-Ms"] = f"{elapsed:.1f}"
        if elapsed > SLOW_MS:
            log.warning("SLOW %s %s -> %s (%.0f ms)",
                        request.method, request.url.path,
                        response.status_code, elapsed)
        else:
            log.info("%s %s -> %s (%.0f ms)",
                     request.method, request.url.path,
                     response.status_code, elapsed)
        return response