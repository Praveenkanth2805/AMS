#!/usr/bin/env bash
set -euo pipefail

# Convenience runner: ensures env exists, then starts uvicorn with reload.
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "→ .env not found, copying from .env.example"
  cp .env.example .env
  echo "→ Edit .env (SECRET_KEY, DATABASE_URL) then re-run."
  exit 1
fi

if [ ! -d .venv ]; then
  echo "→ Creating virtualenv"
  python3 -m venv .venv
  . .venv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt
else
  . .venv/bin/activate
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --reload