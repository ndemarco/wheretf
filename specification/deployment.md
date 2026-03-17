# Deployment & CI/CD

## Infrastructure

- **Git hosting:** GitLab at git.demar.co
- **Runtime:** Local homelab
- **Database:** PostgreSQL (local instance)

## Pipeline

GitLab CI/CD (`.gitlab-ci.yml`), four stages:

1. **Lint** — ESLint, TypeScript type-check
2. **Test** — Vitest against PostgreSQL service container, all tests must pass
3. **Build** — `next build`, fails on build errors
4. **Deploy** — to homelab (method TBD: SSH, local runner, or container registry)

## PostgreSQL in CI

GitLab CI provides PostgreSQL as a service container. Tests run against it with the same migration and rollback strategy used in local development.

```yaml
services:
  - postgres:16
variables:
  POSTGRES_DB: wheretf_test
  POSTGRES_USER: test
  POSTGRES_PASSWORD: test
  DATABASE_URL: postgresql://test:test@postgres:5432/wheretf_test
```

## Environments

| Environment | Database | Purpose |
|-------------|----------|---------|
| Local dev | Local PostgreSQL | Development, manual testing |
| CI | Service container PostgreSQL | Automated tests |
| Production | Homelab PostgreSQL | Live application |

## Migrations

Drizzle generates SQL migration files from schema changes. Migrations run automatically in CI before tests. In production, migrations run as a pre-deploy step.
