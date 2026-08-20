output "cloudfront_url" {
  description = "Domain name of the CloudFront distribution hosting the frontend"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution hosting the frontend"
  value       = aws_cloudfront_distribution.frontend.id
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "graphql_api_url" {
  description = "Public URL for GraphQL API endpoint"
  value       = "http://${aws_lb.main.dns_name}:4000"
}

output "ecr_repository_api_url" {
  description = "ECR Repository URL for API image"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_repository_scoring_url" {
  description = "ECR Repository URL for Scoring service image"
  value       = aws_ecr_repository.scoring.repository_url
}

output "rds_endpoint" {
  description = "PostgreSQL RDS Instance Endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket hosting frontend static build"
  value       = aws_s3_bucket.frontend.id
}
