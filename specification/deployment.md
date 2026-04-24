# Deployment

WhereTF is FOSS (AGPL-3.0). CI publishes container images to the
public GitHub Container Registry; anyone can pull, run, and
self-host. The project's own homelab deployment pulls from the same
registry.

The open repo produces Docker artifacts only. Deploy orchestration
(hostnames, secrets, Ansible, Caddy config) lives in a separate
private infrastructure repo and is not part of this codebase.

---

## Artifacts

| Path | Purpose |
|------|---------|
| `web/Dockerfile` | Multi-stage: `deps`, `builder`, `migrator`, `runner`. |
| `web/.dockerignore` | Keeps `node_modules`, `.next`, secrets, and local Claude state out of the build context. |
| `docker-compose.yml` | Reference compose at repo root: runs app + Postgres + migration job end-to-end on a laptop. |
| `docker-compose.dev.yml` | Dev-only Postgres. Used with `npm run dev` against the host. |
| `web/app/api/health/route.ts` | Liveness probe. Always 200 if Node is servicing HTTP. |
| `web/app/api/health/ready/route.ts` | Readiness probe. 200 if `SELECT 1` round-trips to Postgres; 503 otherwise. |
| `web/db/migrations/meta/_journal.json` | Drizzle journal — authoritative, covers 0000..head. `drizzle-kit migrate` is a no-op against a DB at head, and applies everything against a fresh DB. |

---

## Supported Postgres

**Target: 16.x. Accepted: 15–17.**

The schema uses UUID, JSONB, text arrays, correlated subqueries, and
`SELECT DISTINCT ON` — all stable since 13. We pin the reference
compose to `postgres:16` because that's the current LTS. CI should run
against the minimum version we claim to support.

The `postgres` node driver and Drizzle are version-agnostic across
this range.

---

## Environment contract

Single image, differs only by environment variables.

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | `postgresql://user:pw@host:port/db`. Never baked into the image. |
| `NODE_ENV` | yes (runtime) | `production` in the runner image. |
| `PORT` | no | Default `3000`. |
| `HOSTNAME` | no | Default `0.0.0.0` so the container accepts external traffic. |
| `NEXT_TELEMETRY_DISABLED` | no | Set by the image; can be unset. |

Anything secret is read on first request from the process environment.
Nothing gets compiled into the bundle.

---

## Build

### Local (single-arch)

```bash
cd web
docker build --target runner   -t wheretf/web:<sha>     .
docker build --target migrator -t wheretf/migrate:<sha> .
```

### Multi-arch (done by CI)

GitHub Actions (`.github/workflows/ci.yml`) builds both stages for
`linux/amd64` and `linux/arm64` on every push to `main` and every
release tag, then publishes to GHCR:

- `ghcr.io/ndemarco/wheretf/web:sha-<shortsha>` (always)
- `ghcr.io/ndemarco/wheretf/web:latest` (on `main`)
- `ghcr.io/ndemarco/wheretf/web:v<x.y.z>` (on release tags)
- `ghcr.io/ndemarco/wheretf/migrate:*` — same tag schema.

Manual equivalent if you need it locally:

```bash
docker buildx create --use --name wtf-builder
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --target runner \
  -t ghcr.io/ndemarco/wheretf/web:<sha> \
  --push ./web
```

Tag with the git short-sha. Avoid `:latest` for prod.

---

## Run

### End-to-end with compose (simplest — good for smoke tests)

```bash
docker compose up --build -d
# http://localhost:3000
docker compose down -v   # stop + wipe the local DB volume
```

Orchestration sequence:
1. `postgres` starts, waits for healthy.
2. `migrate` runs `drizzle-kit migrate` against `DATABASE_URL`, exits 0.
3. `app` starts only after `migrate` exits successfully.

### Manual / deploy-system path

```bash
# 1. Provision a Postgres DB and put DATABASE_URL somewhere secret.

# 2. Run the one-shot migration task.
docker run --rm \
  -e DATABASE_URL="postgresql://..." \
  ghcr.io/ndemarco/wheretf/migrate:<sha>

# 3. Start the app (scale to N replicas as needed).
docker run -d \
  -e DATABASE_URL="postgresql://..." \
  -p 3000:3000 \
  ghcr.io/ndemarco/wheretf/web:<sha>
```

Roll forward: run the new migrator image, then roll the app replicas.
Roll back: point the app at the old image. Schema rollback needs a
separate down-migration strategy — not covered here.

---

## Health endpoints

- `GET /api/health` — liveness. 200 unconditionally. Use for container
  restart policies (`HEALTHCHECK` in the Dockerfile already does).
- `GET /api/health/ready` — readiness. 200 when the app can execute
  `SELECT 1`; 503 otherwise. Use to gate load-balancer traffic and
  rolling deploys.

Any deploy system that rolls replicas should poll `/ready` before
marking a new container healthy and before removing an old one.

---

## Dev → prod migration strategy

Migration authority is the drizzle journal at
`web/db/migrations/meta/_journal.json` plus the numbered `.sql` files
next to it. The deploy flow:

1. CI builds the `migrator` image at the same git sha as the `runner`
   image.
2. Deploy system runs the migrator as a one-shot task against the prod
   `DATABASE_URL`. Blocks on exit 0.
3. Deploy system rolls the `runner` image, gated on readiness.

There is no entrypoint-migrate in the runner image — migrations are
always a separate task so scaled replicas don't race each other.

For catastrophic rollback, `pg_restore` from the last pre-deploy dump.
The prod DB should take automated dumps at least hourly.

---

## Environments

| Environment | Database | Auth | Purpose |
|-------------|----------|------|---------|
| Local dev | Local Postgres via `docker-compose.dev.yml` (Docker Desktop / Engine on the dev host) — never a remote DB | Credentials + dev-impersonate (4 preset users on `/login`) | Development, manual testing |
| CI | Ephemeral Postgres service container | None | Automated tests |
| Staging | Homelab Postgres (separate DB) | OIDC (to come) | Pre-prod smoke |
| Production | Homelab Postgres (prod DB) | OIDC (to come) | Live app |

Same image across staging and prod — they differ only in
`DATABASE_URL` and (eventually) auth config.

---

## Logging

App logs go to stdout as newline-delimited text (default Next.js
formatting). Deploy system is responsible for shipping and retention.
Nothing app-side configures files, rotation, or remote sinks.

---

## Performance notes

- Standalone output + alpine base → runtime image ~180 MB.
- BuildKit cache mounts for `npm ci` and `.next/cache` keep warm
  rebuilds under a minute for small diffs.
- Single process per container. Scale horizontally for load.
  Multi-replica is safe once auth + DB-backed sessions land.

---

## Auth + multi-tenancy roadmap

Deployment works today without auth. Auth phases and isolation
model are tracked separately — see [auth-roadmap.md](auth-roadmap.md).
Key deployment hooks:

- **OIDC IdP** is an external dependency (homelab team operates
  Authentik/Keycloak/Zitadel, TBD). WhereTF only registers the
  Homelab provider when `AUTH_HOMELAB_ISSUER`,
  `AUTH_HOMELAB_CLIENT_ID`, `AUTH_HOMELAB_CLIENT_SECRET` are set.
  Until IdP is live, do not expose WhereTF to the internet.
- **API rate limiting** (future) — token-bucket limiter in
  `web/middleware.ts` around `/api/*`. External API keys are
  paid-only; ships with the API-keys phase.
