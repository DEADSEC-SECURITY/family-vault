---
layout: default
title: Home
nav_order: 1
---

# Family Vault Documentation

A self-hosted, open-source family document vault for securely managing IDs, insurance, business documents, and more.

---

## Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](ARCHITECTURE) | System design, database schema, encryption, patterns |
| [Deployment](DEPLOYMENT) | Docker Compose, cloud platforms, backups, reverse proxy |
| [API Reference](api-reference) | All backend API endpoints |
| [Frontend Guide](frontend-guide) | Component architecture, shared utilities, patterns |
| [Backend Guide](backend-guide) | Module structure, shared helpers, migrations |

## Getting Started

```bash
git clone https://github.com/yourusername/family-vault.git
cd family-vault
cp .env.example .env
docker compose up -d --build
```

Open `http://localhost:3000` and register a new account.

See the full [Master Documentation](https://github.com/yourusername/family-vault/blob/main/DOCS.md) for comprehensive coverage of all features.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Python 3.13, FastAPI, SQLAlchemy 2.0, Alembic |
| Database | PostgreSQL 17 |
| Storage | MinIO (S3-compatible), AES-256-GCM encrypted |
| Auth | Session-based (bcrypt + opaque tokens) |
