#!/usr/bin/env bash
set -euo pipefail

# Atualiza o app no VPS (git pull + rebuild) sem mexer no Nginx do host.
# Uso: bash scripts/deploy.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -d .git ]]; then
  echo "==> git pull"
  git pull --ff-only || true
fi

echo "==> docker compose up --build"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> status"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "Health local:"
curl -fsS http://127.0.0.1:3333/health || true
echo ""
