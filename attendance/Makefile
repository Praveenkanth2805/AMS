.PHONY: dev down migrate seed admin test lint fmt

dev:
	docker compose up --build

down:
	docker compose down -v

migrate:
	cd backend && alembic upgrade head

seed:
	cd backend && python -m scripts.seed_dev

admin:
	cd backend && python -m scripts.create_admin --email admin@example.com \
		--name Admin --role admin

test:
	cd backend && pytest -q
	cd frontend && npm run typecheck

lint:
	cd backend && ruff check .
	cd frontend && npm run lint

fmt:
	cd backend && ruff format .