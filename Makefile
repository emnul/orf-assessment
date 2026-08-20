.PHONY: help local-up local-down test lint deploy smoke-test destroy

help:
	@echo "Available commands:"
	@echo "  make local-up    - Start full stack locally via Docker Compose"
	@echo "  make local-down  - Stop local Docker Compose environment"
	@echo "  make test        - Run unit tests for API and Scoring service"
	@echo "  make lint        - Run frontend linter and typecheck"
	@echo "  make deploy      - Deploy infrastructure & containers to AWS via Terraform"
	@echo "  make smoke-test  - Run end-to-end smoke tests against deployed environment"
	@echo "  make destroy     - Teardown all deployed AWS infrastructure"

local-up:
	docker compose up --build

local-down:
	docker compose down

test:
	cd scoring && PYTHONPATH=. pytest
	cd api && npm test

lint:
	cd frontend && npm run lint && npm run build
	cd terraform && terraform init -backend=false && terraform validate

deploy:
	uv run scripts/deploy.py

smoke-test:
	uv run scripts/smoke_test.py

destroy:
	uv run scripts/destroy.py
