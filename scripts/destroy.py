#!/usr/bin/env uv run
# /// script
# dependencies = []
# ///

"""
Phase 3 Teardown Script
Safely empties S3 buckets and destroys all AWS infrastructure created by Terraform.
"""

import json
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
TF_DIR = ROOT_DIR / "terraform"


def main():
    print("=== 1. Checking Terraform State ===")
    s3_bucket = ""
    try:
        res = subprocess.run(
            ["terraform", "output", "-raw", "s3_bucket_name"],
            cwd=TF_DIR,
            capture_output=True,
            text=True,
        )
        if res.returncode == 0:
            s3_bucket = res.stdout.strip()
    except Exception:
        pass

    if s3_bucket:
        print(f"=== 2. Emptying S3 Frontend Bucket: {s3_bucket} ===")
        subprocess.run(["aws", "s3", "rm", f"s3://{s3_bucket}", "--recursive"], check=False)

    print("=== 3. Executing Terraform Destroy ===")
    subprocess.run(["terraform", "destroy", "-auto-approve"], cwd=TF_DIR, check=True)

    print("=== Infrastructure Teardown Complete ===")


if __name__ == "__main__":
    main()
