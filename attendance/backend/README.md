# Attendance API — Backend

FastAPI + SQLAlchemy + PostgreSQL. Auto-migrates on startup, no Alembic.

## Requirements
- Python 3.11+
- PostgreSQL 14+
- (optional) Redis for distributed rate limiting

## Quick start

```bash
cd backend

# 1. Install
pip install -r requirements.txt

# 2. Configure
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY and DATABASE_URL

# 3. Run (auto-creates tables, seeds admin + academic year)
uvicorn app.main:app --reload --port 8000