---
layout: default
title: Deployment
nav_order: 6
---

# Deployment Guide

This guide covers various deployment options for Family Vault.

## Table of Contents

- [Docker Compose (Recommended)](#docker-compose-recommended)
- [Using Pre-built Images](#using-pre-built-images)
- [Cloud Platforms](#cloud-platforms)
  - [DigitalOcean](#digitalocean)
  - [AWS](#aws)
  - [Google Cloud](#google-cloud)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [Backup and Restore](#backup-and-restore)
- [Monitoring](#monitoring)

## Docker Compose (Recommended)

### Quick Start

1. **Clone and configure**
   ```bash
   git clone https://github.com/yourusername/family-vault.git
   cd family-vault
   cp .env.example .env
   ```

2. **Edit `.env`** - Change at minimum:
   ```bash
   SECRET_KEY=your_long_random_secret_key_minimum_32_characters
   POSTGRES_PASSWORD=your_secure_database_password
   S3_SECRET_KEY=your_secure_minio_password
   ```

3. **Generate a strong SECRET_KEY**:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

4. **Start services**
   ```bash
   docker-compose up -d
   ```

5. **Check health**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

### Production Considerations

- **Enable HTTPS** - Use a reverse proxy (see below)
- **Change all passwords** - Database, MinIO, etc.
- **Set up backups** - See backup section below
- **Configure email** - For reminder notifications
- **Resource limits** - Add to docker-compose.yml:
  ```yaml
  services:
    backend:
      deploy:
        resources:
          limits:
            cpus: '1'
            memory: 1G
  ```

## Using Pre-built Images

Instead of building from source, use pre-built images from Docker Hub:

```yaml
# docker-compose.yml
services:
  backend:
    image: familyvault/backend:latest  # Instead of build: ./backend
    # ... rest of config

  frontend:
    image: familyvault/frontend:latest  # Instead of build: ./frontend
    # ... rest of config
```

Update to latest version:
```bash
docker-compose pull
docker-compose up -d
```

## Cloud Platforms

### DigitalOcean

**Option 1: Droplet with Docker**

1. Create a Droplet (Ubuntu 22.04, 2GB RAM minimum)
2. SSH into your droplet
3. Install Docker:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```
4. Follow Docker Compose quick start steps above
5. Set up firewall:
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

**Option 2: DigitalOcean App Platform**

1. Fork the repository
2. Create new App in DigitalOcean App Platform
3. Connect your GitHub repository
4. Configure environment variables
5. Deploy

**Database**: Use DigitalOcean Managed PostgreSQL for production reliability.

### AWS

**Option 1: EC2 + Docker**

1. Launch EC2 instance (t3.small or larger)
2. Use Amazon Linux 2 or Ubuntu
3. Install Docker and Docker Compose
4. Follow Docker Compose setup
5. Use RDS for PostgreSQL (recommended for production)
6. Use S3 instead of MinIO:
   ```env
   S3_ENDPOINT_URL=https://s3.amazonaws.com
   S3_REGION=us-east-1
   S3_ACCESS_KEY=your_access_key
   S3_SECRET_KEY=your_secret_key
   ```

**Option 2: ECS (Elastic Container Service)**

1. Push images to ECR
2. Create ECS task definition
3. Create ECS service
4. Use RDS for database
5. Use S3 for file storage
6. Use ALB for load balancing

**Cost Optimization**:
- Use t3/t4g instance types (ARM)
- Enable RDS automated backups
- Use S3 lifecycle policies for old files
- Set up CloudWatch alarms

### Google Cloud

**Option 1: Compute Engine + Docker**

1. Create Compute Engine VM
2. Install Docker
3. Follow Docker Compose setup
4. Use Cloud SQL for PostgreSQL
5. Use Cloud Storage instead of MinIO

**Option 2: Cloud Run**

1. Build and push to Google Container Registry
2. Deploy backend to Cloud Run
3. Deploy frontend to Cloud Run
4. Use Cloud SQL
5. Use Cloud Storage

**Secrets**: Use Secret Manager for environment variables.

## Reverse Proxy Setup

### Nginx

1. Install Nginx:
   ```bash
   sudo apt update
   sudo apt install nginx certbot python3-certbot-nginx
   ```

2. Create configuration:
   ```nginx
   # /etc/nginx/sites-available/familyvault
   server {
       listen 80;
       server_name your-domain.com;

       client_max_body_size 100M;  # Allow large file uploads

       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       location /api/ {
           proxy_pass http://localhost:8000/api/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

3. Enable site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/familyvault /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. Enable HTTPS:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

### Caddy

Caddy automatically handles HTTPS:

```caddy
# Caddyfile
your-domain.com {
    reverse_proxy localhost:3000

    handle /api/* {
        reverse_proxy localhost:8000
    }

    encode gzip
}
```

Start Caddy:
```bash
caddy run --config Caddyfile
```

## Backup and Restore

### PostgreSQL Backup

**Manual Backup**:
```bash
docker-compose exec postgres pg_dump -U familyvault familyvault > backup.sql
```

**Restore**:
```bash
docker-compose exec -T postgres psql -U familyvault familyvault < backup.sql
```

**Automated Backups** (cron):
```bash
# Add to crontab: daily backups at 2 AM
0 2 * * * cd /path/to/family-vault && docker-compose exec -T postgres pg_dump -U familyvault familyvault | gzip > backups/backup-$(date +\%Y\%m\%d).sql.gz
```

### MinIO Backup

**Backup bucket**:
```bash
docker-compose exec minio mc mirror local/familyvault /backups/minio/
```

**Or sync to S3**:
```bash
mc alias set minio-local http://localhost:9000 minioadmin minioadmin
mc alias set aws-s3 https://s3.amazonaws.com ACCESS_KEY SECRET_KEY
mc mirror minio-local/familyvault aws-s3/backup-bucket/
```

### Full Backup Script

```bash
#!/bin/bash
# backup.sh - Full backup script

BACKUP_DIR="/backups/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Database
docker-compose exec -T postgres pg_dump -U familyvault familyvault | gzip > $BACKUP_DIR/database.sql.gz

# MinIO data
docker-compose exec minio mc mirror local/familyvault $BACKUP_DIR/files/

# Configuration
cp .env $BACKUP_DIR/
cp docker-compose.yml $BACKUP_DIR/

# Compress
cd /backups
tar -czf familyvault-backup-$(date +%Y%m%d).tar.gz $(date +%Y%m%d)/

# Clean up old backups (keep 30 days)
find /backups -name "familyvault-backup-*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR"
```

Make executable and schedule:
```bash
chmod +x backup.sh
# Add to crontab
0 2 * * * /path/to/backup.sh
```

## Monitoring

### Docker Health Checks

Add health checks to docker-compose.yml:

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Logging

Centralize logs:
```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend

# Save logs
docker-compose logs > app.log
```

### Resource Monitoring

```bash
# Check resource usage
docker stats

# Check disk usage
docker system df
```

## Upgrading

1. **Backup first!** (see backup section)
2. Pull latest code:
   ```bash
   git pull origin main
   ```
3. Pull latest images (if using pre-built):
   ```bash
   docker-compose pull
   ```
4. Rebuild (if building from source):
   ```bash
   docker-compose build
   ```
5. Apply database migrations:
   ```bash
   docker-compose exec backend alembic upgrade head
   ```
6. Restart services:
   ```bash
   docker-compose up -d
   ```
7. Verify:
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

## Troubleshooting

### Common Issues

**Container won't start**:
```bash
docker-compose logs backend
docker-compose logs frontend
```

**Database connection errors**:
- Check DATABASE_URL in .env
- Ensure postgres container is running
- Check postgres logs: `docker-compose logs postgres`

**File upload errors**:
- Check MinIO is running: `docker-compose ps minio`
- Verify S3 credentials in .env
- Check MinIO console: http://localhost:9001

**Permission errors**:
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
```

### Reset Everything

**WARNING**: This deletes all data!

```bash
docker-compose down -v
docker-compose up -d
```

## Security Checklist

- [ ] Changed SECRET_KEY to a strong random value
- [ ] Changed all default passwords (database, MinIO)
- [ ] Enabled HTTPS with valid SSL certificate
- [ ] Configured firewall (only ports 80, 443, 22 open)
- [ ] Set up automated backups
- [ ] Configured SMTP for email notifications (optional)
- [ ] Reviewed and restricted CORS_ORIGINS
- [ ] Enabled Docker logging
- [ ] Set up monitoring/alerting
- [ ] Documented emergency recovery procedure

## Support

For deployment issues:
- Check [GitHub Discussions](https://github.com/yourusername/family-vault/discussions)
- Open an [Issue](https://github.com/yourusername/family-vault/issues)
- Review [FAQ](FAQ.md)
