/**
 * Serviço de jogo — simulado com dados mockados.
 * Futuramente, substituir por endpoints REST e eventos em tempo real.
 */

import { MOCK_ONLINE_PLAYERS } from '../data/mockData';
import type { AttackResult, GameAction, GameState } from '../types/game';
import type { Player } from '../types/player';
import type { Room } from '../types/room';
import {
  canAttackCell,
  cloneBoard,
  countRemainingShips,
  delay,
  generateId,
  getCellLabel,
  getSharedBoardSize,
  placeSharedFleets,
} from '../utils/boardHelpers';
import { MOCK_DELAY_MS, TURN_DURATION_SECONDS } from '../utils/constants';

export async function getOnlinePlayers(
  currentUser: Player | null,
): Promise<Player[]> {
  // TODO: GET /api/players/online
  await delay(MOCK_DELAY_MS);

  const players = structuredClone(MOCK_ONLINE_PLAYERS);

  if (currentUser) {
    const exists = players.some((p) => p.nickname === currentUser.nickname);
    if (!exists) {
      players.unshift({
        ...currentUser,
        status: 'available',
        isCurrentUser: true,
      });
    } else {
      return players.map((p) =>
        p.nickname === currentUser.nickname
          ? { ...p, isCurrentUser: true, id: currentUser.id }
          : p,
      );
    }
  }

  return players;
}

function buildPlayers(room: Room, currentUser: Player): Player[] {
  const players: Player[] = room.players.map((p) => ({
    ...p,
    status: 'playing',
    remainingShips: 5,
    isCurrentUser: p.id === currentUser.id || p.nickname === currentUser.nickname,
  }));

  if (!players.some((p) => p.isCurrentUser)) {
    players.unshift({
      ...currentUser,
      status: 'playing',
      isRoomOwner: true,
      isReady: true,
      remainingShips: 5,
      isCurrentUser: true,
      isBot: false,
    });
  }

  return players;
}

export function getActivePlayers(players: Player[]): Player[] {
  return players.filter((p) => p.status !== 'eliminated');
}

export function getNextTurnPlayerId(
  players: Player[],
  currentTurnPlayerId: string,
): string {
  const active = getActivePlayers(players);
  if (active.length === 0) return currentTurnPlayerId;

  const index = active.findIndex((p) => p.id === currentTurnPlayerId);
  const nextIndex = index === -1 ? 0 : (index + 1) % active.length;
  return active[nextIndex].id;
}

export async function startGame(
  room: Room,
  currentUser: Player,
): Promise<GameState> {
  // TODO: POST /api/rooms/:roomId/start
  await delay(MOCK_DELAY_MS);

  const players = buildPlayers(room, currentUser);
  const { rows, columns } = getSharedBoardSize(players.length);
  const { board, ships } = placeSharedFleets(players, rows, columns);

  const playersWithShips = players.map((player) => ({
    ...player,
    remainingShips: countRemainingShips(ships, player.id),
  }));

  const firstPlayer = playersWithShips[0];

  return {
    matchId: `match-${room.id}`,
    roomId: room.id,
    roomName: room.name,
    players: playersWithShips,
    currentTurnPlayerId: firstPlayer.id,
    round: 1,
    isMyTurn: Boolean(firstPlayer.isCurrentUser),
    history: [
      createHistoryAction(
        'Sistema',
        `Partida iniciada no tabuleiro ${rows}×${columns}. Frotas posicionadas aleatoriamente.`,
        'system',
      ),
    ],
    board,
    ships,
    rows,
    columns,
    turnStartedAt: Date.now(),
    turnDurationSeconds: TURN_DURATION_SECONDS,
  };
}

export async function attackCell(
  state: GameState,
  row: number,
  column: number,
  attacker: Player,
): Promise<AttackResult> {
  // TODO: POST /api/games/:gameId/attack  + WebSocket emit
  await delay(250);

  const cell = state.board[row]?.[column];
  if (!cell) {
    throw new Error('Célula inválida.');
  }

  if (!canAttackCell(cell, attacker.id)) {
    throw new Error('Esta célula não pode ser atacada.');
  }

  const label = getCellLabel(row, column);
  let ships = state.ships.map((ship) => ({
    ...ship,
    cells: [...ship.cells],
  }));
  let hit = false;
  let destroyed = false;
  let updatedCell = { ...cell };
  let message = `${attacker.nickname} atacou ${label} e caiu na água.`;

  if (cell.status === 'ship' && cell.shipId && cell.ownerId !== attacker.id) {
    hit = true;
    const shipIndex = ships.findIndex((s) => s.id === cell.shipId);
    if (shipIndex !== -1) {
      const ship = ships[shipIndex];
      const hits = ship.hits + 1;
      destroyed = hits >= ship.size;
      ships[shipIndex] = {
        ...ship,
        hits,
        destroyed,
      };

      updatedCell = {
        ...cell,
        status: destroyed ? 'destroyed' : 'hit',
      };

      if (destroyed) {
        // Mark all cells of the destroyed ship
        message = `${attacker.nickname} destruiu o ${ship.name} de ${
          state.players.find((p) => p.id === ship.ownerId)?.nickname ?? 'um jogador'
        } em ${label}.`;
      } else {
        message = `${attacker.nickname} atacou ${label} e acertou.`;
      }
    }
  } else {
    updatedCell = {
      ...cell,
      status: 'miss',
    };
  }

  if (destroyed && updatedCell.shipId) {
    const ship = ships.find((s) => s.id === updatedCell.shipId);
    if (ship) {
      // Apply destroyed status to all ship cells on board via return payload;
      // caller updates full board.
    }
  }

  const players = state.players.map((player) => {
    const remaining = countRemainingShips(ships, player.id);
    return {
      ...player,
      remainingShips: remaining,
      status: remaining === 0 ? ('eliminated' as const) : player.status,
    };
  });

  return {
    cell: updatedCell,
    hit,
    destroyed,
    message,
    ships,
    players,
  };
}

export function applyAttackToBoard(
  state: GameState,
  result: AttackResult,
  row: number,
  column: number,
): GameState['board'] {
  const board = cloneBoard(state.board);
  board[row][column] = result.cell;

  if (result.destroyed && result.cell.shipId) {
    const ship = result.ships.find((s) => s.id === result.cell.shipId);
    if (ship) {
      for (const cell of ship.cells) {
        board[cell.row][cell.column] = {
          ...board[cell.row][cell.column],
          status: 'destroyed',
          shipId: ship.id,
          ownerId: ship.ownerId,
        };
      }
    }
  }

  return board;
}

export function advanceTurn(state: GameState, currentUserId: string): GameState {
  const nextId = getNextTurnPlayerId(state.players, state.currentTurnPlayerId);
  const active = getActivePlayers(state.players);
  const nextIndex = active.findIndex((p) => p.id === nextId);
  const currentIndex = active.findIndex((p) => p.id === state.currentTurnPlayerId);
  const shouldIncrementRound =
    active.length > 1 &&
    nextIndex === 0 &&
    currentIndex === active.length - 1;

  return {
    ...state,
    currentTurnPlayerId: nextId,
    isMyTurn: nextId === currentUserId,
    round: shouldIncrementRound ? state.round + 1 : state.round,
    turnStartedAt: Date.now(),
  };
}

export function createHistoryAction(
  nickname: string,
  message: string,
  type: GameAction['type'],
): GameAction {
  return {
    id: generateId('action'),
    playerNickname: nickname,
    message,
    timestamp: Date.now(),
    type,
  };
}

/** Picks a random attackable cell for bot turns. */
export function pickRandomAttackTarget(
  state: GameState,
  attackerId: string,
): { row: number; column: number } | null {
  const candidates: Array<{ row: number; column: number }> = [];

  for (let row = 0; row < state.rows; row += 1) {
    for (let column = 0; column < state.columns; column += 1) {
      const cell = state.board[row][column];
      if (canAttackCell(cell, attackerId)) {
        candidates.push({ row, column });
      }
    }
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
