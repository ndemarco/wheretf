# Contributing

Glad you're here. WhereTF is a solo-maintained project that welcomes
contributions from anyone who finds it useful. The bar for quality
isn't high — *working* beats *polished* — but there are a few rules
that keep things sane.

## Getting started

1. Fork the repo.
2. Clone your fork, branch from `main`:
   ```bash
   git checkout -b feat/your-thing
   ```
3. Set up a dev env:
   ```bash
   docker compose -f docker-compose.dev.yml up -d   # postgres
   cd web
   npm install
   npm run db:migrate
   npm run dev
   ```
4. Make your change. Small, focused commits are easier to review.
5. Run tests:
   ```bash
   npm run test:backend
   npm run test:frontend
   ```
6. Push and open a pull request.

## What makes a good PR

- **One idea per PR.** Splitting a refactor from a feature change
  makes review tractable.
- **Matches existing patterns.** If you see three places doing
  something a certain way, do it that way too. If you think the
  pattern is wrong, open an issue first.
- **Tests where they matter.** Repository changes should have
  integration tests against real Postgres. UI changes don't need
  tests unless they're non-trivial logic.
- **No formatting PRs.** Not worth the review friction.
- **Passes CI.** `lint`, `test:backend`, `test:frontend`, and the
  Docker build all have to go green.

## What's in scope

Yes:
- Bug fixes.
- UI improvements.
- New storage templates (Gridfinity sizes, common drawer dividers,
  etc. — see `specification/storage-model.md`).
- New taxonomy content (common aspects, standards, designations).
- Documentation improvements.
- Performance fixes.

Usually yes, ping first:
- Schema changes. Coordinate so migrations don't conflict.
- New external dependencies. Node is lean; let's keep it that way.
- Big architectural shifts.

Probably no:
- Auth / multi-tenancy work — there's a plan in
  `specification/deployment.md`, and it's part of the commercial
  hosted service's differentiation. Happy to discuss if you have
  ideas.
- Anything requiring cloud services (AWS, GCP, etc.) as a hard
  dependency. Self-hostability is a feature.
- Adopting a heavy framework (Redux, TanStack Query, etc.). The
  current plain-React-plus-fetch pattern is deliberate.

## License

By contributing, you agree that your code is licensed under the
same AGPL-3.0 as the rest of the project. No CLA — standard
inbound=outbound.

## Commits

- Imperative mood: "Add foo", not "Added foo" or "Adds foo".
- Body explains *why*, not *what* (the diff shows the what).
- No AI attribution. Sign off as yourself.
- Conventional commit prefixes optional but welcome (`feat:`, `fix:`,
  `refactor:`, `docs:`).

## Questions

Open a GitHub issue or discussion before sinking time into
anything big. I'd rather chat first than reject a finished PR.
