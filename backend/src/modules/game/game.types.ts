import type { RoomPlayer } from '../rooms/room.types.js';

export type CellStatus =
  | 'water'
  | 'ship'
  | 'miss'
  | 'hit'
  | 'destroyed'
  | 'selected'
  | 'disabled';

export interface BoardCell {
  row: number;
  column: number;
  status: CellStatus;
  shipId?: string;
  ownerId?: string;
}

export type ShipType =
  | 'carrier'
  | 'battleship'
  | 'cruiser'
  | 'submarine'
  | 'destroyer';

export interface Ship {
  id: string;
  type: ShipType;
  name: string;
  size: number;
  hits: number;
  destroyed: boolean;
  ownerId: string;
  cells: Array<{ row: number; column: number }>;
}

export type GameActionType = 'attack' | 'hit' | 'miss' | 'destroyed' | 'system';

export interface GameAction {
  id: string;
  playerNickname: string;
  message: string;
  timestamp: number;
  type: GameActionType;
}

export type MatchStatus = 'active' | 'finished';

export interface Match {
  id: string;
  roomId: string;
  roomName: string;
  players: RoomPlayer[];
  currentTurnPlayerId: string;
  round: number;
  history: GameAction[];
  board: BoardCell[][];
  ships: Ship[];
  rows: number;
  columns: number;
  turnStartedAt: number;
  turnDurationSeconds: number;
  status: MatchStatus;
  winnerId: string | null;
  createdAt: number;
}

export interface AttackResultPayload {
  matchId: string;
  attackerId: string;
  row: number;
  column: number;
  cell: BoardCell;
  hit: boolean;
  destroyed: boolean;
  message: string;
  shipsDestroyedCells?: Array<{ row: number; column: number }>;
  players: RoomPlayer[];
  historyEntry: GameAction;
  eliminatedPlayerId: string | null;
  finished: boolean;
  winnerId: string | null;
  nextTurnPlayerId: string;
  round: number;
  turnStartedAt: number;
}

/** Client-facing match view filtered for one player. */
export interface PublicMatchState {
  matchId: string;
  roomId: string;
  roomName: string;
  players: RoomPlayer[];
  currentTurnPlayerId: string;
  round: number;
  isMyTurn: boolean;
  history: GameAction[];
  board: BoardCell[][];
  ships: Ship[];
  rows: number;
  columns: number;
  turnStartedAt: number;
  turnDurationSeconds: number;
  status: MatchStatus;
  winnerId: string | null;
}
