# Batalha Naval — Frontend

Aplicação React + TypeScript de Batalha Naval online (etapa com dados mockados).

## Stack

- React 19
- TypeScript
- Vite
- React Router DOM
- Lucide React
- CSS Modules
- LocalStorage (nickname)

## Instalação

```bash
npm install
```

## Execução

```bash
npm run dev
```

Build de produção:

```bash
npm run build
npm run preview
```

## Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Página inicial (nickname) |
| `/lobby` | Lobby de jogadores e salas |
| `/sala/:roomId` | Sala de espera |
| `/jogando/:roomId` | Tela da partida |
| `*` | Página não encontrada |

Rotas protegidas redirecionam para `/` se não houver nickname no LocalStorage.

## Arquitetura

```text
src/
├── components/     # UI reutilizável
├── contexts/       # UserContext (estado global)
├── data/           # Dados mockados
├── hooks/          # useLocalStorage, useUser
├── layouts/        # AppLayout
├── pages/          # Home, Lobby, Room, Game, NotFound
├── routes/         # AppRoutes
├── services/       # roomService, gameService, socketService (stubs)
├── types/          # Tipagens TypeScript
└── utils/          # Constantes, validators, helpers
```

## Integração futura com backend

Substituir as implementações mock em:

- `src/services/roomService.ts` — HTTP (salas)
- `src/services/gameService.ts` — HTTP (partida / ataques)
- `src/services/socketService.ts` — Socket.IO / WebSocket

Os métodos já possuem comentários `TODO` indicando os pontos de integração.
