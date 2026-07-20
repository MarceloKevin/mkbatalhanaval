import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Server as SocketServer } from 'socket.io';
import type { Env } from '../config/env.js';
import { isAppError, toErrorMessage, AppError } from '../shared/errors/app-error.js';
import type { GameService } from '../modules/game/game.service.js';
import type { PlayerService } from '../modules/players/player.service.js';
import type { RoomService } from '../modules/rooms/room.service.js';
import {
  attackSchema,
  createRoomSchema,
  joinRoomSchema,
  kickSchema,
  matchIdSchema,
  nicknameSchema,
  readySchema,
  renamePlayerSchema,
  replaceBotSchema,
  roomIdSchema,
  setColorSchema,
  updateRoomSchema,
} from '../modules/rooms/room.schemas.js';

export interface SocketServices {
  env: Env;
  players: PlayerService;
  rooms: RoomService;
  game: GameService;
}

export type AckCallback = (response: {
  success: boolean;
  data?: unknown;
  code?: string;
  message?: string;
}) => void;

declare module 'socket.io' {
  interface SocketData {
    playerId: string;
    sessionId: string;
    nickname: string;
  }
}

/** Socket.IO may pass (payload, ack) or just (ack). Normalize both. */
function resolveAck(
  payloadOrAck: unknown,
  maybeAck?: unknown,
): { payload: unknown; callback?: AckCallback } {
  if (typeof payloadOrAck === 'function') {
    return { payload: undefined, callback: payloadOrAck as AckCallback };
  }
  if (typeof maybeAck === 'function') {
    return { payload: payloadOrAck, callback: maybeAck as AckCallback };
  }
  return { payload: payloadOrAck };
}

function ackError(
  callback: AckCallback | undefined,
  error: unknown,
  fallback: string,
): void {
  if (typeof callback !== 'function') return;
  if (isAppError(error)) {
    callback({
      success: false,
      code: error.code,
      message: error.message,
    });
    return;
  }
  callback({
    success: false,
    code: 'INTERNAL_ERROR',
    message: toErrorMessage(error, fallback),
  });
}

function ackOk(callback: AckCallback | undefined, data?: unknown): void {
  if (typeof callback !== 'function') return;
  callback({ success: true, data });
}

function emitLobbyState(io: SocketServer, services: SocketServices): void {
  io.to('lobby').emit('lobby:state', {
    players: services.players.listOnline(),
    rooms: services.rooms.listPublicRooms(),
  });
  io.to('lobby').emit(
    'lobby:players-updated',
    services.players.listOnline(),
  );
  io.to('lobby').emit(
    'lobby:rooms-updated',
    services.rooms.listPublicRooms(),
  );
}

async function handleBotTurns(
  io: SocketServer,
  services: SocketServices,
  matchId: string,
): Promise<void> {
  // Process consecutive bot turns with a short delay for UX.
  for (let i = 0; i < 16; i += 1) {
    const target = services.game.getBotAttackTarget(matchId);
    if (!target) break;

    await new Promise((resolve) => setTimeout(resolve, 700));
    const result = await services.game.attack({
      matchId,
      attackerId: target.attackerId,
      row: target.row,
      column: target.column,
    });

    io.to(`match:${matchId}`).emit('game:attack-result', result);
    io.to(`match:${matchId}`).emit('game:turn-changed', {
      matchId,
      currentTurnPlayerId: result.nextTurnPlayerId,
      round: result.round,
      turnStartedAt: result.turnStartedAt,
    });

    if (result.eliminatedPlayerId) {
      io.to(`match:${matchId}`).emit('game:player-eliminated', {
        matchId,
        playerId: result.eliminatedPlayerId,
      });
    }

    if (result.finished) {
      io.to(`match:${matchId}`).emit('game:finished', {
        matchId,
        winnerId: result.winnerId,
      });
      break;
    }
  }
}

export function createGameServiceCallbacks(
  getIo: () => SocketServer | null,
  getServices: () => SocketServices,
) {
  return {
    onTurnTimeout: (matchId: string) => {
      void (async () => {
        const io = getIo();
        const services = getServices();
        if (!io) return;

        const skipped = await services.game.skipTurn(
          matchId,
          'Tempo de turno esgotado.',
        );
        if (!skipped) return;

        io.to(`match:${matchId}`).emit('game:turn-changed', {
          matchId,
          currentTurnPlayerId: skipped.match.currentTurnPlayerId,
          round: skipped.match.round,
          turnStartedAt: skipped.match.turnStartedAt,
          historyEntry: skipped.historyEntry,
        });

        await handleBotTurns(io, services, matchId);
      })();
    },
  };
}

const socketPlugin: FastifyPluginAsync<{ services: SocketServices }> = async (
  app,
  opts,
) => {
  const { services } = opts;

  const io = new SocketServer(app.server, {
    cors: {
      origin: services.env.CORS_ORIGIN.split(',').map((value) => value.trim()),
      methods: ['GET', 'POST'],
    },
  });

  app.decorate('io', io);

  io.use((socket, next) => {
    try {
      const nickname = nicknameSchema.parse(socket.handshake.auth.nickname);
      const sessionId =
        typeof socket.handshake.auth.sessionId === 'string'
          ? socket.handshake.auth.sessionId
          : undefined;

      const player = services.players.connect({
        nickname,
        sessionId,
        socketId: socket.id,
      });

      socket.data.playerId = player.playerId;
      socket.data.sessionId = player.sessionId;
      socket.data.nickname = player.nickname;
      next();
    } catch (error) {
      if (isAppError(error)) {
        next(new Error(error.message));
        return;
      }
      next(new Error(toErrorMessage(error, 'Falha na autenticação.')));
    }
  });

  io.on('connection', (socket) => {
    socket.join('lobby');
    socket.join(`player:${socket.data.playerId}`);

    socket.emit('session:ready', {
      playerId: socket.data.playerId,
      sessionId: socket.data.sessionId,
      nickname: socket.data.nickname,
    });

    emitLobbyState(io, services);

    // Restore room/match rooms on reconnect
    try {
      const player = services.players.getById(socket.data.playerId);
      if (player.roomId) {
        socket.join(`room:${player.roomId}`);
      }
      if (player.matchId) {
        socket.join(`match:${player.matchId}`);
        socket.emit(
          'game:state',
          services.game.getPublicState(player.matchId, player.playerId),
        );
      }
    } catch {
      // ignore restore errors for fresh sessions
    }

    socket.on('lobby:get-state', (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        ackOk(callback, {
          players: services.players.listOnline(),
          rooms: services.rooms.listPublicRooms(),
        });
        emitLobbyState(io, services);
      } catch (error) {
        ackError(callback, error, 'Não foi possível obter o lobby.');
      }
    });

    socket.on('lobby:join', (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        // Already joined on connection; keep for API compatibility.
        ackOk(callback, {
          playerId: socket.data.playerId,
          sessionId: socket.data.sessionId,
        });
        emitLobbyState(io, services);
      } catch (error) {
        ackError(callback, error, 'Não foi possível entrar no lobby.');
      }
    });

    socket.on('player:rename', (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        const data = renamePlayerSchema.parse(payload);
        const player = services.players.rename(
          socket.data.playerId,
          data.nickname,
        );
        socket.data.nickname = player.nickname;

        const room = services.rooms.syncPlayerNickname(
          player.playerId,
          player.nickname,
        );

        ackOk(callback, {
          nickname: player.nickname,
          playerId: player.playerId,
          room,
        });

        io.to('lobby').emit(
          'lobby:players-updated',
          services.players.listOnline(),
        );

        if (room) {
          io.to(`room:${room.id}`).emit('room:updated', room);
          io.to('lobby').emit(
            'lobby:rooms-updated',
            services.rooms.listPublicRooms(),
          );
        }
      } catch (error) {
        ackError(callback, error, 'Não foi possível alterar o nickname.');
      }
    });

    socket.on('room:create', (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        const data = createRoomSchema.parse(payload);
        const room = services.rooms.createRoom(socket.data.playerId, data);
        socket.join(`room:${room.id}`);
        ackOk(callback, { room });
        io.to('lobby').emit(
          'lobby:rooms-updated',
          services.rooms.listPublicRooms(),
        );
        io.to(`room:${room.id}`).emit('room:updated', room);
        io.to('lobby').emit(
          'lobby:players-updated',
          services.players.listOnline(),
        );
      } catch (error) {
        ackError(callback, error, 'Não foi possível criar a sala.');
      }
    });

    socket.on('room:update', (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        const data = updateRoomSchema.parse(payload);
        const room = services.rooms.updateRoom(
          data.roomId,
          socket.data.playerId,
          data,
        );
        ackOk(callback, { room });
        io.to(`room:${room.id}`).emit('room:updated', room);
        io.to('lobby').emit(
          'lobby:rooms-updated',
          services.rooms.listPublicRooms(),
        );
      } catch (error) {
        ackError(callback, error, 'Não foi possível atualizar a sala.');
      }
    });

    socket.on('room:join', (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        const data = joinRoomSchema.parse(payload);
        const room = services.rooms.joinRoom(
          data.roomId,
          socket.data.playerId,
          data.password,
        );
        socket.join(`room:${room.id}`);
        ackOk(callback, { room });
        io.to(`room:${room.id}`).emit('room:updated', room);
        io.to('lobby').emit(
          'lobby:rooms-updated',
          services.rooms.listPublicRooms(),
        );
        io.to('lobby').emit(
          'lobby:players-updated',
          services.players.listOnline(),
        );
      } catch (error) {
        ackError(callback, error, 'Não foi possível entrar na sala.');
      }
    });

    socket.on('room:leave', async (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        const data = roomIdSchema.parse(payload);
        const playerId = socket.data.playerId;
        const previousRoom = services.rooms.getPublicRoom(data.roomId);
        const matchId = previousRoom.matchId ?? null;

        let leaveResult: Awaited<
          ReturnType<typeof services.game.leaveMatch>
        > = null;

        if (previousRoom.status === 'playing' && matchId) {
          leaveResult = await services.game.leaveMatch(matchId, playerId);
        }

        const room = services.rooms.leaveRoom(data.roomId, playerId);
        socket.leave(`room:${data.roomId}`);
        if (matchId) {
          socket.leave(`match:${matchId}`);
        }

        ackOk(callback, { room });

        if (leaveResult && matchId) {
          const { match, leftPlayer, historyEntry, turnChanged, finished } =
            leaveResult;

          io.to(`match:${matchId}`).emit('game:player-left', {
            matchId,
            playerId: leftPlayer.id,
            playerNickname: leftPlayer.nickname,
            players: match.players,
            currentTurnPlayerId: match.currentTurnPlayerId,
            round: match.round,
            turnStartedAt: match.turnStartedAt,
            historyEntry,
            finished,
            winnerId: match.winnerId,
          });

          if (turnChanged && !finished) {
            io.to(`match:${matchId}`).emit('game:turn-changed', {
              matchId,
              currentTurnPlayerId: match.currentTurnPlayerId,
              round: match.round,
              turnStartedAt: match.turnStartedAt,
            });
          }

          if (finished) {
            io.to(`match:${matchId}`).emit('game:finished', {
              matchId,
              winnerId: match.winnerId,
            });
          } else if (turnChanged) {
            await handleBotTurns(io, services, matchId);
          }
        }

        if (room) {
          io.to(`room:${room.id}`).emit('room:updated', room);
        }
        io.to('lobby').emit(
          'lobby:rooms-updated',
          services.rooms.listPublicRooms(),
        );
        io.to('lobby').emit(
          'lobby:players-updated',
          services.players.listOnline(),
        );
      } catch (error) {
        ackError(callback, error, 'Não foi possível sair da sala.');
      }
    });

    socket.on('room:ready', (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        const data = readySchema.parse(payload);
        const room = services.rooms.setReady(
          data.roomId,
          socket.data.playerId,
          data.isReady,
        );
        ackOk(callback, { room });
        io.to(`room:${room.id}`).emit('room:updated', room);
      } catch (error) {
        ackError(callback, error, 'Não foi possível atualizar o status.');
      }
    });

    socket.on('room:set-color', (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        const data = setColorSchema.parse(payload);
        const room = services.rooms.setColor(
          data.roomId,
          socket.data.playerId,
          data.color,
        );
        ackOk(callback, { room });
        io.to(`room:${room.id}`).emit('room:updated', room);
      } catch (error) {
        ackError(callback, error, 'Não foi possível alterar a cor.');
      }
    });

    socket.on('room:kick', (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        const data = kickSchema.parse(payload);
        const result = services.rooms.kickPlayer(
          data.roomId,
          socket.data.playerId,
          data.playerId,
        );
        ackOk(callback, { room: result.room });
        io.to(`room:${result.room.id}`).emit('room:updated', result.room);
        io.to(`player:${data.playerId}`).emit('room:kicked', {
          roomId: result.room.id,
        });
        io.to('lobby').emit(
          'lobby:rooms-updated',
          services.rooms.listPublicRooms(),
        );
      } catch (error) {
        ackError(callback, error, 'Não foi possível expulsar o jogador.');
      }
    });

    socket.on('room:add-bot', (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        const data = roomIdSchema.parse(payload);
        const room = services.rooms.addBot(data.roomId, socket.data.playerId);
        ackOk(callback, { room });
        io.to(`room:${room.id}`).emit('room:updated', room);
        io.to('lobby').emit(
          'lobby:rooms-updated',
          services.rooms.listPublicRooms(),
        );
      } catch (error) {
        ackError(callback, error, 'Não foi possível adicionar o bot.');
      }
    });

    socket.on(
      'room:replace-with-bot',
      (payloadOrAck?: unknown, maybeAck?: unknown) => {
        const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
        try {
          const data = replaceBotSchema.parse(payload);
          const result = services.rooms.replaceWithBot(
            data.roomId,
            socket.data.playerId,
            data.playerId,
          );
          ackOk(callback, { room: result.room });
          io.to(`room:${result.room.id}`).emit('room:updated', result.room);
          io.to(`player:${data.playerId}`).emit('room:kicked', {
            roomId: result.room.id,
            replacedWithBot: true,
          });
          io.to('lobby').emit(
            'lobby:rooms-updated',
            services.rooms.listPublicRooms(),
          );
        } catch (error) {
          ackError(callback, error, 'Não foi possível substituir por bot.');
        }
      },
    );

    socket.on('room:start', async (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        const data = roomIdSchema.parse(payload);
        const { match, states } = services.game.startMatch(
          data.roomId,
          socket.data.playerId,
        );

        const room = services.rooms.getPublicRoom(data.roomId);
        io.to(`room:${room.id}`).emit('room:updated', room);
        io.to(`room:${room.id}`).emit('room:game-started', {
          matchId: match.id,
          roomId: room.id,
        });

        for (const player of match.players) {
          if (player.isBot) continue;
          const playerSocket = [...io.sockets.sockets.values()].find(
            (s) => s.data.playerId === player.id,
          );
          playerSocket?.join(`match:${match.id}`);
          const state = states.get(player.id);
          if (state) {
            io.to(`player:${player.id}`).emit('game:state', state);
          }
        }

        ackOk(callback, { matchId: match.id, roomId: room.id });
        io.to('lobby').emit(
          'lobby:rooms-updated',
          services.rooms.listPublicRooms(),
        );

        await handleBotTurns(io, services, match.id);
      } catch (error) {
        ackError(callback, error, 'Não foi possível iniciar a partida.');
      }
    });

    socket.on(
      'room:next-match',
      async (payloadOrAck?: unknown, maybeAck?: unknown) => {
        const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
        try {
          const data = roomIdSchema.parse(payload);
          const { match, states } = services.game.startNextMatch(
            data.roomId,
            socket.data.playerId,
          );

          const room = services.rooms.getPublicRoom(data.roomId);
          io.to(`room:${room.id}`).emit('room:updated', room);
          io.to(`room:${room.id}`).emit('room:game-started', {
            matchId: match.id,
            roomId: room.id,
          });

          for (const player of match.players) {
            if (player.isBot) continue;
            const playerSocket = [...io.sockets.sockets.values()].find(
              (s) => s.data.playerId === player.id,
            );
            playerSocket?.join(`match:${match.id}`);
            const state = states.get(player.id);
            if (state) {
              io.to(`player:${player.id}`).emit('game:state', state);
            }
          }

          ackOk(callback, { matchId: match.id, roomId: room.id });
          io.to('lobby').emit(
            'lobby:rooms-updated',
            services.rooms.listPublicRooms(),
          );

        await handleBotTurns(io, services, match.id);
      } catch (error) {
        ackError(
          callback,
          error,
          'Não foi possível iniciar a próxima partida.',
        );
      }
    },
    );

    socket.on('room:return', (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        const data = roomIdSchema.parse(payload);
        const currentRoom = services.rooms.getPublicRoom(data.roomId);

        if (currentRoom.matchId) {
          const match = services.game.getMatch(currentRoom.matchId);
          if (match.status !== 'finished') {
            throw new AppError(
              'MATCH_ACTIVE',
              'Só é possível voltar à sala após o fim da partida.',
            );
          }
        }

        const result = services.rooms.returnToWaiting(
          data.roomId,
          socket.data.playerId,
        );

        if (result.previousMatchId) {
          services.game.clearTurnTimer(result.previousMatchId);
          for (const s of io.sockets.sockets.values()) {
            s.leave(`match:${result.previousMatchId}`);
          }
        }

        ackOk(callback, { room: result.room });
        io.to(`room:${result.room.id}`).emit('room:returned', {
          room: result.room,
        });
        io.to(`room:${result.room.id}`).emit('room:updated', result.room);
        io.to('lobby').emit(
          'lobby:rooms-updated',
          services.rooms.listPublicRooms(),
        );
        io.to('lobby').emit(
          'lobby:players-updated',
          services.players.listOnline(),
        );
      } catch (error) {
        ackError(callback, error, 'Não foi possível voltar para a sala.');
      }
    });

    socket.on('game:attack', async (payloadOrAck?: unknown, maybeAck?: unknown) => {
      const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
      try {
        const data = attackSchema.parse(payload);
        const result = await services.game.attack({
          matchId: data.matchId,
          attackerId: socket.data.playerId,
          row: data.row,
          column: data.column,
        });

        ackOk(callback, { result });
        io.to(`match:${data.matchId}`).emit('game:attack-result', result);
        io.to(`match:${data.matchId}`).emit('game:turn-changed', {
          matchId: data.matchId,
          currentTurnPlayerId: result.nextTurnPlayerId,
          round: result.round,
          turnStartedAt: result.turnStartedAt,
        });

        if (result.eliminatedPlayerId) {
          io.to(`match:${data.matchId}`).emit('game:player-eliminated', {
            matchId: data.matchId,
            playerId: result.eliminatedPlayerId,
          });
        }

        if (result.finished) {
          io.to(`match:${data.matchId}`).emit('game:finished', {
            matchId: data.matchId,
            winnerId: result.winnerId,
          });
        } else {
          await handleBotTurns(io, services, data.matchId);
        }
      } catch (error) {
        ackError(callback, error, 'Não foi possível realizar o ataque.');
        socket.emit('game:error', {
          message: toErrorMessage(error, 'Ataque inválido.'),
        });
      }
    });

    socket.on(
      'game:request-state',
      (payloadOrAck?: unknown, maybeAck?: unknown) => {
        const { payload, callback } = resolveAck(payloadOrAck, maybeAck);
        try {
          const data = matchIdSchema.parse(payload);
          const state = services.game.getPublicState(
            data.matchId,
            socket.data.playerId,
          );
          ackOk(callback, { state });
          socket.emit('game:state', state);
        } catch (error) {
          ackError(
            callback,
            error,
            'Não foi possível obter o estado da partida.',
          );
        }
      },
    );

    socket.on('disconnect', () => {
      const player = services.players.markDisconnected(socket.data.playerId);
      if (!player) return;

      io.to('lobby').emit(
        'lobby:players-updated',
        services.players.listOnline(),
      );

      const graceMs = services.env.DISCONNECT_GRACE_MS;
      setTimeout(() => {
        try {
          const current = services.players.getById(player.playerId);
          if (current.connected) return;

          if (current.roomId && current.status !== 'playing') {
            const room = services.rooms.leaveRoom(
              current.roomId,
              current.playerId,
            );
            if (room) {
              io.to(`room:${room.id}`).emit('room:updated', room);
            }
            io.to('lobby').emit(
              'lobby:rooms-updated',
              services.rooms.listPublicRooms(),
            );
          }

          if (current.status !== 'playing') {
            services.players.remove(current.playerId);
          }

          io.to('lobby').emit(
            'lobby:players-updated',
            services.players.listOnline(),
          );
        } catch {
          // player already removed
        }
      }, graceMs);
    });
  });

  app.addHook('onClose', async () => {
    io.close();
  });
};

export default fp(socketPlugin, {
  name: 'socket-io',
});

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketServer;
  }
}
