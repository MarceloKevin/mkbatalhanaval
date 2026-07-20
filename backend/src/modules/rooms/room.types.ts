export type RoomStatus = 'waiting' | 'almost-full' | 'full' | 'playing';

export type MaxPlayers = 2 | 4 | 6 | 8;

export interface RoomPlayer {
  id: string;
  nickname: string;
  status: 'ready' | 'waiting' | 'playing' | 'eliminated';
  isRoomOwner: boolean;
  isReady: boolean;
  isBot: boolean;
  /** Hex color assigned when the player joins the room. */
  color: string;
  remainingShips?: number;
  /** Pontos acumulados na partida atual. */
  score?: number;
}

export interface GameRoom {
  id: string;
  name: string;
  ownerId: string;
  ownerNickname: string;
  players: RoomPlayer[];
  maxPlayers: MaxPlayers;
  status: RoomStatus;
  isPrivate: boolean;
  password?: string;
  matchId: string | null;
  createdAt: number;
}
