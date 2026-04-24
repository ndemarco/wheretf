# User Menu

Persistent account affordance at the bottom of the left sidebar:
avatar + name, signs out, and (dev/non-prod) switches persona without
a `/login` round-trip.

## Status

**Partially shipped** — avatar + sign-out live. Dev-persona switcher
and `/settings` routes are forward-looking. Decisions below apply when
those pieces land.

---

## Switch-persona (dev-only)

Gated by the same `allowDevImpersonate` check used on `/login`:
`NODE_ENV !== "production" || ALLOW_DEV_IMPERSONATE === "1"`.

Signs in via `signIn("dev-impersonate", { email, name, isAdmin,
redirectTo: "/" })`. Auth.js overwrites the JWT cookie — no explicit
`signOut` needed first. Rationale: switching personas is the tightest
loop during multi-user testing; bouncing through `/login` every time
is friction.

---

## Settings structure

Settings is split into four sub-sections under `/settings`:

| Path | Scope | Who sees it |
|------|-------|-------------|
| `/settings/profile` | User's own name, avatar, email | Everyone |
| `/settings/account` | Password, 2FA, email prefs, sessions | Everyone |
| `/settings/org` | Org name, slug, plan/billing view, members | Everyone in the org (details); org owners/admins (edits) |
| `/settings/org-admin` | Destructive / privileged: invite, role changes, delete org, API tokens | Org role `owner` or `admin` only |

User Menu's **Settings** item jumps to `/settings/profile`. The
settings shell is a sub-tab layout; tabs the user isn't authorized
for are hidden, not greyed.

### Platform-admin (open question)

Separate from org-admin: **platform** admins (`users.isAdmin === true`)
govern global catalog, interface types, taxonomy curation, and
cross-org moderation. These don't belong under `/settings/*` — they
touch shared data, not an org's data.

Proposed: dedicated `/admin` shell, linked from the user menu as a
separate item (visible only when `session.user.isAdmin`). Keeps org
settings and platform settings distinct so a user who is admin of
their org but *not* a platform admin doesn't see platform controls.

**Decision needed:** confirm the `/admin` vs `/settings/org-admin`
split is the right shape, or collapse into one tabbed shell with
role-gated tabs.

---

## Billing

Plan badge in the menu header links to `/billing`. **Not yet
designed.** Todo items before this becomes a real route:

- Payment provider choice (Stripe vs Paddle vs self-hosted).
- Plan tiers + limits (free / pro / team / ...). Current DB enum is
  `["free", "pro", "paid"]` — needs a proper plan catalog table if
  tiers grow.
- Org-level vs user-level billing. Current model: billing is per-org
  (org has a `plan`), so `/billing` is really an org-scoped view and
  could live at `/settings/org/billing` instead of a top-level route.
- Invoice history, seat management, trial flows — all open.

Ship the menu affordance pointing at a placeholder route; do the real
design work as its own specify → survey → converge loop.

---

## Out of scope (for this spec)

- Profile editing UI details — covered in `/settings/profile` spec
  (to be written).
- Multi-org switching — the current model puts dev personas in the
  shared `default` org; production orgs will need an org switcher
  when that changes. Separate spec.
- MFA prompts, session timeout warnings.

---

## Open questions

1. **Collapsed-sidebar behavior** — pending UI-kit reference
   (claude.ai design link provided but auth-gated; paste or summarize
   when available).
2. **`/admin` vs `/settings/org-admin` split** — see Settings
   structure → Platform-admin. Confirm the separation.
3. **Billing placement** — top-level `/billing` vs
   `/settings/org/billing`. Tied to the billing design pass.
