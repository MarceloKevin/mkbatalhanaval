import type { GameRoom } from '../modules/rooms/room.types.js';

export class MemoryRoomRepository {
  private readonly rooms = new Map<string, GameRoom>();

  save(room: GameRoom): void {
    this.rooms.set(room.id, room);
  }

  findById(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  delete(roomId: string): void {
    this.rooms.delete(roomId);
  }

  list(): GameRoom[] {
    return [...this.rooms.values()].sort((a, b) => b.createdAt - a.createdAt);
  }
}
