# Batalha Naval

Jogo multiplayer em tempo real (React + Fastify + Socket.IO).

Produção neste VPS: **Docker (API + frontend)** atrás do **Nginx do sistema** (portas 80/443), domínio `batalha.marcelokevin.com.br`.

## Arquitetura

```
Internet → Nginx do host (:80/:443)
              ├─ /              → 127.0.0.1:3080  (container frontend)
              ├─ /socket.io/    → 127.0.0.1:3333  (container api)
              ├─ /health        → 127.0.0.1:3333
              └─ /rooms         → 127.0.0.1:3333
```

## Estrutura

```
batalhanaval/
├── backend/
├── frontend/
├── nginx/host/                 # Config para o Nginx do SISTEMA
├── scripts/
│   ├── install-host-nginx.sh   # Site + SSL (Certbot) no host
│   └── deploy.sh               # git pull + rebuild dos containers
├── docker-compose.prod.yml     # Só api + frontend (localhost)
├── .env.example
└── .gitignore
```

## Deploy no VPS (primeira vez)

Pré-requisitos: DNS **A** de `batalha.marcelokevin.com.br` → IP do VPS; Docker instalado; Nginx do sistema nas portas 80/443.

```bash
cd ~/mkbatalhanaval   # pasta do clone

cp -n .env.example .env
# Confira DOMAIN / VITE_* / CORS_ORIGIN

chmod +x scripts/*.sh

# 1) Remove nginx/certbot antigos do compose, sobe api+frontend,
#    instala o site no Nginx do host e emite o certificado
sudo bash scripts/install-host-nginx.sh
```

Acesse: https://batalha.marcelokevin.com.br

## Atualizar depois

```bash
cd ~/mkbatalhanaval
bash scripts/deploy.sh
```

Ou manualmente:

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Compose (referência)

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

| Serviço    | Bind no host        | Função        |
|------------|---------------------|---------------|
| `api`      | `127.0.0.1:3333`    | Fastify + WS  |
| `frontend` | `127.0.0.1:3080`    | SPA estática  |

Não publica 80/443 — isso fica com o Nginx do sistema.

## Variáveis (`.env`)

```env
DOMAIN=batalha.marcelokevin.com.br
EMAIL=contato@marcelokevin.com.br

VITE_WS_URL=https://batalha.marcelokevin.com.br
VITE_API_URL=https://batalha.marcelokevin.com.br

PORT=3333
HOST=0.0.0.0
CORS_ORIGIN=https://batalha.marcelokevin.com.br
NODE_ENV=production
DISCONNECT_GRACE_MS=45000
TURN_DURATION_SECONDS=30
```

> Se mudar `VITE_*`, rebuild obrigatório: `docker compose -f docker-compose.prod.yml up -d --build frontend`

## Desenvolvimento local

### Backend

```bash
cd backend && cp .env.example .env && npm install && npm run dev
```

### Frontend

```bash
cd frontend && cp .env.example .env && npm install && npm run dev
```

## Troubleshooting

**404 no domínio** — o Nginx do host ainda não tem o site, ou o DNS não aponta para o VPS.

```bash
ls /etc/nginx/sites-enabled/
sudo nginx -t
curl -I http://127.0.0.1:3080/
curl -fsS http://127.0.0.1:3333/health
```

**Porta 80 already in use no compose** — não use mais o serviço `nginx` do Docker. Use `install-host-nginx.sh`.

**SSL** — renovação automática via `certbot.timer` do sistema (`sudo certbot renew --dry-run`).
