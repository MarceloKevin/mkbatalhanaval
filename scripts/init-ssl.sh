#!/usr/bin/env bash
set -euo pipefail

# Gera certificado Let's Encrypt e deixa o stack HTTPS pronto.
# Uso: ./scripts/init-ssl.sh
# Requer: .env com DOMAIN e EMAIL preenchidos; DNS apontando para este VPS.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Crie o arquivo .env a partir de .env.example antes de continuar."
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

if [[ -z "${DOMAIN:-}" || -z "${EMAIL:-}" ]]; then
  echo "DOMAIN e EMAIL são obrigatórios no .env"
  exit 1
fi

if [[ -z "$DOMAIN" || "$DOMAIN" == "seudominio.com" ]]; then
  echo "Altere DOMAIN no .env para o seu domínio real."
  exit 1
fi

DATA_PATH="./certbot"
RSA_KEY_SIZE=4096
COMPOSE="docker compose -f docker-compose.prod.yml"

echo "==> Preparando diretórios de certificado"
mkdir -p "$DATA_PATH/www" "$DATA_PATH/conf" "$DATA_PATH/conf/live/$DOMAIN"

echo "==> Gerando nginx/conf.d/app.conf a partir do template"
sed "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" ./nginx/conf.d/app.conf.template \
  > ./nginx/conf.d/app.conf

if [[ ! -f "$DATA_PATH/conf/options-ssl-nginx.conf" ]]; then
  echo "==> Baixando opções SSL recomendadas"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
    > "$DATA_PATH/conf/options-ssl-nginx.conf" || true
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
    > "$DATA_PATH/conf/ssl-dhparams.pem" || true
fi

echo "==> Criando certificado temporário (autoassinado) para o Nginx subir"
mkdir -p "$DATA_PATH/conf/live/$DOMAIN"
if command -v openssl >/dev/null 2>&1; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$DATA_PATH/conf/live/$DOMAIN/privkey.pem" \
    -out "$DATA_PATH/conf/live/$DOMAIN/fullchain.pem" \
    -subj "/CN=$DOMAIN"
else
  docker run --rm \
    -v "$ROOT_DIR/certbot/conf:/etc/letsencrypt" \
    alpine/openssl \
    req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "/etc/letsencrypt/live/$DOMAIN/privkey.pem" \
    -out "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" \
    -subj "/CN=$DOMAIN"
fi

echo "==> Subindo Nginx (HTTP) para o desafio ACME"
$COMPOSE up -d nginx

echo "==> Removendo certificado temporário"
rm -rf "$DATA_PATH/conf/live/$DOMAIN"
rm -rf "$DATA_PATH/conf/archive/$DOMAIN" 2>/dev/null || true
rm -rf "$DATA_PATH/conf/renewal/$DOMAIN.conf" 2>/dev/null || true

echo "==> Solicitando certificado Let's Encrypt para $DOMAIN"
$COMPOSE run --rm --entrypoint certbot certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "$DOMAIN"

echo "==> Recarregando Nginx com o certificado real"
$COMPOSE exec nginx nginx -s reload || $COMPOSE restart nginx

echo ""
echo "SSL configurado com sucesso para https://$DOMAIN"
echo "Agora suba o stack completo:"
echo "  docker compose -f docker-compose.prod.yml up -d --build"
