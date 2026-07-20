import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { Server as SocketServer } from 'socket.io';
import type { Env } from './config/env.js';
import { GameService } from './modules/game/game.service.js';
import { PlayerService } from './modules/players/player.service.js';
import { RoomService } from './modules/rooms/room.service.js';
import socketPlugin, {
  createGameServiceCallbacks,
  type SocketServices,
} from './plugins/socket.js';
import { MemoryMatchRepository } from './storage/memory-match.repository.js';
import { MemoryPlayerRepository } from './storage/memory-player.repository.js';
import { MemoryRoomRepository } from './storage/memory-room.repository.js';

export async function buildApp(env: Env) {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((value) => value.trim()),
  });

  const playerRepo = new MemoryPlayerRepository();
  const roomRepo = new MemoryRoomRepository();
  const matchRepo = new MemoryMatchRepository();

  const players = new PlayerService(playerRepo);
  const rooms = new RoomService(roomRepo, players);

  let ioRef: SocketServer | null = null;
  const servicesRef: { current: SocketServices | null } = { current: null };

  const { onTurnTimeout } = createGameServiceCallbacks(
    () => ioRef,
    () => {
      if (!servicesRef.current) {
        throw new Error('Services not ready');
      }
      return servicesRef.current;
    },
  );

  const game = new GameService(matchRepo, rooms, env, onTurnTimeout);

  const services: SocketServices = { env, players, rooms, game };
  servicesRef.current = services;

  await app.register(socketPlugin, { services });
  ioRef = app.io;

  app.get('/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
  }));

  app.post<{
    Body: { nickname?: string };
  }>('/sessions/guest', async (request, reply) => {
    const nickname = request.body?.nickname;
    if (!nickname || typeof nickname !== 'string') {
      return reply.status(400).send({
        success: false,
        message: 'Nickname obrigatório.',
      });
    }

    // Session is finalized on Socket.IO connect; this endpoint only validates.
    return {
      success: true,
      message: 'Conecte via Socket.IO com auth.nickname e auth.sessionId.',
      nickname: nickname.trim(),
    };
  });

  app.get('/rooms', async () => ({
    rooms: rooms.listPublicRooms(),
  }));

  return app;
}
