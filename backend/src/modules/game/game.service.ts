import type { Env } from '../../config/env.js';
import {
  POINTS_WIN,
} from '../../shared/constants.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createId } from '../../shared/utils/id.js';
import type { MemoryMatchRepository } from '../../storage/memory-match.repository.js';
import type { RoomService } from '../rooms/room.service.js';
import type { RoomPlayer } from '../rooms/room.types.js';
import {
  createHistoryAction,
  getActivePlayers,
  getNextTurnPlayerId,
  getSharedBoardSize,
  pickRandomAttackTarget,
  placeSharedFleets,
  resolveAttack,
  shouldIncrementRound,
  toPublicMatchState,
} from './game.rules.js';
import type {
  AttackResultPayload,
  Match,
  PublicMatchState,
} from './game.types.js';

export class GameService {
  private readonly turnTimers = new Map<string, NodeJS.Timeout>();
  private readonly matchLocks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly matches: MemoryMatchRepository,
    private readonly rooms: RoomService,
    private readonly env: Env,
    private readonly onTurnTimeout: (matchId: string) => void,
  ) {}

  startMatch(roomId: string, ownerId: string): {
    match: Match;
    states: Map<string, PublicMatchState>;
  } {
    const room = this.rooms.canStart(roomId, ownerId);
    return this.createMatchFromRoom(room);
  }

  startNextMatch(roomId: string, ownerId: string): {
    match: Match;
    states: Map<string, PublicMatchState>;
  } {
    const room = this.rooms.canRematch(roomId, ownerId);

    if (room.matchId) {
      const current = this.matches.findById(room.matchId);
      if (current && current.status !== 'finished') {
        throw new AppError(
          'ROOM_PLAYING',
          'A partida ainda está em andamento.',
        );
      }
      this.clearTurnTimer(room.matchId);
    }

    return this.createMatchFromRoom(room);
  }

  private createMatchFromRoom(room: {
    id: string;
    name: string;
    players: RoomPlayer[];
  }): {
    match: Match;
    states: Map<string, PublicMatchState>;
  } {
    const { rows, columns } = getSharedBoardSize(room.players.length);
    const { board, ships } = placeSharedFleets(room.players, rows, columns);

    const players: RoomPlayer[] = room.players.map((player) => ({
      ...player,
      status: 'playing',
      remainingShips: 5,
      score: 0,
    }));

    const firstPlayer = players[0]!;
    const match: Match = {
      id: createId('match'),
      roomId: room.id,
      roomName: room.name,
      players,
      currentTurnPlayerId: firstPlayer.id,
      round: 1,
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
      turnDurationSeconds: this.env.TURN_DURATION_SECONDS,
      status: 'active',
      winnerId: null,
      createdAt: Date.now(),
    };

    this.matches.save(match);
    this.rooms.markPlaying(room.id, match.id);
    this.scheduleTurnTimer(match.id);

    return {
      match,
      states: this.buildViewerStates(match),
    };
  }

  getPublicState(matchId: string, viewerId: string): PublicMatchState {
    const match = this.getMatch(matchId);
    return toPublicMatchState(match, viewerId);
  }

  async attack(input: {
    matchId: string;
    attackerId: string;
    row: number;
    column: number;
  }): Promise<AttackResultPayload> {
    return this.withMatchLock(input.matchId, () => {
      const match = this.getMatch(input.matchId);
      const result = resolveAttack({
        match,
        attackerId: input.attackerId,
        row: input.row,
        column: input.column,
      });

      match.board[input.row]![input.column] = result.cell;

      if (result.destroyed && result.shipsDestroyedCells.length > 0) {
        for (const cell of result.shipsDestroyedCells) {
          const current = match.board[cell.row]![cell.column]!;
          match.board[cell.row]![cell.column] = {
            ...current,
            status: 'destroyed',
            shipId: result.cell.shipId,
            ownerId: result.cell.ownerId,
          };
        }
      }

      match.ships = result.ships;
      match.players = result.players;
      match.history = [...match.history, result.historyEntry];

      let nextTurnPlayerId = match.currentTurnPlayerId;
      let round = match.round;
      let turnStartedAt = match.turnStartedAt;

      if (result.finished) {
        match.status = 'finished';
        match.winnerId = result.winnerId;
        this.clearTurnTimer(match.id);
        match.history.push(
          createHistoryAction(
            'Sistema',
            result.winnerId
              ? `${match.players.find((p) => p.id === result.winnerId)?.nickname ?? 'Jogador'} venceu a partida!`
              : 'A partida terminou.',
            'system',
          ),
        );
      } else {
        nextTurnPlayerId = getNextTurnPlayerId(
          match.players,
          match.currentTurnPlayerId,
        );
        if (
          shouldIncrementRound(
            match.players,
            match.currentTurnPlayerId,
            nextTurnPlayerId,
          )
        ) {
          round += 1;
        }
        match.currentTurnPlayerId = nextTurnPlayerId;
        match.round = round;
        turnStartedAt = Date.now();
        match.turnStartedAt = turnStartedAt;
        this.scheduleTurnTimer(match.id);
      }

      this.matches.save(match);

      return {
        matchId: match.id,
        attackerId: input.attackerId,
        row: input.row,
        column: input.column,
        cell: {
          ...result.cell,
          // public cell never exposes untouched enemy ships
          status: result.cell.status === 'ship' ? 'water' : result.cell.status,
        },
        hit: result.hit,
        destroyed: result.destroyed,
        message: result.message,
        shipsDestroyedCells: result.shipsDestroyedCells,
        players: result.players,
        historyEntry: result.historyEntry,
        eliminatedPlayerId: result.eliminatedPlayerId,
        finished: result.finished,
        winnerId: result.winnerId,
        nextTurnPlayerId,
        round,
        turnStartedAt,
      };
    });
  }

  async skipTurn(matchId: string, reason: string): Promise<{
    match: Match;
    historyEntry: ReturnType<typeof createHistoryAction>;
  } | null> {
    return this.withMatchLock(matchId, () => {
      const match = this.matches.findById(matchId);
      if (!match || match.status !== 'active') return null;

      const current = match.players.find(
        (player) => player.id === match.currentTurnPlayerId,
      );
      const historyEntry = createHistoryAction(
        'Sistema',
        reason || `Tempo esgotado para ${current?.nickname ?? 'jogador'}.`,
        'system',
      );

      const nextTurnPlayerId = getNextTurnPlayerId(
        match.players,
        match.currentTurnPlayerId,
      );
      if (
        shouldIncrementRound(
          match.players,
          match.currentTurnPlayerId,
          nextTurnPlayerId,
        )
      ) {
        match.round += 1;
      }

      match.currentTurnPlayerId = nextTurnPlayerId;
      match.turnStartedAt = Date.now();
      match.history = [...match.history, historyEntry];
      this.matches.save(match);
      this.scheduleTurnTimer(match.id);

      return { match, historyEntry };
    });
  }

  async leaveMatch(
    matchId: string,
    playerId: string,
  ): Promise<{
    match: Match;
    leftPlayer: RoomPlayer;
    historyEntry: ReturnType<typeof createHistoryAction>;
    turnChanged: boolean;
    finished: boolean;
  } | null> {
    return this.withMatchLock(matchId, () => {
      const match = this.matches.findById(matchId);
      if (!match || match.status !== 'active') return null;

      const leftPlayer = match.players.find((player) => player.id === playerId);
      if (!leftPlayer) return null;

      const wasCurrentTurn = match.currentTurnPlayerId === playerId;
      const previousTurnPlayerId = match.currentTurnPlayerId;

      match.players = match.players.filter((player) => player.id !== playerId);

      const historyEntry = createHistoryAction(
        'Sistema',
        `${leftPlayer.nickname} saiu da partida.`,
        'system',
      );
      match.history = [...match.history, historyEntry];

      const active = getActivePlayers(match.players);
      const hasHumanAlive = active.some((player) => !player.isBot);
      let turnChanged = false;
      let finished = false;

      if (active.length <= 1 || !hasHumanAlive) {
        match.status = 'finished';
        match.winnerId = hasHumanAlive
          ? (active.find((player) => !player.isBot)?.id ?? active[0]?.id ?? null)
          : null;
        finished = true;
        this.clearTurnTimer(match.id);

        if (match.winnerId) {
          match.players = match.players.map((player) =>
            player.id === match.winnerId
              ? { ...player, score: (player.score ?? 0) + POINTS_WIN }
              : player,
          );
        }

        const winner = match.players.find((p) => p.id === match.winnerId);
        match.history.push(
          createHistoryAction(
            'Sistema',
            match.winnerId
              ? `${winner?.nickname ?? 'Jogador'} venceu a partida!`
              : 'A partida terminou porque não há mais jogadores humanos.',
            'system',
          ),
        );
      } else if (
        wasCurrentTurn ||
        !active.some((player) => player.id === previousTurnPlayerId)
      ) {
        const nextTurnPlayerId = getNextTurnPlayerId(
          match.players,
          previousTurnPlayerId,
        );
        if (
          shouldIncrementRound(
            match.players,
            previousTurnPlayerId,
            nextTurnPlayerId,
          )
        ) {
          match.round += 1;
        }
        match.currentTurnPlayerId = nextTurnPlayerId;
        match.turnStartedAt = Date.now();
        turnChanged = true;
        this.scheduleTurnTimer(match.id);
      }

      this.matches.save(match);

      return {
        match,
        leftPlayer,
        historyEntry,
        turnChanged,
        finished,
      };
    });
  }

  getBotAttackTarget(matchId: string): {
    attackerId: string;
    row: number;
    column: number;
  } | null {
    const match = this.getMatch(matchId);
    if (match.status !== 'active') return null;

    const current = match.players.find(
      (player) => player.id === match.currentTurnPlayerId,
    );
    if (!current?.isBot) return null;

    const target = pickRandomAttackTarget(match, current.id);
    if (!target) return null;

    return {
      attackerId: current.id,
      row: target.row,
      column: target.column,
    };
  }

  buildViewerStates(match: Match): Map<string, PublicMatchState> {
    const states = new Map<string, PublicMatchState>();
    for (const player of match.players) {
      if (player.isBot) continue;
      states.set(player.id, toPublicMatchState(match, player.id));
    }
    return states;
  }

  getMatch(matchId: string): Match {
    const match = this.matches.findById(matchId);
    if (!match) {
      throw new AppError('MATCH_NOT_FOUND', 'Partida não encontrada.', 404);
    }
    return match;
  }

  clearTurnTimer(matchId: string): void {
    const timer = this.turnTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(matchId);
    }
  }

  private scheduleTurnTimer(matchId: string): void {
    this.clearTurnTimer(matchId);
    const timer = setTimeout(() => {
      this.onTurnTimeout(matchId);
    }, this.env.TURN_DURATION_SECONDS * 1000);
    this.turnTimers.set(matchId, timer);
  }

  private async withMatchLock<T>(
    matchId: string,
    fn: () => T | Promise<T>,
  ): Promise<T> {
    const previous = this.matchLocks.get(matchId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = previous.then(() => gate);
    this.matchLocks.set(matchId, current);

    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.matchLocks.get(matchId) === current) {
        this.matchLocks.delete(matchId);
      }
    }
  }
}
