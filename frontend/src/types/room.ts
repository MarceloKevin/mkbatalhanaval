import type { Player } from './player';

export type RoomStatus = 'waiting' | 'almost-full' | 'full' | 'playing';

export type MaxPlayers = 2 | 4 | 6 | 8;

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  ownerNickname: string;
  players: Player[];
  maxPlayers: MaxPlayers;
  status: RoomStatus;
  isPrivate: boolean;
  matchId?: string | null;
}

export interface CreateRoomPayload {
  name: string;
  maxPlayers: MaxPlayers;
  isPrivate: boolean;
  password?: string;
}

export interface UpdateRoomPayload {
  name: string;
  maxPlayers: MaxPlayers;
  isPrivate: boolean;
  password?: string;
}
