# Oral Reading Fluency Assessment (portfolio project)

A small full-stack app inspired by [Amplify Education](https://amplify.com)'s
**mCLASS** literacy assessment platform.

mCLASS is built on DIBELS-style **Oral Reading Fluency (ORF)** assessments:
a teacher listens to a student read a passage aloud for 60 seconds, tags
misread/skipped/hesitated words in real time, and the system scores it as
**Words Correct Per Minute (WCPM)** and accuracy, then compares that against
grade/season benchmark norms to flag a risk tier — feeding a
progress-monitoring view teachers use to plan instruction.

This project reimplements that core interaction end to end — original
passage, original but methodologically equivalent scoring engine, real
tap-to-tag UI — deliberately scoped to something buildable and deployable
in a day or two, not a reproduction of Amplify's actual (licensed) product.

## Stack

- **Frontend:** React + TypeScript (Vite), Recharts for the progress chart
- **API:** GraphQL via Apollo Server (Node)
- **Domain/scoring service:** Python (FastAPI) — a pure, unit-tested scoring
  module wrapped in a thin HTTP layer
- **Database:** PostgreSQL
- **Local dev:** Docker Compose
- **Cloud deploy:** AWS — ECS Fargate (API + scoring service), RDS Postgres,
  S3 + CloudFront (frontend), provisioned with Terraform
- **Testing:** pytest (scoring engine), Jest (API session logic)

**Architecture tradeoff**
This project uses ECS Fargate instead instead of Lambda Functions, since
a long-running GraphQL/scoring service maps more naturally onto containers
than a serverless function-per-request model. Lambda would be a better fit
for something more event-driven (e.g. an async re-scoring job).

## What's deliberately cut for scope

This is a single-teacher, single-student, single-passage vertical slice

Explicitly out of scope:

- Class rosters / multiple students / teacher login (one hardcoded teacher
  context)
- DynamoDB — in-progress assessment-tagging state lives in the API's memory
  until submit; a fuller build would move that to DynamoDB for durability
  across API instances
- Datadog — noted as a natural addition, not implemented
- Spanish-language parity, dyslexia risk screening, district/admin rollups,
  offline sync

## Running locally

```bash
docker compose up --build
```

- Frontend: <http://localhost:5173>
- GraphQL API: <http://localhost:4000>
- Scoring service: <http://localhost:8000/health>

The database is seeded on first boot with one student (Maya T., grade 3),
one word-indexed passage, a grade-3/spring benchmark norm, and three
historical assessments so the progress chart has something to show
immediately.

## Running tests

```bash
# Scoring engine (Python)
cd scoring && pip install -r requirements.txt && pytest

# API session logic (Node)
cd api && npm install && npm test
```

## Infrastructure Architecture & Security Decisions

- **ECS Fargate vs. Serverless Lambda**: ECS Fargate is selected over Lambda because long-running GraphQL and Python FastAPI services map naturally to persistent containers. Lambda would be better suited for async event-driven tasks (e.g. background batch re-scoring).
- **Network Isolation & Security Hardening**:
  - **RDS PostgreSQL**: Deployed in private subnets with no public IP. Ingress is restricted via Security Groups exclusively to port 5432 from ECS Tasks.
  - **IAM Principle of Least Privilege**: Task execution roles are explicitly scoped to required ECR image pulling and exact SSM parameter ARNs (`/orf-assessment/*`), avoiding wildcard permissions.
  - **SSM Parameter Store**: Connection strings and database passwords are injected dynamically at task startup via SSM Parameter Store `SecureString` parameters.
  - **CloudFront Origin Access Control (OAC)**: S3 bucket hosting static assets blocks public access and permits reads exclusively through CloudFront OAC.
- **Demo & Cost Optimization**:
  - Single-AZ RDS (`db.t4g.micro`) and a single NAT Gateway are used to avoid unnecessary cloud costs while demonstrating a complete production-like architecture.
- **Production-Scale Enhancements**:
  - **Resilience**: Multi-AZ RDS deployment and ECS task auto-scaling across AZs.
  - **Session Persistence**: Move in-progress assessment error tagging from API memory to AWS DynamoDB for multi-region or multi-instance durability.
  - **Protection & Monitoring**: Attach AWS WAF to CloudFront/ALB, and integrate Datadog or CloudWatch Alarms for error rate and latency tracing.

## AWS deployment

See `terraform/` for the infrastructure (VPC, RDS, ECS Fargate, ALB, ECR,
S3 + CloudFront). Deploy using the automated pipeline (managed via `uv`):

```bash
# Provision infrastructure, build/push containers, and upload static frontend
make deploy

# Run end-to-end smoke tests against live AWS endpoints
make smoke-test

# Cleanly tear down all resources
make destroy
```

Alternatively, run Terraform directly inside `terraform/`:

```bash
cd terraform
terraform init
terraform apply
```

Tear down with `make destroy` or `terraform destroy` — there is no standing "always-on" demo
environment; the stack is brought up for a demo and torn down afterward.

## Project structure

```
db/         schema + seed data
scoring/    Python scoring engine + FastAPI wrapper + pytest tests
api/        Node/Apollo GraphQL API + Jest tests
frontend/   React/TypeScript app
terraform/  AWS infrastructure
scripts/    deployment, smoke test, and teardown scripts
Makefile    convenience task runner
```

## Challenges

During development and cloud deployment, several real-world engineering challenges and edge cases were identified, investigated, and resolved.

### 1. ECS Container CPU Architecture Mismatch
- **Issue:** Docker images built on Apple Silicon (ARM64) hosts resulted in ECS Fargate task placement failures (`CannotPullContainerError: image Manifest does not contain descriptor matching platform 'linux/amd64'`).
- **Fix:** Updated `scripts/deploy.py` to build containers with `--platform linux/arm64` and configured `runtime_platform { cpu_architecture = "ARM64" }` in `terraform/ecs.tf`.
- **Process Improvement:** Standardize container build platforms explicitly in deployment scripts and CI/CD pipelines to prevent host-architecture drift.

### 2. AWS RDS SSL Connection Enforcement
- **Issue:** Node.js `pg` driver failed connecting to RDS PostgreSQL, raising `no pg_hba.conf entry ... no encryption` and `self-signed certificate in certificate chain` errors.
- **Fix:** Configured `api/src/db.js` to strip URL parameter overrides and pass `ssl: { rejectUnauthorized: false }` for production database connections.
- **Process Improvement:** Standardize database connection configuration wrappers to handle cloud-managed database TLS requirements out of the box.

### 3. Fresh RDS Instance Schema Initialization
- **Issue:** Newly provisioned AWS RDS PostgreSQL instances start with a blank database, causing GraphQL query failures on initial startup.
- **Fix:** Implemented an `initDb()` routine in `api/src/db.js` invoked during server boot that checks for table existence and automatically applies DDL schema and seed data if missing.
- **Process Improvement:** Build self-healing database initialization logic into application startup or use post-provisioning migration hooks.

### 4. Browser Mixed Content Enforcement over HTTPS
- **Issue:** Browsers blocked frontend GraphQL requests when loaded over HTTPS (`https://<cloudfront>/`) while pointing to an HTTP Application Load Balancer (`http://<alb>:4000/`).
- **Fix:** Configured CloudFront custom origin and cache behavior for `/graphql` forwarding requests to the ALB, and updated `frontend/src/api/client.ts` to use relative path `/graphql`.
- **Process Improvement:** Route all frontend API traffic through the primary CDN/reverse-proxy domain using relative paths (`/graphql`) rather than calling HTTP backends directly.

### 5. Stale CDN Asset Caching & Module Script MIME Type Errors
- **Issue:** CloudFront cached `index.html` referencing old JavaScript hashes that were deleted during redeployment. Requests for missing JS files triggered CloudFront's SPA 404 fallback to `/index.html` (`Content-Type: text/html`), causing browser module script loading errors (`Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html"`).
- **Fix:** Configured S3 sync with `no-cache` for `index.html` and long `immutable` cache headers for `/assets/*`, updated CloudFront TTLs to force `index.html` revalidation, and automated CloudFront cache invalidation in `scripts/deploy.py`.
- **Process Improvement:** Enforce distinct cache-control policies between HTML entrypoints (no-cache) and hashed static assets (long-cache), complemented by automated CDN invalidation and smoke test script module MIME type assertions.
