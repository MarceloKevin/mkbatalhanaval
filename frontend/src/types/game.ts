import type { Player } from './player';

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

export interface GameAction {
  id: string;
  playerNickname: string;
  message: string;
  timestamp: number;
  type: 'attack' | 'hit' | 'miss' | 'destroyed' | 'system';
}

export interface AttackResult {
  cell: BoardCell;
  hit: boolean;
  destroyed: boolean;
  message: string;
  ships: Ship[];
  players: Player[];
}

export interface GameState {
  matchId: string;
  roomId: string;
  roomName: string;
  players: Player[];
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
  status?: 'active' | 'finished';
  winnerId?: string | null;
}

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}
