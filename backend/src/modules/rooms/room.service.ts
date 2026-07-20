import {
  BOT_NICKNAMES,
  PLAYER_COLORS,
  type PlayerColor,
} from '../../shared/constants.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createId } from '../../shared/utils/id.js';
import type { MemoryRoomRepository } from '../../storage/memory-room.repository.js';
import type { PlayerService } from '../players/player.service.js';
import type { CreateRoomInput, UpdateRoomInput } from './room.schemas.js';
import { computeRoomStatus, toPublicRoom } from './room.utils.js';
import type { GameRoom, RoomPlayer } from './room.types.js';

export class RoomService {
  private botNameIndex = 0;

  constructor(
    private readonly rooms: MemoryRoomRepository,
    private readonly players: PlayerService,
  ) {}

  listPublicRooms() {
    return this.rooms.list().map(toPublicRoom);
  }

  getPublicRoom(roomId: string) {
    return toPublicRoom(this.getRoom(roomId));
  }

  createRoom(ownerId: string, input: CreateRoomInput) {
    const owner = this.players.getById(ownerId);
    if (owner.roomId) {
      throw new AppError(
        'ALREADY_IN_ROOM',
        'Saia da sala atual antes de criar outra.',
      );
    }

    if (input.isPrivate && !input.password) {
      throw new AppError(
        'PASSWORD_REQUIRED',
        'Salas privadas precisam de senha.',
      );
    }

    const ownerColor = this.pickAvailableColor([]);
    const ownerPlayer: RoomPlayer = {
      id: owner.playerId,
      nickname: owner.nickname,
      status: 'ready',
      isRoomOwner: true,
      isReady: true,
      isBot: false,
      color: ownerColor,
    };

    const room: GameRoom = {
      id: createId('room'),
      name: input.name.trim(),
      ownerId: owner.playerId,
      ownerNickname: owner.nickname,
      maxPlayers: input.maxPlayers,
      isPrivate: input.isPrivate,
      password: input.isPrivate ? input.password : undefined,
      status: 'waiting',
      players: [
        ownerPlayer,
        this.createBotPlayer([owner.nickname], [ownerColor]),
      ],
      matchId: null,
      createdAt: Date.now(),
    };

    room.status = computeRoomStatus(room);
    this.rooms.save(room);
    this.players.setStatus(owner.playerId, 'in-room', room.id, null);

    return toPublicRoom(room);
  }

  updateRoom(roomId: string, ownerId: string, input: UpdateRoomInput) {
    const room = this.getRoom(roomId);
    this.assertOwner(room, ownerId);

    if (room.status === 'playing') {
      throw new AppError(
        'ROOM_PLAYING',
        'Não é possível editar a sala após o início da partida.',
      );
    }

    if (input.maxPlayers < room.players.length) {
      throw new AppError(
        'MAX_PLAYERS_TOO_LOW',
        `Há ${room.players.length} jogadores na sala. Escolha no mínimo esse valor.`,
      );
    }

    if (input.isPrivate) {
      const nextPassword = input.password?.trim() || room.password;
      if (!nextPassword) {
        throw new AppError(
          'PASSWORD_REQUIRED',
          'Salas privadas precisam de senha.',
        );
      }
      room.password = nextPassword;
      room.isPrivate = true;
    } else {
      room.isPrivate = false;
      room.password = undefined;
    }

    room.name = input.name.trim();
    room.maxPlayers = input.maxPlayers;
    room.status = computeRoomStatus(room);
    this.rooms.save(room);

    return toPublicRoom(room);
  }

  joinRoom(roomId: string, playerId: string, password?: string) {
    const room = this.getRoom(roomId);
    const player = this.players.getById(playerId);

    if (player.roomId && player.roomId !== roomId) {
      throw new AppError(
        'ALREADY_IN_ROOM',
        'Saia da sala atual antes de entrar em outra.',
      );
    }

    if (room.status === 'playing') {
      throw new AppError('ROOM_PLAYING', 'A partida já começou.');
    }

    if (room.isPrivate && room.password && room.password !== password) {
      throw new AppError('INVALID_PASSWORD', 'Senha da sala incorreta.', 403);
    }

    const alreadyIn = room.players.some((p) => p.id === playerId);
    if (!alreadyIn) {
      if (room.players.length >= room.maxPlayers) {
        throw new AppError('ROOM_FULL', 'A sala está cheia.');
      }

      room.players.push({
        id: player.playerId,
        nickname: player.nickname,
        status: 'waiting',
        isRoomOwner: false,
        isReady: false,
        isBot: false,
        color: this.pickAvailableColor(room.players.map((p) => p.color)),
      });
      room.status = computeRoomStatus(room);
      this.rooms.save(room);
    }

    this.players.setStatus(player.playerId, 'in-room', room.id, null);
    return toPublicRoom(room);
  }

  setColor(roomId: string, playerId: string, color: PlayerColor) {
    const room = this.getRoom(roomId);
    this.assertPlayerInRoom(room, playerId);

    if (room.status === 'playing') {
      throw new AppError(
        'ROOM_PLAYING',
        'Não é possível trocar a cor após o início da partida.',
      );
    }

    const taken = room.players.some(
      (p) => p.id !== playerId && p.color === color,
    );
    if (taken) {
      throw new AppError(
        'COLOR_TAKEN',
        'Essa cor já está sendo usada por outro jogador.',
      );
    }

    room.players = room.players.map((p) =>
      p.id === playerId ? { ...p, color } : p,
    );
    this.rooms.save(room);
    return toPublicRoom(room);
  }

  leaveRoom(roomId: string, playerId: string) {
    const room = this.rooms.findById(roomId);
    if (!room) return null;

    const remaining = room.players.filter((p) => p.id !== playerId);
    this.players.setStatus(playerId, 'available', null, null);

    const hasHumanRemaining = remaining.some((p) => !p.isBot);
    if (remaining.length === 0 || !hasHumanRemaining) {
      this.rooms.delete(roomId);
      return null;
    }

    const ownerLeft = room.ownerId === playerId;
    const newOwner = ownerLeft
      ? remaining.find((p) => !p.isBot) ?? remaining[0]!
      : remaining.find((p) => p.id === room.ownerId) ?? remaining[0]!;

    room.players = remaining.map((p) => ({
      ...p,
      isRoomOwner: p.id === newOwner.id,
      isReady: p.id === newOwner.id ? true : p.isReady,
      status: p.id === newOwner.id ? 'ready' : p.status,
    }));
    room.ownerId = newOwner.id;
    room.ownerNickname = newOwner.nickname;

    if (room.status !== 'playing') {
      room.status = computeRoomStatus(room);
    }

    this.rooms.save(room);
    return toPublicRoom(room);
  }

  setReady(roomId: string, playerId: string, isReady: boolean) {
    const room = this.getRoom(roomId);
    this.assertPlayerInRoom(room, playerId);

    if (room.status === 'playing') {
      throw new AppError('ROOM_PLAYING', 'A partida já começou.');
    }

    room.players = room.players.map((p) => {
      if (p.id !== playerId) return p;
      return {
        ...p,
        isReady,
        status: isReady ? 'ready' : 'waiting',
      };
    });

    this.rooms.save(room);
    return toPublicRoom(room);
  }

  kickPlayer(roomId: string, ownerId: string, targetPlayerId: string) {
    const room = this.getRoom(roomId);
    this.assertOwner(room, ownerId);

    if (targetPlayerId === ownerId) {
      throw new AppError('INVALID_KICK', 'Você não pode expulsar a si mesmo.');
    }

    const target = room.players.find((p) => p.id === targetPlayerId);
    if (!target) {
      throw new AppError('PLAYER_NOT_IN_ROOM', 'Jogador não encontrado na sala.');
    }

    if (target.isRoomOwner) {
      throw new AppError('INVALID_KICK', 'Não é possível expulsar o dono da sala.');
    }

    room.players = room.players.filter((p) => p.id !== targetPlayerId);
    room.status = computeRoomStatus(room);
    this.rooms.save(room);

    if (!target.isBot) {
      this.players.setStatus(targetPlayerId, 'available', null, null);
    }

    return { room: toPublicRoom(room), kicked: target };
  }

  addBot(roomId: string, ownerId: string) {
    const room = this.getRoom(roomId);
    this.assertOwner(room, ownerId);

    if (room.status === 'playing') {
      throw new AppError('ROOM_PLAYING', 'A partida já começou.');
    }

    if (room.players.length >= room.maxPlayers) {
      throw new AppError('ROOM_FULL', 'A sala está cheia.');
    }

    const bot = this.createBotPlayer(
      room.players.map((p) => p.nickname),
      room.players.map((p) => p.color),
    );
    room.players.push(bot);
    room.status = computeRoomStatus(room);
    this.rooms.save(room);
    return toPublicRoom(room);
  }

  replaceWithBot(roomId: string, ownerId: string, targetPlayerId: string) {
    const room = this.getRoom(roomId);
    this.assertOwner(room, ownerId);

    const targetIndex = room.players.findIndex((p) => p.id === targetPlayerId);
    if (targetIndex === -1) {
      throw new AppError('PLAYER_NOT_IN_ROOM', 'Jogador não encontrado na sala.');
    }

    const target = room.players[targetIndex]!;
    if (target.isRoomOwner) {
      throw new AppError(
        'INVALID_REPLACE',
        'Não é possível substituir o dono da sala.',
      );
    }
    if (target.isBot) {
      throw new AppError('INVALID_REPLACE', 'Este ocupante já é um bot.');
    }

    const remaining = room.players.filter((p) => p.id !== targetPlayerId);
    const bot = this.createBotPlayer(
      remaining.map((p) => p.nickname),
      remaining.map((p) => p.color),
    );

    room.players[targetIndex] = bot;
    room.status = computeRoomStatus(room);
    this.rooms.save(room);
    this.players.setStatus(targetPlayerId, 'available', null, null);

    return {
      room: toPublicRoom(room),
      replaced: target,
      bot,
    };
  }

  markPlaying(roomId: string, matchId: string) {
    const room = this.getRoom(roomId);
    room.status = 'playing';
    room.matchId = matchId;
    room.players = room.players.map((p) => ({
      ...p,
      status: 'playing',
      isReady: true,
    }));
    this.rooms.save(room);

    for (const player of room.players) {
      if (!player.isBot) {
        this.players.setStatus(player.id, 'playing', room.id, matchId);
      }
    }

    return toPublicRoom(room);
  }

  /** Returns the room to waiting lobby state after a finished match. */
  returnToWaiting(roomId: string, playerId: string) {
    const room = this.getRoom(roomId);
    this.assertPlayerInRoom(room, playerId);

    if (room.status !== 'playing') {
      throw new AppError(
        'ROOM_NOT_PLAYING',
        'A sala não está em uma partida.',
      );
    }

    const previousMatchId = room.matchId;

    room.matchId = null;
    room.players = room.players.map((p) => ({
      ...p,
      status: p.isRoomOwner || p.isBot ? 'ready' : 'waiting',
      isReady: p.isRoomOwner || p.isBot,
      remainingShips: undefined,
      score: undefined,
    }));
    room.status = computeRoomStatus(room);
    this.rooms.save(room);

    for (const player of room.players) {
      if (!player.isBot) {
        this.players.setStatus(player.id, 'in-room', room.id, null);
      }
    }

    return {
      room: toPublicRoom(room),
      previousMatchId,
    };
  }

  canStart(roomId: string, ownerId: string): GameRoom {
    const room = this.getRoom(roomId);
    this.assertOwner(room, ownerId);

    if (room.status === 'playing') {
      throw new AppError('ROOM_PLAYING', 'A partida já começou.');
    }

    if (room.players.length < 2) {
      throw new AppError(
        'NOT_ENOUGH_PLAYERS',
        'É necessário pelo menos 2 jogadores.',
      );
    }

    const allReady = room.players.every((p) => p.isReady || p.isRoomOwner);
    if (!allReady) {
      throw new AppError(
        'PLAYERS_NOT_READY',
        'Todos os jogadores precisam estar prontos.',
      );
    }

    return room;
  }

  canRematch(roomId: string, ownerId: string): GameRoom {
    const room = this.getRoom(roomId);
    this.assertOwner(room, ownerId);

    if (room.players.length < 2) {
      throw new AppError(
        'NOT_ENOUGH_PLAYERS',
        'É necessário pelo menos 2 jogadores para continuar.',
      );
    }

    if (!room.matchId) {
      throw new AppError('MATCH_NOT_FOUND', 'Nenhuma partida encontrada.', 404);
    }

    return room;
  }

  getRoom(roomId: string): GameRoom {
    const room = this.rooms.findById(roomId);
    if (!room) {
      throw new AppError('ROOM_NOT_FOUND', 'Sala não encontrada.', 404);
    }
    return room;
  }

  /** Updates a player's nickname inside their current room, if any. */
  syncPlayerNickname(playerId: string, nickname: string) {
    const player = this.players.getById(playerId);
    if (!player.roomId) return null;

    const room = this.rooms.findById(player.roomId);
    if (!room) return null;

    room.players = room.players.map((p) =>
      p.id === playerId ? { ...p, nickname } : p,
    );
    if (room.ownerId === playerId) {
      room.ownerNickname = nickname;
    }
    this.rooms.save(room);
    return toPublicRoom(room);
  }

  private assertOwner(room: GameRoom, ownerId: string): void {
    if (room.ownerId !== ownerId) {
      throw new AppError(
        'NOT_ROOM_OWNER',
        'Apenas o dono da sala pode realizar esta ação.',
        403,
      );
    }
  }

  private assertPlayerInRoom(room: GameRoom, playerId: string): void {
    if (!room.players.some((p) => p.id === playerId)) {
      throw new AppError(
        'PLAYER_NOT_IN_ROOM',
        'Você não está nesta sala.',
        403,
      );
    }
  }

  private createBotPlayer(
    excludeNicknames: string[] = [],
    takenColors: string[] = [],
  ): RoomPlayer {
    const available = BOT_NICKNAMES.filter(
      (name) => !excludeNicknames.includes(name),
    );
    const pool = available.length > 0 ? available : [...BOT_NICKNAMES];
    const nickname = pool[this.botNameIndex % pool.length]!;
    this.botNameIndex += 1;

    return {
      id: createId('bot'),
      nickname,
      status: 'ready',
      isReady: true,
      isRoomOwner: false,
      isBot: true,
      color: this.pickAvailableColor(takenColors),
    };
  }

  private pickAvailableColor(taken: string[]): PlayerColor {
    const free = PLAYER_COLORS.filter((color) => !taken.includes(color));
    const pool = free.length > 0 ? free : [...PLAYER_COLORS];
    return pool[Math.floor(Math.random() * pool.length)]!;
  }
}
