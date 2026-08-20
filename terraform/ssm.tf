resource "aws_ssm_parameter" "db_password" {
  name        = "/${var.app_name}/DB_PASSWORD"
  description = "PostgreSQL Database Password"
  type        = "SecureString"
  value       = random_password.db_password.result

  tags = {
    Name = "${var.app_name}-db-password-ssm"
  }
}

resource "aws_ssm_parameter" "database_url" {
  name        = "/${var.app_name}/DATABASE_URL"
  description = "PostgreSQL Database Connection String"
  type        = "SecureString"
  value       = "postgres://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.postgres.endpoint}/${var.db_name}"

  tags = {
    Name = "${var.app_name}-database-url-ssm"
  }
}

resource "aws_ssm_parameter" "scoring_service_url" {
  name        = "/${var.app_name}/SCORING_SERVICE_URL"
  description = "Internal URL for Python Scoring Service"
  type        = "String"
  value       = "http://localhost:8000" # when co-located or via internal DNS / ALB

  tags = {
    Name = "${var.app_name}-scoring-service-url-ssm"
  }
}
