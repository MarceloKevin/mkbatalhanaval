import { createId } from '../../shared/utils/id.js';
import {
  POINTS_DESTROY,
  POINTS_HIT,
  POINTS_WIN,
  SHIP_DEFINITIONS,
} from '../../shared/constants.js';
import type { RoomPlayer } from '../rooms/room.types.js';
import type {
  BoardCell,
  CellStatus,
  GameAction,
  GameActionType,
  Match,
  PublicMatchState,
  Ship,
  ShipType,
} from './game.types.js';

export function createEmptyBoard(rows: number, columns: number): BoardCell[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => ({
      row,
      column,
      status: 'water' as CellStatus,
    })),
  );
}

export function getColumnLabel(index: number): string {
  let result = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

export function getCellLabel(row: number, column: number): string {
  return `${getColumnLabel(column)}${row + 1}`;
}

export function getSharedBoardSize(playerCount: number): {
  rows: number;
  columns: number;
} {
  const fleetCells = SHIP_DEFINITIONS.reduce((sum, ship) => sum + ship.size, 0);
  const occupied = playerCount * fleetCells;
  const targetCells = Math.ceil(occupied * 2.2);
  const side = Math.max(10, Math.min(16, Math.ceil(Math.sqrt(targetCells))));
  return { rows: side, columns: side };
}

function canPlaceShip(
  board: BoardCell[][],
  cells: Array<{ row: number; column: number }>,
): boolean {
  return cells.every(({ row, column }) => {
    const cell = board[row]?.[column];
    return cell !== undefined && cell.status === 'water';
  });
}

function buildShipCells(
  startRow: number,
  startCol: number,
  size: number,
  horizontal: boolean,
): Array<{ row: number; column: number }> {
  return Array.from({ length: size }, (_, i) =>
    horizontal
      ? { row: startRow, column: startCol + i }
      : { row: startRow + i, column: startCol },
  );
}

function tryPlaceShip(
  board: BoardCell[][],
  ownerId: string,
  type: ShipType,
  name: string,
  size: number,
  shipIndex: number,
  random: () => number = Math.random,
): Ship | null {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  const maxAttempts = 200;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const horizontal = random() > 0.5;
    const maxRow = horizontal ? rows - 1 : rows - size;
    const maxCol = horizontal ? columns - size : columns - 1;
    if (maxRow < 0 || maxCol < 0) return null;

    const startRow = Math.floor(random() * (maxRow + 1));
    const startCol = Math.floor(random() * (maxCol + 1));
    const cells = buildShipCells(startRow, startCol, size, horizontal);
    if (!canPlaceShip(board, cells)) continue;

    const shipId = `ship-${ownerId}-${type}-${shipIndex}`;
    for (const { row, column } of cells) {
      board[row]![column] = {
        row,
        column,
        status: 'ship',
        shipId,
        ownerId,
      };
    }

    return {
      id: shipId,
      type,
      name,
      size,
      hits: 0,
      destroyed: false,
      ownerId,
      cells,
    };
  }

  return null;
}

export function placeSharedFleets(
  players: Array<{ id: string; nickname: string }>,
  rows: number,
  columns: number,
  random: () => number = Math.random,
): { board: BoardCell[][]; ships: Ship[] } {
  const board = createEmptyBoard(rows, columns);
  const ships: Ship[] = [];
  const definitions = [...SHIP_DEFINITIONS].sort((a, b) => b.size - a.size);

  for (const player of players) {
    for (let i = 0; i < definitions.length; i += 1) {
      const definition = definitions[i]!;
      const ship = tryPlaceShip(
        board,
        player.id,
        definition.type,
        definition.name,
        definition.size,
        i,
        random,
      );
      if (!ship) {
        throw new Error(
          `Não foi possível posicionar a frota de ${player.nickname} sem sobreposição.`,
        );
      }
      ships.push(ship);
    }
  }

  return { board, ships };
}

export function getDisplayStatus(
  cell: BoardCell,
  viewerId: string,
): CellStatus {
  if (
    cell.status === 'miss' ||
    cell.status === 'hit' ||
    cell.status === 'destroyed' ||
    cell.status === 'selected' ||
    cell.status === 'disabled'
  ) {
    return cell.status;
  }

  if (cell.status === 'ship' && cell.ownerId === viewerId) {
    return 'ship';
  }

  return 'water';
}

export function canAttackCell(cell: BoardCell, attackerId: string): boolean {
  if (
    cell.status === 'miss' ||
    cell.status === 'hit' ||
    cell.status === 'destroyed' ||
    cell.status === 'disabled'
  ) {
    return false;
  }

  if (cell.status === 'ship' && cell.ownerId === attackerId) {
    return false;
  }

  return true;
}

export function countRemainingShips(ships: Ship[], ownerId: string): number {
  return ships.filter((ship) => ship.ownerId === ownerId && !ship.destroyed)
    .length;
}

export function getActivePlayers(players: RoomPlayer[]): RoomPlayer[] {
  return players.filter((player) => player.status !== 'eliminated');
}

export function getNextTurnPlayerId(
  players: RoomPlayer[],
  currentTurnPlayerId: string,
): string {
  const active = getActivePlayers(players);
  if (active.length === 0) return currentTurnPlayerId;

  const index = active.findIndex((player) => player.id === currentTurnPlayerId);
  const nextIndex = index === -1 ? 0 : (index + 1) % active.length;
  return active[nextIndex]!.id;
}

export function shouldIncrementRound(
  players: RoomPlayer[],
  currentTurnPlayerId: string,
  nextTurnPlayerId: string,
): boolean {
  const active = getActivePlayers(players);
  if (active.length <= 1) return false;

  const nextIndex = active.findIndex((player) => player.id === nextTurnPlayerId);
  const currentIndex = active.findIndex(
    (player) => player.id === currentTurnPlayerId,
  );

  return nextIndex === 0 && currentIndex === active.length - 1;
}

export function createHistoryAction(
  nickname: string,
  message: string,
  type: GameActionType,
): GameAction {
  return {
    id: createId('action'),
    playerNickname: nickname,
    message,
    timestamp: Date.now(),
    type,
  };
}

export function filterBoardForViewer(
  board: BoardCell[][],
  viewerId: string,
): BoardCell[][] {
  return board.map((row) =>
    row.map((cell) => ({
      ...cell,
      status: getDisplayStatus(cell, viewerId),
      shipId:
        cell.ownerId === viewerId ||
        cell.status === 'hit' ||
        cell.status === 'destroyed'
          ? cell.shipId
          : undefined,
      ownerId:
        cell.ownerId === viewerId ||
        cell.status === 'hit' ||
        cell.status === 'destroyed' ||
        cell.status === 'miss'
          ? cell.ownerId
          : undefined,
    })),
  );
}

export function filterShipsForViewer(ships: Ship[], viewerId: string): Ship[] {
  return ships
    .filter(
      (ship) =>
        ship.ownerId === viewerId || ship.destroyed || ship.hits > 0,
    )
    .map((ship) => {
      if (ship.ownerId === viewerId || ship.destroyed) {
        return { ...ship, cells: [...ship.cells] };
      }
      return {
        ...ship,
        cells: [],
      };
    });
}

export function toPublicMatchState(
  match: Match,
  viewerId: string,
): PublicMatchState {
  return {
    matchId: match.id,
    roomId: match.roomId,
    roomName: match.roomName,
    players: match.players.map((player) => ({ ...player })),
    currentTurnPlayerId: match.currentTurnPlayerId,
    round: match.round,
    isMyTurn: match.currentTurnPlayerId === viewerId,
    history: match.history.map((entry) => ({ ...entry })),
    board: filterBoardForViewer(match.board, viewerId),
    ships: filterShipsForViewer(match.ships, viewerId).filter(
      (ship) => ship.ownerId === viewerId,
    ),
    rows: match.rows,
    columns: match.columns,
    turnStartedAt: match.turnStartedAt,
    turnDurationSeconds: match.turnDurationSeconds,
    status: match.status,
    winnerId: match.winnerId,
  };
}

export function pickRandomAttackTarget(
  match: Match,
  attackerId: string,
  random: () => number = Math.random,
): { row: number; column: number } | null {
  const candidates: Array<{ row: number; column: number }> = [];

  for (let row = 0; row < match.rows; row += 1) {
    for (let column = 0; column < match.columns; column += 1) {
      const cell = match.board[row]?.[column];
      if (cell && canAttackCell(cell, attackerId)) {
        candidates.push({ row, column });
      }
    }
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(random() * candidates.length)]!;
}

export interface ResolveAttackInput {
  match: Match;
  attackerId: string;
  row: number;
  column: number;
}

export interface ResolveAttackOutput {
  cell: BoardCell;
  hit: boolean;
  destroyed: boolean;
  message: string;
  ships: Ship[];
  players: RoomPlayer[];
  historyEntry: GameAction;
  eliminatedPlayerId: string | null;
  finished: boolean;
  winnerId: string | null;
  shipsDestroyedCells: Array<{ row: number; column: number }>;
}

export function resolveAttack(input: ResolveAttackInput): ResolveAttackOutput {
  const { match, attackerId, row, column } = input;
  const attacker = match.players.find((player) => player.id === attackerId);
  if (!attacker) {
    throw new Error('Atacante não encontrado na partida.');
  }

  if (match.status !== 'active') {
    throw new Error('A partida já terminou.');
  }

  if (match.currentTurnPlayerId !== attackerId) {
    throw new Error('Não é o seu turno.');
  }

  const cell = match.board[row]?.[column];
  if (!cell) {
    throw new Error('Célula inválida.');
  }

  if (!canAttackCell(cell, attackerId)) {
    throw new Error('Esta célula não pode ser atacada.');
  }

  const label = getCellLabel(row, column);
  const ships = match.ships.map((ship) => ({
    ...ship,
    cells: [...ship.cells],
  }));

  let hit = false;
  let destroyed = false;
  let updatedCell: BoardCell = { ...cell };
  let message = `${attacker.nickname} atacou ${label} e caiu na água.`;
  let historyType: GameActionType = 'miss';
  let shipsDestroyedCells: Array<{ row: number; column: number }> = [];

  if (cell.status === 'ship' && cell.shipId && cell.ownerId !== attackerId) {
    hit = true;
    const shipIndex = ships.findIndex((ship) => ship.id === cell.shipId);
    if (shipIndex !== -1) {
      const ship = ships[shipIndex]!;
      const hits = ship.hits + 1;
      destroyed = hits >= ship.size;
      ships[shipIndex] = { ...ship, hits, destroyed };
      updatedCell = {
        ...cell,
        status: destroyed ? 'destroyed' : 'hit',
      };

      if (destroyed) {
        shipsDestroyedCells = ship.cells.map((c) => ({ ...c }));
        const ownerNickname =
          match.players.find((player) => player.id === ship.ownerId)
            ?.nickname ?? 'um jogador';
        message = `${attacker.nickname} destruiu o ${ship.name} de ${ownerNickname} em ${label}.`;
        historyType = 'destroyed';
      } else {
        message = `${attacker.nickname} atacou ${label} e acertou.`;
        historyType = 'hit';
      }
    }
  } else {
    updatedCell = { ...cell, status: 'miss' };
  }

  const players = match.players.map((player) => {
    const remaining = countRemainingShips(ships, player.id);
    let score = player.score ?? 0;

    if (player.id === attackerId) {
      if (hit) score += POINTS_HIT;
      if (destroyed) score += POINTS_DESTROY;
    }

    return {
      ...player,
      remainingShips: remaining,
      status: remaining === 0 ? ('eliminated' as const) : player.status,
      score,
    };
  });

  const eliminatedPlayer =
    players.find(
      (player) =>
        player.status === 'eliminated' &&
        match.players.find((previous) => previous.id === player.id)?.status !==
          'eliminated',
    ) ?? null;

  const active = getActivePlayers(players);
  const finished = active.length <= 1;
  const winnerId = finished ? (active[0]?.id ?? null) : null;

  const scoredPlayers = winnerId
    ? players.map((player) =>
        player.id === winnerId
          ? { ...player, score: (player.score ?? 0) + POINTS_WIN }
          : player,
      )
    : players;

  return {
    cell: updatedCell,
    hit,
    destroyed,
    message,
    ships,
    players: scoredPlayers,
    historyEntry: createHistoryAction(attacker.nickname, message, historyType),
    eliminatedPlayerId: eliminatedPlayer?.id ?? null,
    finished,
    winnerId,
    shipsDestroyedCells,
  };
}
