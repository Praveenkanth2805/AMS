from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,              # keep a few warm connections
    max_overflow=2,
    pool_recycle=1800,        # recycle stale conns every 30 min
    pool_timeout=30,
    future=True,
    connect_args={
        # psycopg v3: faster connect (no server-side cursor prep)
        "connect_timeout": 10,
        "prepare_threshold": 5,
        # Uncomment if using transaction pooler (port 6543):
        # "prepare_threshold": None,
    },
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False,
                            expire_on_commit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()