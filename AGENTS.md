# AGENTS.md

## Developer Commands

### Tests & Quality Checks
- **Scoring (`scoring/`)**: `PYTHONPATH=. pytest`
  - *Gotcha:* Plain `pytest` fails with `ModuleNotFoundError: No module named 'app'`.
- **API (`api/`)**: `npm test`
  - Runs Jest with `--experimental-vm-modules` (requires `npm install` in `api/`).
- **Frontend (`frontend/`)**: `npm run lint` (`oxlint`) and `npm run build` (`tsc -b && vite build`)
  - Requires `npm install` in `frontend/`.
- **Terraform (`terraform/`)**: `terraform init -backend=false && terraform validate`

### Local Development & Deployment
- **Full Stack (Local)**: `docker compose up --build`
  - Frontend: `http://localhost:5173`
  - GraphQL API: `http://localhost:4000`
  - Scoring Service: `http://localhost:8000`
  - Postgres DB: `localhost:5432` (seeded automatically via `db/init.sql`)
- **AWS Deployment**: `make deploy` (`uv run scripts/deploy.py`)
- **Smoke Tests**: `make smoke-test` (`uv run scripts/smoke_test.py`)
- **AWS Infrastructure Teardown**: `make destroy` (`uv run scripts/destroy.py`)

## Architecture & Data Flow

- **`scoring/` (Python / FastAPI)**: Pure, side-effect-free scoring logic (`app/scoring.py`) wrapped in FastAPI (`app/main.py`). Calculates WCPM, accuracy %, and benchmark risk tiers.
- **`api/` (Node.js / Apollo GraphQL)**: GraphQL API (`src/index.js`). In-progress 60-second assessment error tags are held in memory (`src/sessionStore.js`). Calls `scoring/` via HTTP (`SCORING_SERVICE_URL`) on assessment submit, then persists completed records to Postgres.
- **`frontend/` (React 19 / TypeScript / Vite)**: Real-time tap-to-tag assessment UI and student progress chart.
- **`db/` (PostgreSQL 16)**: Stores passages, benchmark norms, students, and submitted assessments.

## Conventions & Gotchas

- **Node ES Modules**: `api/` uses `"type": "module"`. All relative imports in `api/src/` must include the `.js` extension (e.g., `import { typeDefs } from "./schema.js"`).
- **Ephemeral Sessions**: Active assessment session tags are stored in `api/src/sessionStore.js` (`Map`). They are not written to Postgres until `submitAssessment` completes, and are lost if the API restarts.
- **AWS RDS SSL Connection**: AWS RDS PostgreSQL mandates encrypted TLS connections. Node `pg` Pool (`api/src/db.js`) requires `ssl: { rejectUnauthorized: false }` when `DATABASE_URL` is set, and strips any `sslmode` URL parameters that would force certificate validation errors (`self-signed certificate in certificate chain` or `no encryption`).
- **Database Schema Auto-Initialization**: Fresh RDS Postgres instances start without tables. `api/src/db.js` invokes `initDb()` on startup, which checks for the `passage` table and automatically applies DDL schema and seed data if missing.
- **CloudFront API Proxy & Mixed Content Prevention**: Frontend requests to GraphQL API on CloudFront HTTPS (`https://<domain>/`) use relative path `/graphql` (`resolveApiUrl()` in `frontend/src/api/client.ts`). CloudFront distribution forwards `/graphql` to the ALB target group on port 4000/80 over HTTP, preventing browser mixed-content blocking.
- **Service Environment Fallbacks**:
  - `DATABASE_URL` -> `postgres://orf_user:orf_pass@localhost:5432/orf`
  - `SCORING_SERVICE_URL` -> `http://localhost:8000`
  - `VITE_API_URL` -> `http://localhost:4000`
- **Terraform Authentication Workaround**:
  - The Terraform AWS Provider does not natively support the AWS CLI v2.32.0+ `aws login` command for direct authentication. To use `aws login` with Terraform, you must use a workaround involving the `credential_process` configuration in the user's AWS CLI profile.  This acts as a bridge to export the console credentials as temporary credentials Terraform can read.
