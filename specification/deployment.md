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
| Local dev | Local Postgres via `docker-compose.dev.yml` | None (to come) | Development, manual testing |
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

## Future work — TODOs so the deploy system knows what's coming

These are **planned, not implemented.** Deployment as described above
works without them. When any one of them lands, this doc and the
deployment system both get revisited.

### Identity provider (external dependency)

The homelab team deploys and operates the OIDC IdP (Authentik /
Keycloak / Zitadel, TBD) — **out of scope for WhereTF**. WhereTF
consumes it as an OIDC client. The homelab OIDC provider is
registered only when `AUTH_HOMELAB_ISSUER`, `AUTH_HOMELAB_CLIENT_ID`,
and `AUTH_HOMELAB_CLIENT_SECRET` are set; customer credentials and
dev impersonate work without it.

Until the IdP is live, WhereTF runs with customer credentials only
and must not be internet-reachable.

### Authentication

Auth.js v5 (next-auth) in `web/`. Hybrid providers:

- **Homelab IdP OIDC** — env-gated, for staff/admin federation.
- **Credentials** — email + password (bcryptjs), for customer
  accounts. Signup endpoint creates a `users` row and a default owner
  `orgs` row with `plan = 'free'`.
- **Dev impersonate** — registered only when
  `NODE_ENV !== "production"`, lets any email through for local dev.

**Session strategy: JWT.** Auth.js v5 requires JWT sessions when a
Credentials provider is in play. The JWT carries `sub` (user id);
per-request authz hydrates orgs and active role from the database.

**CSRF**: Auth.js covers `/api/auth/*`; mutation routes call
`requireCsrf()` from `web/lib/auth/csrf.ts`.

### Authorization

Model: **org-scoped, role per user-org pair, three-mode data
isolation.**

- New tables:
  - `users`, `accounts`, `sessions`, `verification_tokens` (Auth.js)
  - `orgs (id, name, slug, plan: 'free' | 'paid', ...)`
  - `user_orgs (user_id, org_id, role)`, roles
    `owner | admin | member | viewer`, PK `(user_id, org_id)`
- Every authenticated request carries
  `{ userId, activeOrgId, role }`, hydrated in `web/middleware.ts`
  from the session + `wtf-active-org` cookie (fallback = user's
  first org).
- Isolation mode per table:
  - **isolated** — `ownerOrgId NOT NULL`, strict filter
    `ownerOrgId = :orgId`.
    Tables: `modules`, `inserts`, `locations`, `assignments`,
    `location_interfaces_accepted`, `transactions`.
  - **additive** — `ownerOrgId` nullable. Read union
    `(ownerOrgId IS NULL OR ownerOrgId = :orgId)`. Writes default to
    the active org; writing a global row (`ownerOrgId = NULL`)
    requires elevated permission.
    Tables: `templates`, `template_versions`,
    `template_version_interfaces_provided`,
    `template_version_interfaces_accepted`, `items`, `item_aspects`,
    `item_parameter_values`, `item_categories`, `item_standards`,
    `co_storability`, `categories`, `parameter_definitions`,
    `aspects`, `aspect_parameters`, `standards`,
    `standard_parameters`, `standard_designations`,
    `aspect_standards`, `interface_types`.
  - **open** — no `ownerOrgId`, global only.
    Tables: none at launch.
- **Private items** are additive `items` rows with
  `ownerOrgId IS NOT NULL`. Free tier rejects private inserts; paid
  tier allows. No separate table, no visibility enum.
- **Global catalog edit policy**: any signed-in user may create or
  edit global rows. Every write lands in `transactions` with actor
  `userId`. No moderation UI at launch.
- Enforcement app-layer in repositories. Postgres RLS is a future
  refinement, not scheduled.

### Plan gating

`orgs.plan` drives two gates at launch:

1. **Seat limit** — free orgs reject a 2nd `user_orgs` insert.
2. **Private items** — free orgs reject `items` inserts with
   `ownerOrgId != null`.

Parametric metadata is in-app readable for any signed-in user, free
or paid. External API access (API keys) is paid-only; enforcement
ships with the API keys phase.

Billing integration is a separate phase (product TBD). Until it
lands, `orgs.plan` is toggled by a platform admin (`users.is_admin`)
via an admin-only endpoint.

### API access + rate limiting (future phase)

Two surfaces:

1. **Internal** — session auth + CSRF for mutations. Generous
   per-user limits (e.g. 60 rps burst, 300 rpm sustained).
2. **External** — `api_keys` table with hashed keys, scopes, per-key
   rate limits tied to `orgs.plan`. Paid-only.

Limiter: token bucket, sliding window. In-memory in dev; Redis in
prod.

Middleware in `web/middleware.ts` intercepts `/api/*`, runs auth +
rate-limit + org hydration before the route handler. Exempts
`/api/health*` and `/api/auth/*`.

### Multi-tenancy migration (execution order)

1. Add `ownerOrgId uuid` nullable to every additive + isolated table
   (no FK yet).
2. Create `users`, `accounts`, `sessions`, `verification_tokens`,
   `orgs`, `user_orgs`. Insert a default org and assign the current
   single user as `owner`.
3. Backfill isolated tables to the default org. Additive tables stay
   `NULL` — they become the global catalog.
4. Add FK `ownerOrgId → orgs.id` on every touched table. Flip
   `NOT NULL` on isolated tables.
5. Repo refactor: every method takes `{ userId, orgId, ... }`.
6. Two-org isolation integration test per repo.

None of the above blocks the deploy work. Ship the image now; layer
auth + tenancy in when the org model lands.
