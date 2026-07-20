import type { GameRoom, RoomStatus } from './room.types.js';

export function toPublicRoom(room: GameRoom): Omit<GameRoom, 'password'> {
  const { password: _password, ...publicRoom } = room;
  return publicRoom;
}

export function computeRoomStatus(room: GameRoom): RoomStatus {
  if (room.status === 'playing' && room.matchId) return 'playing';
  const count = room.players.length;
  if (count >= room.maxPlayers) return 'full';
  if (count >= room.maxPlayers - 1) return 'almost-full';
  return 'waiting';
}
