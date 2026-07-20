export type PlayerStatus =
  | 'available'
  | 'in-room'
  | 'playing'
  | 'ready'
  | 'waiting'
  | 'eliminated';

export interface Player {
  id: string;
  nickname: string;
  status: PlayerStatus;
  isCurrentUser?: boolean;
  isRoomOwner?: boolean;
  isReady?: boolean;
  isBot?: boolean;
  /** Hex color assigned when joining a room. */
  color?: string;
  remainingShips?: number;
  /** Pontos acumulados na partida atual. */
  score?: number;
}
