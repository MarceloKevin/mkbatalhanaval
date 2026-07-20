import { AppError } from '../../shared/errors/app-error.js';
import { createId } from '../../shared/utils/id.js';
import { nicknameSchema } from '../rooms/room.schemas.js';
import type { PlayerConnection, PublicPlayer } from './player.types.js';
import type { MemoryPlayerRepository } from '../../storage/memory-player.repository.js';

export class PlayerService {
  constructor(private readonly players: MemoryPlayerRepository) {}

  connect(input: {
    nickname: string;
    sessionId?: string;
    socketId: string;
  }): PlayerConnection {
    const nickname = nicknameSchema.parse(input.nickname);

    if (input.sessionId) {
      const existing = this.players.findBySessionId(input.sessionId);
      if (existing) {
        if (
          existing.nickname.toLowerCase() !== nickname.toLowerCase() &&
          this.isNicknameTakenByOther(nickname, existing.playerId)
        ) {
          throw new AppError(
            'NICKNAME_TAKEN',
            'Este nickname já está em uso.',
            409,
          );
        }

        existing.socketId = input.socketId;
        existing.connected = true;
        existing.disconnectedAt = null;
        if (existing.nickname !== nickname) {
          this.players.rename(existing.playerId, nickname);
          return this.getById(existing.playerId);
        }
        this.players.save(existing);
        return existing;
      }
    }

    if (this.isNicknameTakenByOther(nickname)) {
      throw new AppError(
        'NICKNAME_TAKEN',
        'Este nickname já está em uso.',
        409,
      );
    }

    const player: PlayerConnection = {
      playerId: createId('player'),
      sessionId: createId('session'),
      socketId: input.socketId,
      nickname,
      connected: true,
      disconnectedAt: null,
      status: 'available',
      roomId: null,
      matchId: null,
      isBot: false,
    };

    this.players.save(player);
    return player;
  }

  markDisconnected(playerId: string): PlayerConnection | undefined {
    const player = this.players.findById(playerId);
    if (!player) return undefined;

    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = new Date();
    this.players.save(player);
    return player;
  }

  remove(playerId: string): void {
    this.players.delete(playerId);
  }

  getById(playerId: string): PlayerConnection {
    const player = this.players.findById(playerId);
    if (!player) {
      throw new AppError('PLAYER_NOT_FOUND', 'Jogador não encontrado.', 404);
    }
    return player;
  }

  setStatus(
    playerId: string,
    status: PlayerConnection['status'],
    roomId: string | null = null,
    matchId: string | null = null,
  ): PlayerConnection {
    const player = this.getById(playerId);
    player.status = status;
    player.roomId = roomId;
    player.matchId = matchId;
    this.players.save(player);
    return player;
  }

  listOnline(): PublicPlayer[] {
    return this.players.listConnected();
  }

  rename(playerId: string, rawNickname: string): PlayerConnection {
    const nickname = nicknameSchema.parse(rawNickname);
    const player = this.getById(playerId);

    if (player.nickname.toLowerCase() === nickname.toLowerCase()) {
      // Keep casing updates even if only case changed.
      if (player.nickname !== nickname) {
        this.players.rename(playerId, nickname);
      }
      return this.getById(playerId);
    }

    if (this.isNicknameTakenByOther(nickname, playerId)) {
      throw new AppError(
        'NICKNAME_TAKEN',
        'Este nickname já está em uso.',
        409,
      );
    }

    if (player.status === 'playing') {
      throw new AppError(
        'PLAYER_PLAYING',
        'Não é possível trocar o nickname durante a partida.',
      );
    }

    const updated = this.players.rename(playerId, nickname);
    if (!updated) {
      throw new AppError('PLAYER_NOT_FOUND', 'Jogador não encontrado.', 404);
    }
    return updated;
  }

  private isNicknameTakenByOther(
    nickname: string,
    exceptPlayerId?: string,
  ): boolean {
    const existing = this.players.findByNickname(nickname);
    if (!existing) return false;
    if (exceptPlayerId && existing.playerId === exceptPlayerId) return false;
    return existing.connected || existing.roomId !== null;
  }
}
