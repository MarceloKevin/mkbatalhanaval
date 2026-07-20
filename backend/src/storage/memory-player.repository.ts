import type { PlayerConnection, PublicPlayer } from '../modules/players/player.types.js';

export class MemoryPlayerRepository {
  private readonly byId = new Map<string, PlayerConnection>();
  private readonly bySessionId = new Map<string, string>();
  private readonly nicknameIndex = new Map<string, string>();

  save(player: PlayerConnection): void {
    this.byId.set(player.playerId, player);
    this.bySessionId.set(player.sessionId, player.playerId);
    this.nicknameIndex.set(normalizeNickname(player.nickname), player.playerId);
  }

  /** Persists a nickname change and keeps the nickname index consistent. */
  rename(playerId: string, nextNickname: string): PlayerConnection | undefined {
    const player = this.byId.get(playerId);
    if (!player) return undefined;

    const previousKey = normalizeNickname(player.nickname);
    const nextKey = normalizeNickname(nextNickname);
    if (previousKey !== nextKey) {
      this.nicknameIndex.delete(previousKey);
    }

    player.nickname = nextNickname;
    this.save(player);
    return player;
  }

  findById(playerId: string): PlayerConnection | undefined {
    return this.byId.get(playerId);
  }

  findBySessionId(sessionId: string): PlayerConnection | undefined {
    const playerId = this.bySessionId.get(sessionId);
    return playerId ? this.byId.get(playerId) : undefined;
  }

  findByNickname(nickname: string): PlayerConnection | undefined {
    const playerId = this.nicknameIndex.get(normalizeNickname(nickname));
    return playerId ? this.byId.get(playerId) : undefined;
  }

  delete(playerId: string): void {
    const player = this.byId.get(playerId);
    if (!player) return;
    this.byId.delete(playerId);
    this.bySessionId.delete(player.sessionId);
    this.nicknameIndex.delete(normalizeNickname(player.nickname));
  }

  listConnected(): PublicPlayer[] {
    return [...this.byId.values()]
      .filter((player) => player.connected && !player.isBot)
      .map((player) => ({
        id: player.playerId,
        nickname: player.nickname,
        status: player.status,
      }));
  }

  listAll(): PlayerConnection[] {
    return [...this.byId.values()];
  }
}

function normalizeNickname(nickname: string): string {
  return nickname.trim().toLowerCase();
}
