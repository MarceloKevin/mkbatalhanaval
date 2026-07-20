export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 20;
export const ROOM_NAME_MIN_LENGTH = 3;
export const ROOM_NAME_MAX_LENGTH = 30;

export const MAX_PLAYERS_OPTIONS = [2, 4, 6, 8] as const;
export type MaxPlayers = (typeof MAX_PLAYERS_OPTIONS)[number];

export const SHIP_DEFINITIONS = [
  { type: 'carrier' as const, name: 'Porta-aviões', size: 5 },
  { type: 'battleship' as const, name: 'Encouraçado', size: 4 },
  { type: 'cruiser' as const, name: 'Cruzador', size: 3 },
  { type: 'submarine' as const, name: 'Submarino', size: 3 },
  { type: 'destroyer' as const, name: 'Destroyer', size: 2 },
] as const;

export const BOT_NICKNAMES = [
  'SeaHunter',
  'OceanMaster',
  'BlueShark',
  'KrakenBR',
  'AdmiralWave',
  'DeepHunter',
  'NavalStorm',
  'TideRider',
  'CoralGhost',
  'WaveBreaker',
] as const;

/** Cores distintas para identificar jogadores na sala e nos hits do tabuleiro. */
export const PLAYER_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

/** Pontuação da partida. */
export const POINTS_HIT = 10;
export const POINTS_DESTROY = 30;
export const POINTS_WIN = 50;
