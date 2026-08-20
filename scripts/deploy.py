#!/usr/bin/env uv run
# /// script
# dependencies = [
#   "httpx",
# ]
# ///

"""
Phase 3 Deployment Script
Provisions infrastructure via Terraform, builds and pushes ECR images,
updates ECS services, builds and uploads frontend to S3, and invalidates CloudFront.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
TF_DIR = ROOT_DIR / "terraform"


def run(cmd: list[str], cwd: Path | None = None, check: bool = True, env: dict | None = None) -> subprocess.CompletedProcess:
    """Helper to execute subprocess commands with proper streaming/logging."""
    full_env = {**os.environ, **(env or {})}
    print(f"➜ Running: {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=cwd, check=check, env=full_env)


def get_terraform_outputs() -> dict[str, str]:
    """Extract output variables from Terraform state."""
    result = subprocess.run(
        ["terraform", "output", "-json"],
        cwd=TF_DIR,
        capture_output=True,
        text=True,
        check=True,
    )
    raw = json.loads(result.stdout)
    return {key: val["value"] for key, val in raw.items()}


def main():
    print("=== 1. Initializing & Applying Terraform Infrastructure ===")
    run(["terraform", "init"], cwd=TF_DIR)
    run(["terraform", "apply", "-auto-approve"], cwd=TF_DIR)

    print("=== 2. Extracting Terraform Outputs ===")
    outputs = get_terraform_outputs()
    aws_region = outputs.get("aws_region", "us-east-1")
    ecr_api = outputs["ecr_repository_api_url"]
    ecr_scoring = outputs["ecr_repository_scoring_url"]
    graphql_url = outputs["graphql_api_url"]
    cloudfront_url = outputs["cloudfront_url"]
    s3_bucket = outputs["s3_bucket_name"]

    print(f"AWS Region: {aws_region}")
    print(f"API ECR: {ecr_api}")
    print(f"Scoring ECR: {ecr_scoring}")
    print(f"GraphQL API: {graphql_url}")
    print(f"Frontend CloudFront: {cloudfront_url}")

    print("=== 3. Authenticating Docker to ECR ===")
    token_proc = subprocess.run(
        ["aws", "ecr", "get-login-password", "--region", aws_region],
        capture_output=True,
        text=True,
        check=True,
    )
    subprocess.run(
        ["docker", "login", "--username", "AWS", "--password-stdin", ecr_api],
        input=token_proc.stdout,
        text=True,
        check=True,
    )

    print("=== 4. Building & Pushing Scoring Container ===")
    run(["docker", "build", "--platform", "linux/arm64", "-t", f"{ecr_scoring}:latest", "."], cwd=ROOT_DIR / "scoring")
    run(["docker", "push", f"{ecr_scoring}:latest"])

    print("=== 5. Building & Pushing API Container ===")
    run(["docker", "build", "--platform", "linux/arm64", "-t", f"{ecr_api}:latest", "."], cwd=ROOT_DIR / "api")
    run(["docker", "push", f"{ecr_api}:latest"])

    print("=== 6. Updating ECS Services ===")
    run([
        "aws", "ecs", "update-service",
        "--cluster", "orf-assessment-cluster",
        "--service", "orf-assessment-scoring",
        "--force-new-deployment",
        "--region", aws_region,
    ], check=False)

    run([
        "aws", "ecs", "update-service",
        "--cluster", "orf-assessment-cluster",
        "--service", "orf-assessment-api",
        "--force-new-deployment",
        "--region", aws_region,
    ], check=False)

    print("=== 7. Building & Uploading Frontend to S3 ===")
    frontend_dir = ROOT_DIR / "frontend"
    run(["npm", "install"], cwd=frontend_dir)
    run(["npm", "run", "build"], cwd=frontend_dir, env={"VITE_API_URL": "/graphql"})
    run([
        "aws", "s3", "sync", "dist/assets/", f"s3://{s3_bucket}/assets/",
        "--cache-control", "public, max-age=31536000, immutable",
        "--delete"
    ], cwd=frontend_dir)
    run([
        "aws", "s3", "sync", "dist/", f"s3://{s3_bucket}/",
        "--exclude", "assets/*",
        "--cache-control", "no-cache, no-store, must-revalidate",
        "--delete"
    ], cwd=frontend_dir)

    print("=== 8. Invalidating CloudFront Cache ===")
    dist_id = outputs.get("cloudfront_distribution_id")
    if dist_id:
        print(f"Invalidating CloudFront Distribution: {dist_id}")
        run(["aws", "cloudfront", "create-invalidation", "--distribution-id", dist_id, "--paths", "/*"])

    print("\n=== Deployment Completed Successfully ===")
    print(f"GraphQL API endpoint: {graphql_url}")
    print(f"CloudFront App URL: {cloudfront_url}")


if __name__ == "__main__":
    main()
