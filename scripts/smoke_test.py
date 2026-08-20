#!/usr/bin/env uv run
# /// script
# dependencies = [
#   "httpx",
# ]
# ///

"""
Phase 3 Smoke Test Script
Verifies deployed Scoring Service, GraphQL API, and CloudFront Frontend.
"""

import json
import subprocess
import sys
from pathlib import Path
import httpx

ROOT_DIR = Path(__file__).resolve().parent.parent
TF_DIR = ROOT_DIR / "terraform"


def get_terraform_outputs() -> dict[str, str]:
    """Retrieve outputs from terraform state if present."""
    try:
        res = subprocess.run(
            ["terraform", "output", "-json"],
            cwd=TF_DIR,
            capture_output=True,
            text=True,
            check=True,
        )
        raw = json.loads(res.stdout)
        return {k: v["value"] for k, v in raw.items()}
    except Exception:
        return {}


def main():
    outputs = get_terraform_outputs()
    graphql_url = outputs.get("graphql_api_url", sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4000")
    cloudfront_url = outputs.get("cloudfront_url", sys.argv[2] if len(sys.argv) > 2 else "http://localhost:5173")
    alb_dns = outputs.get("alb_dns_name", "localhost")
    scoring_health_url = f"http://{alb_dns}:8000/health"

    errors = 0
    client = httpx.Client(timeout=10.0)

    print("=== 1. Smoke Testing Scoring Service Health ===")
    print(f"Target: {scoring_health_url}")
    try:
        resp = client.get(scoring_health_url)
        if resp.status_code == 200:
            print("✔ Scoring service is healthy (HTTP 200)")
        else:
            print(f"✖ Scoring service health check failed (HTTP {resp.status_code})")
            errors += 1
    except Exception as e:
        print(f"✖ Scoring service health check failed: {e}")
        errors += 1

    print("\n=== 2. Smoke Testing GraphQL API ===")
    print(f"Target: {graphql_url}")
    try:
        resp = client.post(
            graphql_url,
            json={"query": "{ passage(grade: 3) { id title totalWords } }"},
            headers={"Content-Type": "application/json"},
        )
        data = resp.json()
        if "The Garden Surprise" in json.dumps(data):
            print("✔ GraphQL API successfully returned seeded passage data")
        else:
            print(f"✖ GraphQL API query failed. Response: {data}")
            errors += 1
    except Exception as e:
        print(f"✖ GraphQL API test failed: {e}")
        errors += 1

    print("\n=== 3. Smoke Testing CloudFront Frontend ===")
    print(f"Target: {cloudfront_url}")
    index_html = ""
    try:
        resp = client.get(cloudfront_url)
        if resp.status_code == 200:
            index_html = resp.text
            print("✔ Frontend CloudFront endpoint is reachable (HTTP 200)")
        else:
            print(f"✖ Frontend check failed (HTTP {resp.status_code})")
            errors += 1
    except Exception as e:
        print(f"✖ Frontend check failed: {e}")
        errors += 1

    print("\n=== 4. Smoke Testing CloudFront HTTPS GraphQL Proxy (No Mixed Content) ===")
    cloudfront_graphql_url = f"{cloudfront_url.rstrip('/')}/graphql"
    print(f"Target: {cloudfront_graphql_url}")
    try:
        resp = client.post(
            cloudfront_graphql_url,
            json={"query": "{ passage(grade: 3) { id title totalWords } }"},
            headers={"Content-Type": "application/json"},
        )
        data = resp.json()
        if "The Garden Surprise" in json.dumps(data):
            print("✔ CloudFront HTTPS GraphQL proxy successfully returned seeded passage data (0 mixed content issues)")
        else:
            print(f"✖ CloudFront HTTPS GraphQL proxy query failed. Response: {data}")
            errors += 1
    except Exception as e:
        print(f"✖ CloudFront HTTPS GraphQL proxy test failed: {e}")
        errors += 1

    print("\n=== 5. Smoke Testing Frontend JS Module Assets MIME Type & Cache Integrity ===")
    import re
    script_sources = re.findall(r'src=["\']([^"\'\s]+\.js)["\']', index_html)
    if not script_sources:
        print("⚠ Warning: No script module sources found in index.html to verify MIME types")
    else:
        for src in script_sources:
            asset_url = src if src.startswith("http") else f"{cloudfront_url.rstrip('/')}/{src.lstrip('/')}"
            print(f"Testing JS Asset: {asset_url}")
            try:
                asset_resp = client.get(asset_url)
                content_type = asset_resp.headers.get("content-type", "")
                text = asset_resp.text.strip().lower()

                if asset_resp.status_code == 200 and not "text/html" in content_type and not text.startswith("<!doctype html"):
                    print(f"✔ JS module asset {src} served with correct MIME type ({content_type})")
                else:
                    print(f"✖ JS module asset {src} failed MIME type check! HTTP {asset_resp.status_code}, Content-Type: {content_type}")
                    errors += 1
            except Exception as e:
                print(f"✖ Failed to fetch JS asset {asset_url}: {e}")
                errors += 1

    print("\n=== Smoke Test Summary ===")
    if errors == 0:
        print("✔ All smoke tests passed successfully!")
        sys.exit(0)
    else:
        print(f"✖ Smoke test failed with {errors} error(s).")
        sys.exit(1)


if __name__ == "__main__":
    main()
