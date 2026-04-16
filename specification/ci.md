# CI / CD

Pipeline lives in `.gitlab-ci.yml` at the repo root and runs on the
GitLab Runner(s) registered with git.demar.co.

## Stages

| Stage | Job(s) | Runs on |
|-------|--------|---------|
| lint | `lint` (eslint + `tsc --noEmit`) | MR, default branch, tags, `v2-rewrite` |
| test | `test:backend` (postgres:16 service), `test:frontend` | same |
| build | `build:runner`, `build:migrator` (multi-arch via buildx) | same, after lint + test pass |
| deploy | `deploy:prod` (**manual**) | default branch only |

## Runner requirements

- Docker executor, `privileged = true` in `config.toml` (needed for the `docker:26-dind` service + `buildx` emulation).
- `tonistiigi/binfmt --install arm64` has been run on the host so qemu-user-static is present.
- Tagged `docker` (or change `.gitlab-ci.yml`'s `tags:` stanzas to whatever the registered runner uses).
- ≥20 GB free disk for the Docker layer cache.

## Registry

- Uses the built-in GitLab container registry. No configuration in this repo — the pipeline reads `$CI_REGISTRY`, `$CI_REGISTRY_USER`, `$CI_REGISTRY_PASSWORD`, `$CI_REGISTRY_IMAGE` from GitLab's predefined variables.
- Pushes two repos:
  - `$CI_REGISTRY_IMAGE/web` — the runtime image.
  - `$CI_REGISTRY_IMAGE/migrate` — the one-shot migration image.
- Build cache layers live at `$CI_REGISTRY_IMAGE/cache:runner` and `$CI_REGISTRY_IMAGE/cache:migrator` — keeps rebuilds fast.
- Every push tags with `$CI_COMMIT_SHORT_SHA`. On the default branch, also with `latest`.

## Variables

None required to add manually — the pipeline uses only GitLab predefined variables plus the service container's env.

When the deploy hook is wired up, you'll likely add one or two secrets via **Settings → CI/CD → Variables** (masked + protected):

- `DEPLOY_WEBHOOK_URL` — if using an HTTP hook.
- `DEPLOY_WEBHOOK_TOKEN` — bearer token for the hook.
- or `HOMELAB_SSH_KEY` + `HOMELAB_INVENTORY` — if using Ansible-over-SSH.

See the `deploy:prod` job in `.gitlab-ci.yml` for candidate patterns — pick one once the homelab deploy system decides its trigger shape.

## Running locally

```bash
# Pick a job and run it in Docker against your local runner.
gitlab-runner exec docker lint
gitlab-runner exec docker test:frontend
```

`test:backend` and `build:*` need services (postgres, dind) that
`gitlab-runner exec` doesn't wire up — run those via the actual CI, or
approximate locally with plain `docker compose` / `npm test`.

## Adding the runner

If the runner isn't registered yet, ask the homelab AI with the prompt
in [deployment.md § Future work / IdP + infra](deployment.md) — runner
setup is tracked there alongside the other homelab infra tasks.

## Deploy hook (TODO)

The `deploy:prod` job currently echoes the image coordinates and
exits 0. Replace its script once the homelab deploy system exposes a
trigger. See the commented candidates in `.gitlab-ci.yml`.
