terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region
  # custom profile using credential_process configuration to
  # export the console credentials as temporary credentials Terraform can read
  profile = "terraform-process"

  default_tags {
    tags = {
      Project     = "orf-assessment"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

resource "random_password" "db_password" {
  length  = 20
  special = false
}

resource "random_id" "suffix" {
  byte_length = 4
}
