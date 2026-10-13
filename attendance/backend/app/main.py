import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api
from app.core.config import get_settings
from app.core.errors import AppError, app_error_handler, unhandled_handler
from app.core.timing import TimingMiddleware
from app.db.bootstrap import bootstrap_database

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger("app")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting up — running database bootstrap...")
    bootstrap_database()
    yield
    log.info("Shutting down.")


# 1. Create the app FIRST
app = FastAPI(title="Attendance API", version="1.0", lifespan=lifespan)

# 2. Then add middleware (CORS first, then timing so CORS preflight is fast)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TimingMiddleware)

# 3. Exception handlers
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_handler)

# 4. Routers
app.include_router(api)


@app.get("/healthz", tags=["ops"])
def healthz():
    return {"status": "ok"}