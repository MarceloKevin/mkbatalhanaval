# Batalha Naval — Backend

API HTTP (Fastify) + tempo real (Socket.IO) para o jogo multiplayer.

## Stack

- Node.js + TypeScript
- Fastify
- Socket.IO
- Zod
- Vitest
- Docker

## Desenvolvimento

```bash
cp .env.example .env
npm install
npm run dev
```

Servidor em `http://localhost:3333`.

- `GET /health`
- `GET /rooms`
- Socket.IO na mesma porta

## Testes

```bash
npm test
```

## Docker

```bash
docker compose up --build
```

## Frontend

No frontend, configure:

```
VITE_WS_URL=http://localhost:3333
```

e rode `npm run dev` na pasta `frontend`.
