#!/usr/bin/env bash
set -euo pipefail

# Prepara o VPS Ubuntu/Debian para rodar o Batalha Naval em produção.
# Execute como root (ou com sudo) no servidor:
#   curl -fsSL ... | bash
# ou, com o repositório já no servidor:
#   bash scripts/setup-server.sh

APP_DIR="${APP_DIR:-/opt/batalhanaval}"
REPO_URL="${REPO_URL:-}"

echo "==> Atualizando pacotes"
apt-get update -y
apt-get install -y ca-certificates curl gnupg git openssl

echo "==> Instalando Docker Engine + Compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  . /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker

echo "==> Liberando portas 80 e 443 no firewall (se ufw estiver ativo)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  ufw --force enable || true
fi

echo "==> Criando diretório da aplicação em $APP_DIR"
mkdir -p "$APP_DIR"

if [[ -n "$REPO_URL" ]]; then
  if [[ ! -d "$APP_DIR/.git" ]]; then
    git clone "$REPO_URL" "$APP_DIR"
  else
    git -C "$APP_DIR" pull --ff-only || true
  fi
else
  echo "REPO_URL não definido. Copie o projeto manualmente para $APP_DIR"
fi

cd "$APP_DIR"

if [[ ! -f .env && -f .env.example ]]; then
  cp .env.example .env
  echo "Arquivo .env criado. Edite DOMAIN, EMAIL, VITE_* e CORS_ORIGIN."
fi

mkdir -p certbot/www certbot/conf nginx/ssl

if [[ -f nginx/conf.d/app.conf.template && ! -f nginx/conf.d/app.conf ]]; then
  cp nginx/conf.d/app.conf.template nginx/conf.d/app.conf
fi

chmod +x scripts/*.sh 2>/dev/null || true

echo ""
echo "Servidor pronto."
echo ""
echo "Próximos passos:"
echo "  1. cd $APP_DIR"
echo "  2. nano .env   # preencha DOMAIN, EMAIL e URLs https://"
echo "  3. bash scripts/init-ssl.sh"
echo "  4. docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "Ver status: docker compose -f docker-compose.prod.yml ps"
echo "Ver logs:   docker compose -f docker-compose.prod.yml logs -f"
