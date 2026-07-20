import type { Match } from '../modules/game/game.types.js';

export class MemoryMatchRepository {
  private readonly matches = new Map<string, Match>();

  save(match: Match): void {
    this.matches.set(match.id, match);
  }

  findById(matchId: string): Match | undefined {
    return this.matches.get(matchId);
  }

  findByRoomId(roomId: string): Match | undefined {
    return [...this.matches.values()].find((match) => match.roomId === roomId);
  }

  delete(matchId: string): void {
    this.matches.delete(matchId);
  }
}
