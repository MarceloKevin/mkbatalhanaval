#!/usr/bin/env bash
set -euo pipefail

# Instala o site no Nginx do HOST e emite certificado Let's Encrypt.
# Uso (no VPS, com sudo):
#   sudo bash scripts/install-host-nginx.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="batalha.marcelokevin.com.br"
SITE_NAME="batalha.marcelokevin.com.br"
AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"
HTTP_CONF="${ROOT_DIR}/nginx/host/${SITE_NAME}.http.conf"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Execute com sudo: sudo bash scripts/install-host-nginx.sh"
  exit 1
fi

if [[ ! -f "$HTTP_CONF" ]]; then
  echo "Arquivo não encontrado: $HTTP_CONF"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "Nginx do sistema não encontrado."
  exit 1
fi

EMAIL="${EMAIL:-}"
if [[ -f "${ROOT_DIR}/.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  source "${ROOT_DIR}/.env"
  set +a
fi

if [[ -z "${EMAIL:-}" ]]; then
  EMAIL="contato@marcelokevin.com.br"
fi

echo "==> Removendo containers antigos do compose que disputavam 80/443 (se existirem)"
cd "$ROOT_DIR"
docker compose -f docker-compose.prod.yml stop nginx certbot 2>/dev/null || true
docker compose -f docker-compose.prod.yml rm -f nginx certbot 2>/dev/null || true
docker rm -f batalhanaval-nginx batalhanaval-certbot 2>/dev/null || true

echo "==> Instalando site HTTP em $AVAILABLE"
cp "$HTTP_CONF" "$AVAILABLE"
ln -sfn "$AVAILABLE" "$ENABLED"

# Evita conflito se o default captura tudo
if [[ -L /etc/nginx/sites-enabled/default ]]; then
  echo "==> (info) site default ainda habilitado — ok se tiver server_name distinto"
fi

echo "==> Testando Nginx"
nginx -t
systemctl reload nginx

echo "==> Subindo API + frontend (localhost)"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Aguardando backends"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:3080/" >/dev/null 2>&1 \
    && curl -fsS "http://127.0.0.1:3333/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! command -v certbot >/dev/null 2>&1; then
  echo "==> Instalando certbot"
  apt-get update -y
  apt-get install -y certbot python3-certbot-nginx
fi

echo "==> Emitindo certificado Let's Encrypt para $DOMAIN"
certbot --nginx \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  --redirect

nginx -t
systemctl reload nginx

echo ""
echo "Pronto: https://${DOMAIN}"
echo "Containers:"
docker compose -f docker-compose.prod.yml ps
