# Auth & Multi-Tenancy Roadmap

Ordered sequence for landing authentication, authorization, and
multi-tenancy in WhereTF. Each phase blocks the next. Detailed scope
lives in [deployment.md](deployment.md#future-work--todos-so-the-deploy-system-knows-whats-coming)
and in the approved implementation plan
(`/home/nick/.claude/plans/linear-crafting-feigenbaum.md`); this file
is the index and the agreed ordering.

## External dependency — IdP

The homelab team deploys and operates the OIDC identity provider
(Authentik / Keycloak / Zitadel, TBD). This is **out of scope for
WhereTF**. WhereTF consumes the IdP as an OIDC client via
`AUTH_HOMELAB_ISSUER` and credentials. Until the IdP is live, the
homelab OIDC provider is optional (only registered when env vars are
set); customer credentials and dev impersonate work without it.

## Priority order (agreed)

1. **Authentication** — Auth.js v5, hybrid providers (homelab IdP OIDC
   for staff/admin, email+password credentials for customers, dev
   impersonate gated on non-production). JWT sessions (Auth.js v5
   constraint when Credentials provider is in play). CSRF helper for
   mutation routes.
2. **Authorization** — `orgs`, `user_orgs(role)` with roles
   `owner | admin | member | viewer`. Per-request context hydrated by
   middleware from session + active-org cookie. Enforcement
   app-layer; Postgres RLS deferred until threat model justifies it.
3. **Multi-tenancy migration** — three-mode isolation model
   (isolated / additive / open). Add `ownerOrgId` nullable → backfill
   isolated tables to a default org → flip NOT NULL on isolated.
   Additive tables keep nullable. Repo refactor so every method takes
   `{ userId, orgId }`. Two-org isolation integration test per repo.
4. **Org switcher + signup UI** — signup creates user + default free
   org. Org switcher in app shell. `/settings/org` for members /
   invites / rename / transfer / delete.
5. **Plan gating** — `orgs.plan: 'free' | 'paid'` drives seat limit
   and private-items gate. Billing integration and external API keys
   are follow-on phases, not this roadmap.

## Why this order

- **1 → 2**: authorization needs an authenticated `userId` to scope by.
- **2 → 3**: the migration applies the authz model to existing data;
  the model has to exist first.
- **3 → 4**: UI needs org context it can read and switch.
- **4 → 5**: plan gates check org plan at create/invite time; orgs
  must exist and be switchable first.

## Gate between phases

Each phase produces an artifact reviewed before the next phase
starts. No combining phases, no parallel work across phases unless
explicitly agreed.
