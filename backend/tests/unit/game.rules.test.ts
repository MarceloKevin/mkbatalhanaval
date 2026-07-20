import { describe, expect, it } from 'vitest';
import {
  canAttackCell,
  createEmptyBoard,
  getNextTurnPlayerId,
  getSharedBoardSize,
  placeSharedFleets,
  resolveAttack,
} from '../../src/modules/game/game.rules.js';
import type { Match } from '../../src/modules/game/game.types.js';
import type { RoomPlayer } from '../../src/modules/rooms/room.types.js';

function makePlayers(): RoomPlayer[] {
  return [
    {
      id: 'p1',
      nickname: 'Alpha',
      status: 'playing',
      isRoomOwner: true,
      isReady: true,
      isBot: false,
      color: '#ef4444',
      remainingShips: 5,
    },
    {
      id: 'p2',
      nickname: 'Bravo',
      status: 'playing',
      isRoomOwner: false,
      isReady: true,
      isBot: true,
      color: '#3b82f6',
      remainingShips: 5,
    },
  ];
}

function makeMatch(players = makePlayers()): Match {
  const { rows, columns } = getSharedBoardSize(players.length);
  // Deterministic-ish placement with fixed RNG seed via simple LCG
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const { board, ships } = placeSharedFleets(players, rows, columns, random);

  return {
    id: 'match-1',
    roomId: 'room-1',
    roomName: 'Test',
    players,
    currentTurnPlayerId: players[0]!.id,
    round: 1,
    history: [],
    board,
    ships,
    rows,
    columns,
    turnStartedAt: Date.now(),
    turnDurationSeconds: 30,
    status: 'active',
    winnerId: null,
    createdAt: Date.now(),
  };
}

describe('game.rules', () => {
  it('calcula tamanho de tabuleiro compartilhado', () => {
    expect(getSharedBoardSize(2).rows).toBeGreaterThanOrEqual(10);
    expect(getSharedBoardSize(8).rows).toBeLessThanOrEqual(16);
  });

  it('rejeita ataque fora do turno', () => {
    const match = makeMatch();
    expect(() =>
      resolveAttack({
        match,
        attackerId: 'p2',
        row: 0,
        column: 0,
      }),
    ).toThrow('Não é o seu turno.');
  });

  it('identifica ataque na água', () => {
    const match = makeMatch();
    // find a water cell not belonging to attacker
    let target: { row: number; column: number } | null = null;
    for (let row = 0; row < match.rows; row += 1) {
      for (let column = 0; column < match.columns; column += 1) {
        const cell = match.board[row]![column]!;
        if (cell.status === 'water' && canAttackCell(cell, 'p1')) {
          target = { row, column };
          break;
        }
      }
      if (target) break;
    }

    expect(target).not.toBeNull();
    const result = resolveAttack({
      match,
      attackerId: 'p1',
      row: target!.row,
      column: target!.column,
    });

    expect(result.hit).toBe(false);
    expect(result.cell.status).toBe('miss');
  });

  it('identifica navio atingido e destruído', () => {
    const match = makeMatch();
    const enemyShip = match.ships.find((ship) => ship.ownerId === 'p2');
    expect(enemyShip).toBeDefined();

    let lastResult = resolveAttack({
      match,
      attackerId: 'p1',
      row: enemyShip!.cells[0]!.row,
      column: enemyShip!.cells[0]!.column,
    });

    // apply first hit onto match for subsequent attacks
    match.board[enemyShip!.cells[0]!.row]![enemyShip!.cells[0]!.column] =
      lastResult.cell;
    match.ships = lastResult.ships;
    match.players = lastResult.players;

    expect(lastResult.hit).toBe(true);

    for (let i = 1; i < enemyShip!.cells.length; i += 1) {
      const cell = enemyShip!.cells[i]!;
      lastResult = resolveAttack({
        match,
        attackerId: 'p1',
        row: cell.row,
        column: cell.column,
      });
      match.board[cell.row]![cell.column] = lastResult.cell;
      match.ships = lastResult.ships;
      match.players = lastResult.players;
      if (lastResult.destroyed) {
        for (const destroyedCell of lastResult.shipsDestroyedCells) {
          match.board[destroyedCell.row]![destroyedCell.column] = {
            ...match.board[destroyedCell.row]![destroyedCell.column]!,
            status: 'destroyed',
          };
        }
      }
    }

    expect(lastResult.destroyed).toBe(true);
    expect(match.ships.find((s) => s.id === enemyShip!.id)?.destroyed).toBe(
      true,
    );
  });

  it('avança para o próximo jogador ativo', () => {
    const players = makePlayers();
    expect(getNextTurnPlayerId(players, 'p1')).toBe('p2');
    expect(getNextTurnPlayerId(players, 'p2')).toBe('p1');
  });

  it('cria tabuleiro vazio', () => {
    const board = createEmptyBoard(10, 10);
    expect(board).toHaveLength(10);
    expect(board[0]).toHaveLength(10);
    expect(board[0]![0]!.status).toBe('water');
  });
});
