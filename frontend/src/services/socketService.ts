/**
 * Serviço Socket.IO — conexão real com o backend.
 */

import { io, type Socket } from 'socket.io-client';
import type { CreateRoomPayload, Room } from '../types/room';
import type { Player } from '../types/player';
import type { AttackResult, GameState } from '../types/game';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3333';
const SESSION_STORAGE_KEY = 'batalha-naval-session-id';

export type AckResponse<T = unknown> = {
  success: boolean;
  data?: T;
  code?: string;
  message?: string;
};

type SocketEventHandler = (payload: unknown) => void;

let socket: Socket | null = null;
const handlers = new Map<string, Set<SocketEventHandler>>();

let sessionPlayerId: string | null = null;
let sessionId: string | null =
  typeof localStorage !== 'undefined'
    ? localStorage.getItem(SESSION_STORAGE_KEY)
    : null;

function getSocket(): Socket {
  if (!socket) {
    throw new Error('Socket não conectado.');
  }
  return socket;
}

function emitWithAck<T>(
  event: string,
  payload?: unknown,
): Promise<AckResponse<T>> {
  return new Promise((resolve) => {
    getSocket().emit(event, payload ?? {}, (response: AckResponse<T>) => {
      resolve(
        response ?? {
          success: false,
          message: 'Sem resposta do servidor.',
        },
      );
    });
  });
}

function dispatch(event: string, payload: unknown): void {
  const set = handlers.get(event);
  if (!set) return;
  for (const handler of set) {
    handler(payload);
  }
}

function bindServerEvents(active: Socket): void {
  const events = [
    'session:ready',
    'lobby:state',
    'lobby:players-updated',
    'lobby:rooms-updated',
    'room:updated',
    'room:game-started',
    'room:returned',
    'room:kicked',
    'room:error',
    'game:state',
    'game:attack-result',
    'game:turn-changed',
    'game:player-eliminated',
    'game:player-left',
    'game:finished',
    'game:error',
  ];

  for (const event of events) {
    active.on(event, (payload: unknown) => {
      if (
        event === 'session:ready' &&
        payload &&
        typeof payload === 'object' &&
        'sessionId' in payload &&
        'playerId' in payload
      ) {
        const data = payload as { sessionId: string; playerId: string };
        sessionId = data.sessionId;
        sessionPlayerId = data.playerId;
        localStorage.setItem(SESSION_STORAGE_KEY, data.sessionId);
      }
      dispatch(event, payload);
    });
  }
}

export function getSessionPlayerId(): string | null {
  return sessionPlayerId;
}

export function getSessionId(): string | null {
  return sessionId;
}

export function connectSocket(nickname: string): Promise<void> {
  if (socket?.connected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    socket?.removeAllListeners();
    socket?.disconnect();

    socket = io(WS_URL, {
      autoConnect: true,
      auth: {
        nickname,
        sessionId: sessionId ?? undefined,
      },
    });

    bindServerEvents(socket);

    const onConnect = () => {
      cleanup();
      resolve();
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      socket?.off('connect', onConnect);
      socket?.off('connect_error', onError);
    };

    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
  });
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  handlers.clear();
}

export function isSocketConnected(): boolean {
  return Boolean(socket?.connected);
}

export function onSocketEvent(
  event: string,
  handler: SocketEventHandler,
): () => void {
  if (!handlers.has(event)) {
    handlers.set(event, new Set());
  }
  handlers.get(event)!.add(handler);
  return () => {
    handlers.get(event)?.delete(handler);
  };
}

export async function emitJoinLobby(
  nickname: string,
): Promise<AckResponse> {
  if (!isSocketConnected()) {
    await connectSocket(nickname);
  }
  return emitWithAck('lobby:join', { nickname });
}

export async function emitRenamePlayer(
  nickname: string,
): Promise<AckResponse<{ nickname: string; playerId: string; room?: Room | null }>> {
  return emitWithAck('player:rename', { nickname });
}

export async function emitGetLobbyState(): Promise<
  AckResponse<{ players: Player[]; rooms: Room[] }>
> {
  return emitWithAck('lobby:get-state');
}

export async function emitCreateRoom(
  payload: CreateRoomPayload,
): Promise<AckResponse<{ room: Room }>> {
  return emitWithAck('room:create', payload);
}

export async function emitUpdateRoom(
  roomId: string,
  payload: {
    name: string;
    maxPlayers: number;
    isPrivate: boolean;
    password?: string;
  },
): Promise<AckResponse<{ room: Room }>> {
  return emitWithAck('room:update', { roomId, ...payload });
}

export async function emitJoinRoom(
  roomId: string,
  password?: string,
): Promise<AckResponse<{ room: Room }>> {
  return emitWithAck('room:join', { roomId, password });
}

export async function emitLeaveRoom(
  roomId: string,
): Promise<AckResponse<{ room: Room | null }>> {
  return emitWithAck('room:leave', { roomId });
}

export async function emitPlayerReady(
  roomId: string,
  isReady: boolean,
): Promise<AckResponse<{ room: Room }>> {
  return emitWithAck('room:ready', { roomId, isReady });
}

export async function emitSetPlayerColor(
  roomId: string,
  color: string,
): Promise<AckResponse<{ room: Room }>> {
  return emitWithAck('room:set-color', { roomId, color });
}

export async function emitStartGame(
  roomId: string,
): Promise<AckResponse<{ matchId: string; roomId: string }>> {
  return emitWithAck('room:start', { roomId });
}

export async function emitStartNextMatch(
  roomId: string,
): Promise<AckResponse<{ matchId: string; roomId: string }>> {
  return emitWithAck('room:next-match', { roomId });
}

export async function emitReturnToRoom(
  roomId: string,
): Promise<AckResponse<{ room: Room }>> {
  return emitWithAck('room:return', { roomId });
}

export async function emitKickPlayer(
  roomId: string,
  playerId: string,
): Promise<AckResponse<{ room: Room }>> {
  return emitWithAck('room:kick', { roomId, playerId });
}

export async function emitAddBot(
  roomId: string,
): Promise<AckResponse<{ room: Room }>> {
  return emitWithAck('room:add-bot', { roomId });
}

export async function emitReplaceWithBot(
  roomId: string,
  playerId: string,
): Promise<AckResponse<{ room: Room }>> {
  return emitWithAck('room:replace-with-bot', { roomId, playerId });
}

export async function emitAttack(
  matchId: string,
  row: number,
  column: number,
): Promise<AckResponse<{ result: unknown }>> {
  return emitWithAck('game:attack', { matchId, row, column });
}

export async function emitRequestGameState(
  matchId: string,
): Promise<AckResponse<{ state: GameState }>> {
  return emitWithAck('game:request-state', { matchId });
}

export type { AttackResult };
