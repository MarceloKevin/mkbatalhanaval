/**
 * Serviço de salas — simulado com dados mockados.
 * Futuramente, substituir as implementações por chamadas HTTP ao backend Node.js.
 */

import { MOCK_ROOMS } from '../data/mockData';
import type { Player } from '../types/player';
import type { CreateRoomPayload, Room, RoomStatus } from '../types/room';
import { delay, generateId } from '../utils/boardHelpers';
import { BOT_NICKNAMES, MOCK_DELAY_MS, PLAYER_COLORS } from '../utils/constants';

let roomsStore: Room[] = structuredClone(MOCK_ROOMS);
let botNameIndex = 0;

function pickAvailableColor(taken: Array<string | undefined>): string {
  const used = new Set(taken.filter(Boolean));
  const free = PLAYER_COLORS.filter((color) => !used.has(color));
  const pool = free.length > 0 ? free : [...PLAYER_COLORS];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function computeRoomStatus(room: Room): RoomStatus {
  if (room.status === 'playing' && room.matchId) return 'playing';
  const count = room.players.length;
  if (count >= room.maxPlayers) return 'full';
  if (count >= room.maxPlayers - 1) return 'almost-full';
  return 'waiting';
}

function createBotPlayer(
  excludeNicknames: string[] = [],
  takenColors: Array<string | undefined> = [],
): Player {
  const available = BOT_NICKNAMES.filter((name) => !excludeNicknames.includes(name));
  const pool = available.length > 0 ? available : [...BOT_NICKNAMES];
  const nickname = pool[botNameIndex % pool.length];
  botNameIndex += 1;

  return {
    id: generateId('bot'),
    nickname,
    status: 'ready',
    isReady: true,
    isRoomOwner: false,
    isBot: true,
    color: pickAvailableColor(takenColors),
  };
}

function assertRoomOwner(room: Room, ownerId: string): void {
  if (room.ownerId !== ownerId) {
    throw new Error('Apenas o dono da sala pode realizar esta ação.');
  }
}

function updateRoomInStore(roomIndex: number, room: Room): Room {
  const updated = { ...room, status: computeRoomStatus(room) };
  roomsStore[roomIndex] = updated;
  return structuredClone(updated);
}

export async function getRooms(): Promise<Room[]> {
  // TODO: GET /api/rooms
  await delay(MOCK_DELAY_MS);
  return structuredClone(roomsStore);
}

export async function getRoomById(roomId: string): Promise<Room | null> {
  // TODO: GET /api/rooms/:roomId
  await delay(MOCK_DELAY_MS);
  const room = roomsStore.find((r) => r.id === roomId);
  return room ? structuredClone(room) : null;
}

export async function createRoom(
  payload: CreateRoomPayload,
  owner: Player,
): Promise<Room> {
  // TODO: POST /api/rooms
  await delay(MOCK_DELAY_MS);

  const ownerColor = pickAvailableColor([]);
  const newRoom: Room = {
    id: generateId('room'),
    name: payload.name.trim(),
    ownerId: owner.id,
    ownerNickname: owner.nickname,
    maxPlayers: payload.maxPlayers,
    isPrivate: payload.isPrivate,
    status: 'waiting',
    players: [
      {
        ...owner,
        isRoomOwner: true,
        isReady: true,
        status: 'ready',
        isBot: false,
        color: ownerColor,
      },
      createBotPlayer([owner.nickname], [ownerColor]),
    ],
  };

  roomsStore = [newRoom, ...roomsStore];
  return structuredClone(newRoom);
}

export async function joinRoom(
  roomId: string,
  player: Player,
): Promise<Room> {
  // TODO: POST /api/rooms/:roomId/join
  await delay(MOCK_DELAY_MS);

  const roomIndex = roomsStore.findIndex((r) => r.id === roomId);
  if (roomIndex === -1) {
    throw new Error('Sala não encontrada.');
  }

  const room = roomsStore[roomIndex];

  if (room.status === 'playing') {
    throw new Error('A partida já começou.');
  }

  if (room.players.length >= room.maxPlayers) {
    throw new Error('A sala está cheia.');
  }

  const alreadyIn = room.players.some((p) => p.id === player.id);
  if (!alreadyIn) {
    const updated: Room = {
      ...room,
      players: [
        ...room.players,
        {
          ...player,
          isRoomOwner: false,
          isReady: false,
          status: 'waiting',
          color: pickAvailableColor(room.players.map((p) => p.color)),
        },
      ],
    };
    updated.status = computeRoomStatus(updated);
    roomsStore[roomIndex] = updated;
  }

  return structuredClone(roomsStore[roomIndex]);
}

export async function leaveRoom(
  roomId: string,
  playerId: string,
): Promise<void> {
  // TODO: POST /api/rooms/:roomId/leave
  await delay(MOCK_DELAY_MS);

  const roomIndex = roomsStore.findIndex((r) => r.id === roomId);
  if (roomIndex === -1) return;

  const room = roomsStore[roomIndex];
  const remaining = room.players.filter((p) => p.id !== playerId);

  const hasHumanRemaining = remaining.some((p) => !p.isBot);
  if (remaining.length === 0 || !hasHumanRemaining) {
    roomsStore = roomsStore.filter((r) => r.id !== roomId);
    return;
  }

  const ownerLeft = room.ownerId === playerId;
  const newOwner = ownerLeft
    ? remaining.find((p) => !p.isBot) ?? remaining[0]
    : remaining.find((p) => p.id === room.ownerId);

  const updated: Room = {
    ...room,
    players: remaining.map((p) => ({
      ...p,
      isRoomOwner: p.id === newOwner?.id,
    })),
    ownerId: newOwner?.id ?? room.ownerId,
    ownerNickname: newOwner?.nickname ?? room.ownerNickname,
  };

  if (updated.status !== 'playing') {
    updated.status = computeRoomStatus(updated);
  }

  roomsStore[roomIndex] = updated;
}

export async function toggleReady(
  roomId: string,
  playerId: string,
): Promise<Room> {
  // TODO: POST /api/rooms/:roomId/ready
  await delay(200);

  const roomIndex = roomsStore.findIndex((r) => r.id === roomId);
  if (roomIndex === -1) {
    throw new Error('Sala não encontrada.');
  }

  const room = roomsStore[roomIndex];
  const updated: Room = {
    ...room,
    players: room.players.map((p) => {
      if (p.id !== playerId) return p;
      const isReady = !p.isReady;
      return {
        ...p,
        isReady,
        status: isReady ? 'ready' : 'waiting',
      };
    }),
  };

  roomsStore[roomIndex] = updated;
  return structuredClone(updated);
}

export async function kickPlayer(
  roomId: string,
  ownerId: string,
  targetPlayerId: string,
): Promise<Room> {
  // TODO: POST /api/rooms/:roomId/kick
  await delay(MOCK_DELAY_MS);

  const roomIndex = roomsStore.findIndex((r) => r.id === roomId);
  if (roomIndex === -1) {
    throw new Error('Sala não encontrada.');
  }

  const room = roomsStore[roomIndex];
  assertRoomOwner(room, ownerId);

  if (targetPlayerId === ownerId) {
    throw new Error('Você não pode expulsar a si mesmo.');
  }

  const target = room.players.find((p) => p.id === targetPlayerId);
  if (!target) {
    throw new Error('Jogador não encontrado na sala.');
  }

  if (target.isRoomOwner) {
    throw new Error('Não é possível expulsar o dono da sala.');
  }

  return updateRoomInStore(roomIndex, {
    ...room,
    players: room.players.filter((p) => p.id !== targetPlayerId),
  });
}

export async function addBot(
  roomId: string,
  ownerId: string,
): Promise<Room> {
  // TODO: POST /api/rooms/:roomId/bots
  await delay(MOCK_DELAY_MS);

  const roomIndex = roomsStore.findIndex((r) => r.id === roomId);
  if (roomIndex === -1) {
    throw new Error('Sala não encontrada.');
  }

  const room = roomsStore[roomIndex];
  assertRoomOwner(room, ownerId);

  if (room.status === 'playing') {
    throw new Error('A partida já começou.');
  }

  if (room.players.length >= room.maxPlayers) {
    throw new Error('A sala está cheia.');
  }

  const bot = createBotPlayer(
    room.players.map((p) => p.nickname),
    room.players.map((p) => p.color),
  );

  return updateRoomInStore(roomIndex, {
    ...room,
    players: [...room.players, bot],
  });
}

export async function replacePlayerWithBot(
  roomId: string,
  ownerId: string,
  targetPlayerId: string,
): Promise<Room> {
  // TODO: POST /api/rooms/:roomId/replace-with-bot
  await delay(MOCK_DELAY_MS);

  const roomIndex = roomsStore.findIndex((r) => r.id === roomId);
  if (roomIndex === -1) {
    throw new Error('Sala não encontrada.');
  }

  const room = roomsStore[roomIndex];
  assertRoomOwner(room, ownerId);

  const targetIndex = room.players.findIndex((p) => p.id === targetPlayerId);
  if (targetIndex === -1) {
    throw new Error('Jogador não encontrado na sala.');
  }

  const target = room.players[targetIndex];

  if (target.isRoomOwner) {
    throw new Error('Não é possível substituir o dono da sala.');
  }

  if (target.isBot) {
    throw new Error('Este ocupante já é um bot.');
  }

  const remaining = room.players.filter((p) => p.id !== targetPlayerId);
  const bot = createBotPlayer(
    remaining.map((p) => p.nickname),
    remaining.map((p) => p.color),
  );

  const players = [...room.players];
  players[targetIndex] = bot;

  return updateRoomInStore(roomIndex, { ...room, players });
}

export function resetRoomsStore(): void {
  roomsStore = structuredClone(MOCK_ROOMS);
  botNameIndex = 0;
}
