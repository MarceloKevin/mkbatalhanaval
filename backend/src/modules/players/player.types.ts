export type PlayerStatus =
  | 'available'
  | 'in-room'
  | 'playing'
  | 'ready'
  | 'waiting'
  | 'eliminated';

export interface PublicPlayer {
  id: string;
  nickname: string;
  status: PlayerStatus;
  isRoomOwner?: boolean;
  isReady?: boolean;
  isBot?: boolean;
  remainingShips?: number;
}

export interface PlayerConnection {
  playerId: string;
  sessionId: string;
  socketId: string | null;
  nickname: string;
  connected: boolean;
  disconnectedAt: Date | null;
  status: PlayerStatus;
  roomId: string | null;
  matchId: string | null;
  isBot: boolean;
}
