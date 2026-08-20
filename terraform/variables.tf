variable "aws_region" {
  type        = string
  description = "AWS region for deployment"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment name"
  default     = "demo"
}

variable "app_name" {
  type        = string
  description = "Application name used for naming resources"
  default     = "orf-assessment"
}

variable "db_name" {
  type        = string
  description = "PostgreSQL database name"
  default     = "orf"
}

variable "db_username" {
  type        = string
  description = "PostgreSQL master username"
  default     = "orf_user"
  sensitive   = true
}
