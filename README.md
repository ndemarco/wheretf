# WhereTF

**Remembers where you put your stuff so you don't have to.**

A workshop item tracker for people with more bins than memory. Models
your physical storage (cabinets, drawers, Gridfinity, Plano boxes),
the items inside (screws, resistors, glue, whatever), and the
parametric characteristics that make two items "the same thing" —
so search, dedup, and find-me-that-part-I-saw-last-year all work.

- **Storage:** Modules → Levels → Inserts → Cells. Drag-free grid UI.
- **Items:** name + categories + applied aspects (parameter groups) +
  standards + designations. Parametric, searchable, comparable.
- **Identification:** pick a standard designation (e.g. ISO 4762
  cap screw, M3×0.5×10) and parameter values auto-fill. Generate a
  whole bolt set with one click.
- **Taxonomy audit:** find duplicate aspects, near-duplicate
  parameters, units you forgot to add, enum values you never listed.

Stack: Next.js 16 (App Router, React 19, Tailwind v4) + PostgreSQL +
Drizzle ORM. Dark theme. Single-container deploy. No auth yet — do
not expose to the internet.

---

## Status

**Early. Single-user, homelab-scale.** Core storage + item model +
taxonomy flows work. Multi-tenancy, auth, rate-limiting, and the
hosted service are all planned (see [`specification/deployment.md`](specification/deployment.md)).

Open to contributions — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Quick start (Docker)

Requires Docker Engine ≥ 24 and Docker Compose v2.

```bash
git clone https://github.com/ndemarco/wheretf.git
cd wheretf
docker compose up --build -d
open http://localhost:3000
```

That brings up:
- A throwaway `postgres:16` container with a named volume.
- A one-shot migration task (applies all schema migrations, exits 0).
- The app on port 3000.

Tear down with `docker compose down -v` (the `-v` wipes the DB
volume).

### Running the dev server instead

If you want to hack on the code with hot-reload, use the dev compose:

```bash
docker compose -f docker-compose.dev.yml up -d  # postgres only
cd web
npm install
npm run db:migrate
npm run dev                                      # http://localhost:3000
```

### Tests

```bash
cd web
npm run test:backend    # integration tests against a real postgres
npm run test:frontend   # component + util tests, jsdom
```

Backend tests require `wheretf_test` DB on `localhost:5432`. Safety
guard in `tests/setup.ts` refuses to truncate any DB whose name
doesn't contain `test`.

---

## Deployment

See [`specification/deployment.md`](specification/deployment.md) for
the full contract. Short version:

- Single Docker image published to
  `ghcr.io/ndemarco/wheretf/web:<tag>` and
  `ghcr.io/ndemarco/wheretf/migrate:<tag>`.
- Multi-arch: `linux/amd64` + `linux/arm64`.
- Configured entirely via `DATABASE_URL`. No secrets baked into
  the image.
- `/api/health` (liveness) and `/api/health/ready` (Postgres round-trip).
- Postgres 15–17 supported; 16 is the target.

---

## Docs

Specs live in [`specification/`](specification/).

- [`project-intent.md`](specification/project-intent.md) — what this is
  and why, the mental model.
- [`storage-model.md`](specification/storage-model.md) — storage data
  model (modules, templates, inserts, overrides, paths).
- [`item-taxonomy.md`](specification/item-taxonomy.md) — items,
  parameters, aspects, standards, designations.
- [`deployment.md`](specification/deployment.md) — packaging + deploy
  contract + future-work notes (auth, authz, multi-tenancy).
- [`ui-paradigms.md`](specification/ui-paradigms.md) — cross-cutting
  UI rules.

---

## License

**GNU Affero General Public License v3.0.** See [LICENSE](LICENSE).

In plain terms: you can use, study, modify, and redistribute this
code, including running it as a network service, provided you share
your modifications under the same license. Hosting a modified version
without publishing the source is not permitted.

A separate commercial license is available for organizations that
can't use AGPL. Contact the maintainer.

---

## Name

"WhereTF" — short for *where to find*. Pronounced however you like.
Not endorsed by any regulatory body and mildly sassy on purpose.
