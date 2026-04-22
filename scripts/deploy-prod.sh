#!/usr/bin/env bash
# Fast prod deploy from the wheretf-dev LXC. Bypasses GHA for inner-loop
# iteration; GHA still builds the canonical :latest + tagged images on
# push to main.
#
# Assumes:
#   - Run from wheretf-dev LXC (has Docker, has repo at /opt/wheretf).
#   - SSH key-auth from LXC → $PROD_HOST.
#   - $PROD_HOST has /etc/wheretf/prod.env and /opt/wheretf/docker-compose.prod.yml
#     with `image: wheretf/web:${TAG:-latest}` so TAG= hot-swaps.
#
# See specification/deployment.md "Fast-deploy path" for full contract.
set -euo pipefail

PROD_HOST="${PROD_HOST:-wheretf-prod}"
TAG="fastdeploy-$(git rev-parse --short HEAD)"

echo "→ build $TAG"
cd "$(git rev-parse --show-toplevel)/web"
docker build --target runner   -t "wheretf/web:$TAG"     .
docker build --target migrator -t "wheretf/migrate:$TAG" .

echo "→ ship images to $PROD_HOST"
docker save "wheretf/web:$TAG" "wheretf/migrate:$TAG" \
  | ssh "$PROD_HOST" 'docker load'

echo "→ migrate"
ssh "$PROD_HOST" "docker run --rm --env-file /etc/wheretf/prod.env wheretf/migrate:$TAG"

echo "→ swap app container"
ssh "$PROD_HOST" "cd /opt/wheretf && TAG=$TAG docker compose -f docker-compose.prod.yml up -d --no-deps web"

echo "→ readiness"
for i in $(seq 1 30); do
  if ssh "$PROD_HOST" "curl -fsS http://127.0.0.1:3000/api/health/ready" >/dev/null 2>&1; then
    echo "ready after ${i}s ($TAG live)"
    exit 0
  fi
  sleep 1
done
echo "readiness never reached — old container may still be serving" >&2
exit 1
