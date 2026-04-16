#!/bin/bash
# Pre-test check: Docker daemon + Postgres container must be running

if ! docker ps > /dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop on Windows, wait ~15 seconds for WSL2 integration, then retry." >&2
  exit 2
fi

if ! docker ps --filter "name=wheretf-postgres" --filter "status=running" | grep -q postgres; then
  echo "Postgres container is not running. Start it with: docker compose -f docker-compose.dev.yml up -d" >&2
  exit 2
fi
