import type { BoardCell, CellStatus, Ship, ShipType } from '../types/game';
import type { Player } from '../types/player';
import { BOARD_COLUMNS, BOARD_ROWS, SHIP_DEFINITIONS } from './constants';

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

export function createEmptyBoard(
  rows = BOARD_ROWS,
  columns = BOARD_COLUMNS,
): BoardCell[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => ({
      row,
      column,
      status: 'water' as CellStatus,
    })),
  );
}

export function getCellLabel(row: number, column: number): string {
  return `${getColumnLabel(column)}${row + 1}`;
}

export function cloneBoard(board: BoardCell[][]): BoardCell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

/** Board side grows with player count so all fleets fit without overlap. */
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
): Ship | null {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  const maxAttempts = 200;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const horizontal = Math.random() > 0.5;
    const maxRow = horizontal ? rows - 1 : rows - size;
    const maxCol = horizontal ? columns - size : columns - 1;

    if (maxRow < 0 || maxCol < 0) return null;

    const startRow = Math.floor(Math.random() * (maxRow + 1));
    const startCol = Math.floor(Math.random() * (maxCol + 1));
    const cells = buildShipCells(startRow, startCol, size, horizontal);

    if (!canPlaceShip(board, cells)) continue;

    const shipId = `ship-${ownerId}-${type}-${shipIndex}`;

    for (const { row, column } of cells) {
      board[row][column] = {
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

/**
 * Places every player's fleet randomly on one shared board.
 * No two ships share the same coordinate.
 */
export function placeSharedFleets(
  players: Player[],
  rows: number,
  columns: number,
): { board: BoardCell[][]; ships: Ship[] } {
  const board = createEmptyBoard(rows, columns);
  const ships: Ship[] = [];
  const definitions = [...SHIP_DEFINITIONS].sort((a, b) => b.size - a.size);

  for (const player of players) {
    for (let i = 0; i < definitions.length; i += 1) {
      const definition = definitions[i];
      const ship = tryPlaceShip(
        board,
        player.id,
        definition.type,
        definition.name,
        definition.size,
        i,
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
  viewerId: string | undefined,
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

export function canAttackCell(
  cell: BoardCell,
  viewerId: string | undefined,
): boolean {
  if (
    cell.status === 'miss' ||
    cell.status === 'hit' ||
    cell.status === 'destroyed' ||
    cell.status === 'disabled'
  ) {
    return false;
  }

  if (cell.status === 'ship' && cell.ownerId === viewerId) {
    return false;
  }

  return true;
}

export function countRemainingShips(ships: Ship[], ownerId: string): number {
  return ships.filter((ship) => ship.ownerId === ownerId && !ship.destroyed).length;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
