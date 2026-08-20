# Oral Reading Fluency Assessment Platform
### Requirements & Implementation Plan (v2 — Finalized MVP Scope)
Portfolio project modeled on Amplify's mCLASS / Literacy Assessments product line

---

## 1. Background & Rationale

**Why this feature:** Amplify's flagship literacy product is **mCLASS**, an all-in-one K–8 assessment platform built on **DIBELS 8th Edition** — the University of Oregon's research-based Dynamic Indicators of Basic Early Literacy Skills. The signature interaction of DIBELS is the **one-minute Oral Reading Fluency (ORF)** measure: a teacher sits with a student, the student reads a grade-level passage aloud for 60 seconds, the teacher marks errors in real time, and the system scores it as **Words Correct Per Minute (WCPM)** plus accuracy. Results are compared against benchmark norms to flag a risk tier and feed a progress-monitoring view teachers use to plan instruction.

I wanted to build a mock version of this product to get a feel for the type of work required of a Software Engineer working on the Literacy Assessment engineering team. The mock product sets out to create solutions for some of the challenges faced by engineer in this role. Notably, a real-time, classroom-reliable teacher-facing UI; a non-trivial scoring/business-rules engine; reporting with actionable recommendations; and a Python + JavaScript, GraphQL-fronted, AWS-deployed full-stack architecture.

The mock product uses an **original passage bank and an original but methodologically equivalent scoring engine** and does not attempt to reproduce DIBELS itself which is a licensed IP.

## 2. Scope: MVP for a 1–2 Day Build

Full team-scale versions of this product would include multi-class rosters, Spanish-language parity, dyslexia screening composites, district rollups, SSO, and offline sync. All of that is explicitly **out of scope** here. This build optimizes for one thing: a complete, working, deployed vertical slice that demonstrates clean full-stack + infra work in the time available.

**In scope:**
- One seeded student, one seeded reading passage, no login/auth screen (single hardcoded teacher context)
- Live 60-second timed assessment with click-to-tag error marking
- A tested, isolated scoring engine (WCPM, accuracy %, risk tier vs. a hardcoded benchmark table for one grade)
- A results screen and a small progress chart (seeded historical assessments + the new one)
- GraphQL API in front of the scoring/domain logic
- Real deploy to AWS via Terraform (not just local Docker Compose)

**Explicitly cut / noted as future work in the README:**
- Class rosters / multiple students, teacher login, multi-grade passages
- DynamoDB / LocalStack — Postgres alone is sufficient; in-progress tagging state lives in React state until submit
- Datadog — noted as a natural addition, not implemented
- Spanish-language parity, dyslexia screening, admin/district rollups

## 3. Tech Stack (final)

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript (Vite), deployed as a static build |
| API | GraphQL via Apollo Server (Node) |
| Domain/scoring service | Python (FastAPI), called by the GraphQL layer over HTTP |
| Database | PostgreSQL (RDS in AWS, containerized Postgres locally) |
| Local dev | Docker Compose |
| Cloud deploy | AWS — ECS Fargate (API + scoring service), RDS Postgres, S3 + CloudFront (frontend static hosting), ALB |
| Infra as code | Terraform, including a `terraform destroy` path |
| Testing | pytest (scoring engine), Jest (frontend/resolvers), WebdriverIO (E2E of the assessment flow) — E2E as a stretch goal if time allows |

**Noted architecture tradeoff:** This build uses ECS Fargate instead of Lambda Functions, since a long-running GraphQL/scoring service maps more naturally to containers than to a serverless function-per-request model. This tradeoff is documented in the README.

## 4. Data Model

```
Student(id, first_name, last_initial, grade)
Passage(id, grade_level, title, word_tokens[], total_words)
BenchmarkNorm(grade, season, at_benchmark_wcpm, some_risk_wcpm)
Assessment(id, student_id, passage_id, administered_at, season,
           words_read, errors_json, wcpm, accuracy_pct, risk_tier)
```

`errors_json` stores the {word_index, error_type} events tagged live during the assessment, finalized into the row on submit.

## 5. API Surface (GraphQL)

```graphql
type Query {
  passage(grade: Int!): Passage!
  studentProgress(studentId: ID!): [Assessment!]!
}

type Mutation {
  startAssessment(studentId: ID!, passageId: ID!): AssessmentSession!
  tagError(sessionId: ID!, wordIndex: Int!, errorType: ErrorType!): AssessmentSession!
  submitAssessment(sessionId: ID!, wordsReadIndex: Int!): Assessment!
}
```

`submitAssessment` calls the Python scoring service, which returns WCPM, accuracy, and risk tier for persistence.

## 6. Build Plan

### Phase 1 — Local MVP (~7 hrs)
1. **Scaffold** (45 min) — Docker Compose: Postgres, Apollo/Node service, FastAPI scoring service, Vite/React frontend. Seed one student, one passage, 2–3 historical assessments.
2. **Scoring engine first** (45 min) — pure Python module, WCPM/accuracy/risk-tier logic against a hardcoded single-grade benchmark table, 5–6 pytest cases before any UI work.
3. **GraphQL layer** (60 min) — schema above, resolvers, Postgres access, HTTP call to scoring service on submit.
4. **Assessment UI** (2.5–3 hrs) — clickable word-token passage, 60s countdown, click-to-tag miscue, freeze/stop, submit → results screen. Prioritize not losing assessment state on a stray click or network blip — this is the "works reliably in real classrooms" requirement in miniature.
5. **Progress chart** (45 min) — Recharts line chart, WCPM over seeded + new assessments, flat benchmark reference line.
6. **Local polish** (30 min) — README draft, docker-compose up instructions.

### Phase 2 — Terraform: Core AWS Infra (2–3 hrs) [Completed]
- **VPC (`vpc.tf`)**: Hand-rolled VPC (`10.0.0.0/16`) with 2 public subnets (`10.0.1.0/24`, `10.0.2.0/24`) for ALB & ECS and 2 private subnets (`10.0.10.0/24`, `10.0.11.0/24`) across 2 Availability Zones, Internet Gateway, and single NAT Gateway for egress.
- **RDS Postgres (`rds.tf`)**: Single-AZ PostgreSQL 16 (`db.t4g.micro`) in private DB subnet group. `skip_final_snapshot = true` and `deletion_protection = false` for clean teardown.
- **Security (`security.tf`)**: Tight security group chain: ALB SG (ports 80/4000 open to 0.0.0.0/0) -> ECS Task SG (ingress from ALB & self) -> RDS SG (port 5432 ingress allowed ONLY from ECS Task SG).
- **ECR Repositories (`ecr.tf`)**: Docker registries for `orf-assessment-api` and `orf-assessment-scoring` with lifecycle policies expiring untagged images.
- **ECS Fargate Services (`ecs.tf`)**: ECS cluster running Fargate task definitions for `api` (port 4000) and `scoring` (port 8000) behind an Application Load Balancer with target group health checks (`/` and `/health`).
- **SSM Parameter Store (`ssm.tf`)**: Secure parameter injection for `DATABASE_URL` (`SecureString`), `DB_PASSWORD` (`SecureString`), and `SCORING_SERVICE_URL`. No secrets hardcoded in task definitions.
- **Frontend S3 + CloudFront (`s3_cloudfront.tf`)**: Private S3 bucket (`force_destroy = true`) with Origin Access Control (OAC) and CloudFront distribution with SPA route fallbacks (403/404 -> `/index.html`).
- **Outputs & Verification (`outputs.tf`)**: Exports `cloudfront_url`, `alb_dns_name`, `graphql_api_url`, `ecr_repository_api_url`, `ecr_repository_scoring_url`, and `s3_bucket_name`. Verified with `terraform init` and `terraform validate`.

### Phase 3 — Deploy + Smoke Test (1 hr) [Completed]
- **Deployment Script (`scripts/deploy.py`)**: Automates `terraform apply`, retrieves ECR credentials and endpoints, builds and pushes `api` and `scoring` Docker images, triggers ECS Fargate service updates (`--force-new-deployment`), builds the React frontend static assets targeting the live GraphQL endpoint, uploads assets to S3, and invalidates CloudFront cache (managed with UV).
- **Smoke Test Suite (`scripts/smoke_test.py`)**: Automated verification testing `scoring` HTTP health (`/health`), GraphQL API passage queries against live RDS, and CloudFront static distribution accessibility (managed with UV).
- **Teardown Script (`scripts/destroy.py`)**: Empties frontend S3 bucket and executes `terraform destroy -auto-approve` for clean resource cleanup (managed with UV).
- **Unified Makefile (`Makefile`)**: Root command targets (`make deploy`, `make smoke-test`, `make destroy`, `make test`, `make lint`, `make local-up`).

### Phase 4 — Harden + Document (30–45 min) [Completed]
- **Least-Privilege Security**: IAM roles explicitly scoped to resource ARNs, private network isolation for RDS, CloudFront OAC for S3, and SSM Parameter Store secret injection.
- **Comprehensive Documentation**: Updated `README.md` with infrastructure tradeoffs (ECS Fargate vs. Lambda), network security architecture, demo vs. production considerations, deployment pipeline commands, and `AGENTS.md` context file.

**Total estimate: ~11–12 hours**, realistically a long single day or a relaxed two-day build.

## 7. Definition of Done
- [x] `docker-compose up` runs the full app locally end-to-end
- [x] Scoring engine has passing unit tests covering at least: perfect read, several errors, zero words read, boundary WCPM near a risk-tier cutoff
- [x] Core AWS infrastructure defined in Terraform (`terraform/` directory validated with `terraform validate`)
- [x] Automated deployment pipeline (`scripts/deploy.py`) and smoke test suite (`scripts/smoke_test.py`) implemented with UV
- [x] Clean teardown automation (`scripts/destroy.py`) implemented with S3 bucket emptying and `terraform destroy` with UV
- [x] README covers: product inspiration, what was cut for scope, architecture diagram or description, local run instructions, deploy/destroy instructions, security decisions, and the Fargate-vs-Lambda tradeoff note

---
*Status: All Phase 1–4 implementation requirements completed & verified.*
