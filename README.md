# Batalha Naval

Jogo multiplayer em tempo real (React + Fastify + Socket.IO), pronto para produção em VPS com Docker, Nginx e HTTPS (Let's Encrypt).

## Estrutura

```
batalhanaval/
├── backend/                 # API Fastify + Socket.IO
├── frontend/                # SPA React (Vite)
├── nginx/                   # Reverse proxy + TLS
│   ├── nginx.conf
│   ├── conf.d/app.conf.template
│   └── ssl/
├── certbot/                 # Certificados Let's Encrypt (gerados no servidor)
├── scripts/
│   ├── setup-server.sh      # Instala Docker e prepara o VPS
│   └── init-ssl.sh          # Emite certificado HTTPS
├── docker-compose.prod.yml  # Stack de produção
├── .env.example
└── .gitignore
```

## Pré-requisitos no VPS

- Ubuntu 22.04+ (ou Debian equivalente)
- Domínio com DNS **A** apontando para o IP do VPS
- Portas **80** e **443** liberadas

---

## 1. Preparar o servidor

No VPS, como root:

```bash
# Atualiza o sistema e instala Docker + Compose
apt-get update -y
apt-get install -y ca-certificates curl gnupg git openssl

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
> /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

# Firewall (opcional, se usar ufw)
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Ou use o script do projeto (depois de clonar):

```bash
bash scripts/setup-server.sh
```

Com clone automático:

```bash
REPO_URL="https://github.com/SEU_USUARIO/batalhanaval.git" bash scripts/setup-server.sh
```

---

## 2. Colocar o código no servidor

```bash
mkdir -p /opt/batalhanaval
cd /opt/batalhanaval

# Opção A — Git
git clone https://github.com/SEU_USUARIO/batalhanaval.git .

# Opção B — Upload (scp/rsync a partir da sua máquina)
# rsync -avz --exclude node_modules --exclude dist ./ usuario@IP_DO_VPS:/opt/batalhanaval/
```

---

## 3. Configurar o ambiente

```bash
cd /opt/batalhanaval
cp .env.example .env
nano .env
```

Preencha com o seu domínio real:

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

> `VITE_*` entra no **build** do frontend. Se mudar o domínio depois, rode de novo com `--build`.

---

## 4. Certificados Nginx (Let's Encrypt)

```bash
chmod +x scripts/*.sh
bash scripts/init-ssl.sh
```

O script:

1. Gera `nginx/conf.d/app.conf` a partir do template
2. Sobe o Nginx com certificado temporário
3. Emite o certificado real via Certbot (HTTP-01)
4. Recarrega o Nginx com HTTPS

Certificados ficam em `certbot/conf/live/<DOMAIN>/` (não versionados).

---

## 5. Subir o Compose de produção

Comandos para criar/iniciar o stack **dentro do servidor**:

```bash
cd /opt/batalhanaval

# Build + sobe em background (restart automático)
docker compose -f docker-compose.prod.yml up -d --build

# Conferir containers
docker compose -f docker-compose.prod.yml ps

# Logs ao vivo
docker compose -f docker-compose.prod.yml logs -f

# Parar
docker compose -f docker-compose.prod.yml down

# Atualizar após git pull
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Serviços:

| Serviço   | Função                                      | Porta externa |
|-----------|---------------------------------------------|---------------|
| `nginx`   | Proxy reverso + TLS                         | 80, 443       |
| `frontend`| SPA estática (nginx interno)                | interna       |
| `api`     | Fastify + Socket.IO                         | interna       |
| `certbot` | Renovação automática do certificado (~12h)  | —             |

Acesse: `https://seu-dominio.com`

---

## 6. Deixar rodando (persistência)

Os serviços usam `restart: unless-stopped`. Com o Docker ativo no boot:

```bash
systemctl enable docker
```

Após reboot do VPS, os containers sobem sozinhos.

Úteis:

```bash
# Status
docker compose -f docker-compose.prod.yml ps

# Health da API (via Nginx)
curl -fsS https://seu-dominio.com/health

# Reiniciar só a API
docker compose -f docker-compose.prod.yml restart api
```

---

## Desenvolvimento local

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API em `http://localhost:3333`.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App em `http://localhost:5173`.

### Backend só com Docker (dev)

```bash
cd backend
docker compose up --build
```

---

## Rotas expostas pelo Nginx

- `/` → frontend (SPA)
- `/health` → API
- `/rooms` → API
- `/socket.io/` → Socket.IO (WebSocket)

---

## Troubleshooting

**Certificado falhou**  
Confirme DNS apontando para o VPS e portas 80/443 abertas. Rode `bash scripts/init-ssl.sh` de novo.

**Frontend conecta no host errado**  
Ajuste `VITE_WS_URL` / `VITE_API_URL` no `.env` e rebuild:

```bash
docker compose -f docker-compose.prod.yml up -d --build frontend
```

**CORS**  
`CORS_ORIGIN` no `.env` deve ser exatamente a origem HTTPS do site (ex.: `https://batalha.marcelokevin.com.br`).

**Ver config gerada do Nginx**

```bash
cat nginx/conf.d/app.conf
docker compose -f docker-compose.prod.yml exec nginx nginx -t
```
