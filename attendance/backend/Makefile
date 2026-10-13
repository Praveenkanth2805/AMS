.PHONY: install run dev seed admin clean

install:
	pip install -r requirements.txt

run:
	uvicorn app.main:app --host 0.0.0.0 --port 8000

dev:
	uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

seed:
	python -m scripts.seed_dev

admin:
	python -m scripts.create_admin \
		--email admin@example.com \
		--name Administrator \
		--role admin

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .ruff_cache -exec rm -rf {} +
	rm -rf *.egg-info build dist

reset:
	python -m scripts.reset_db