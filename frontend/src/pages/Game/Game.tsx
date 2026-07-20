import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LogOut, Play, Settings, Ship as ShipIcon, Swords, Trophy, Users } from 'lucide-react';
import { BattleBoard } from '../../components/BattleBoard/BattleBoard';
import { Button } from '../../components/Button/Button';
import { GameHistory } from '../../components/GameHistory/GameHistory';
import { LoadingScreen } from '../../components/LoadingScreen/LoadingScreen';
import { PlayerAvatar } from '../../components/PlayerAvatar/PlayerAvatar';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { TurnTimer } from '../../components/TurnTimer/TurnTimer';
import { useUser } from '../../hooks/useUser';
import {
  emitAttack,
  emitRequestGameState,
  emitReturnToRoom,
  emitStartNextMatch,
  onSocketEvent,
} from '../../services/socketService';
import type { BoardCell, GameAction, GameState } from '../../types/game';
import type { Player } from '../../types/player';
import type { Room } from '../../types/room';
import {
  POINTS_DESTROY,
  POINTS_HIT,
  POINTS_WIN,
  SHIP_DEFINITIONS,
} from '../../utils/constants';
import styles from './Game.module.css';

interface AttackResultEvent {
  matchId: string;
  attackerId: string;
  row: number;
  column: number;
  cell: BoardCell;
  hit: boolean;
  destroyed: boolean;
  message: string;
  shipsDestroyedCells?: Array<{ row: number; column: number }>;
  players: Player[];
  historyEntry: GameAction;
  eliminatedPlayerId: string | null;
  finished: boolean;
  winnerId: string | null;
  nextTurnPlayerId: string;
  round: number;
  turnStartedAt: number;
}

function applyPublicAttack(
  prev: GameState,
  result: AttackResultEvent,
  viewerId: string,
): GameState {
  const board = prev.board.map((row) => row.map((cell) => ({ ...cell })));
  board[result.row]![result.column] = { ...result.cell };

  if (result.destroyed && result.shipsDestroyedCells) {
    for (const cell of result.shipsDestroyedCells) {
      board[cell.row]![cell.column] = {
        ...board[cell.row]![cell.column]!,
        status: 'destroyed',
        shipId: result.cell.shipId,
        ownerId: result.cell.ownerId,
      };
    }
  }

  const players = result.players.map((player) => ({
    ...player,
    isCurrentUser: player.id === viewerId,
  }));

  return {
    ...prev,
    board,
    players,
    history: [...prev.history, result.historyEntry],
    currentTurnPlayerId: result.nextTurnPlayerId,
    round: result.round,
    turnStartedAt: result.turnStartedAt,
    isMyTurn: result.nextTurnPlayerId === viewerId,
    status: result.finished ? 'finished' : prev.status,
    winnerId: result.winnerId,
  };
}

export function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentUser, currentRoom, loadRoom, leaveRoom, setCurrentRoom, showToast } =
    useUser();

  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [attacking, setAttacking] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [startingNext, setStartingNext] = useState(false);
  const [returningToRoom, setReturningToRoom] = useState(false);

  const gameRef = useRef<GameState | null>(null);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    if (!roomId || !currentUser) return;

    let active = true;

    const init = async () => {
      setLoading(true);
      try {
        let room = currentRoom;
        if (!room || room.id !== roomId) {
          room = await loadRoom(roomId);
        }
        if (!room) {
          showToast('Sala não encontrada.', 'error');
          navigate('/lobby');
          return;
        }

        if (!room.matchId) {
          if (active) {
            setCurrentRoom(room);
            navigate(`/sala/${room.id}`);
          }
          return;
        }

        const response = await emitRequestGameState(room.matchId);
        if (response.success && response.data?.state && active) {
          const state = {
            ...response.data.state,
            players: response.data.state.players.map((player) => ({
              ...player,
              isCurrentUser: player.id === currentUser.id,
            })),
          };
          setGame(state);
          setSecondsLeft(state.turnDurationSeconds);
        } else if (active) {
          showToast('Partida não encontrada.', 'error');
          navigate(`/sala/${room.id}`);
          return;
        }
      } catch {
        if (active) {
          showToast('Não foi possível carregar a partida.', 'error');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void init();
    return () => {
      active = false;
    };
  }, [roomId, currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;

    const unsubs = [
      onSocketEvent('game:state', (payload) => {
        const state = payload as GameState;
        setGame({
          ...state,
          players: state.players.map((player) => ({
            ...player,
            isCurrentUser: player.id === currentUser.id,
          })),
        });
        setSecondsLeft(state.turnDurationSeconds);
        setLoading(false);
      }),
      onSocketEvent('game:attack-result', (payload) => {
        const result = payload as AttackResultEvent;
        setGame((prev) => {
          if (!prev || prev.matchId !== result.matchId) return prev;
          const next = applyPublicAttack(prev, result, currentUser.id);
          setSecondsLeft(next.turnDurationSeconds);
          return next;
        });
        setAttacking(false);

        if (result.attackerId === currentUser.id) {
          showToast(
            result.destroyed
              ? 'Navio destruído!'
              : result.hit
                ? 'Acertou!'
                : 'Água!',
            result.hit ? 'success' : 'info',
          );
        }

        if (result.finished) {
          const winner = result.players.find((p) => p.id === result.winnerId);
          showToast(
            result.winnerId === currentUser.id
              ? 'Você venceu a partida!'
              : `${winner?.nickname ?? 'Um jogador'} venceu a partida.`,
            result.winnerId === currentUser.id ? 'success' : 'info',
          );
        }
      }),
      onSocketEvent('game:turn-changed', (payload) => {
        const data = payload as {
          matchId: string;
          currentTurnPlayerId: string;
          round: number;
          turnStartedAt: number;
          historyEntry?: GameAction;
        };
        setGame((prev) => {
          if (!prev || prev.matchId !== data.matchId) return prev;
          setSecondsLeft(prev.turnDurationSeconds);
          return {
            ...prev,
            currentTurnPlayerId: data.currentTurnPlayerId,
            round: data.round,
            turnStartedAt: data.turnStartedAt,
            isMyTurn: data.currentTurnPlayerId === currentUser.id,
            history: data.historyEntry
              ? [...prev.history, data.historyEntry]
              : prev.history,
          };
        });
      }),
      onSocketEvent('game:player-left', (payload) => {
        const data = payload as {
          matchId: string;
          playerId: string;
          playerNickname: string;
          players: Player[];
          currentTurnPlayerId: string;
          round: number;
          turnStartedAt: number;
          historyEntry: GameAction;
          finished: boolean;
          winnerId: string | null;
        };

        setGame((prev) => {
          if (!prev || prev.matchId !== data.matchId) return prev;
          setSecondsLeft(prev.turnDurationSeconds);
          return {
            ...prev,
            players: data.players.map((player) => ({
              ...player,
              isCurrentUser: player.id === currentUser.id,
            })),
            currentTurnPlayerId: data.currentTurnPlayerId,
            round: data.round,
            turnStartedAt: data.turnStartedAt,
            isMyTurn: data.currentTurnPlayerId === currentUser.id,
            history: [...prev.history, data.historyEntry],
            status: data.finished ? 'finished' : prev.status,
            winnerId: data.finished ? data.winnerId : prev.winnerId,
          };
        });

        if (data.playerId !== currentUser.id) {
          showToast(`${data.playerNickname} saiu da partida.`, 'info');
        }

        if (data.finished && data.winnerId) {
          const winner = data.players.find((p) => p.id === data.winnerId);
          showToast(
            data.winnerId === currentUser.id
              ? 'Você venceu a partida!'
              : `${winner?.nickname ?? 'Um jogador'} venceu a partida.`,
            data.winnerId === currentUser.id ? 'success' : 'info',
          );
        }
      }),
      onSocketEvent('game:error', (payload) => {
        const data = payload as { message?: string };
        showToast(data.message ?? 'Erro na partida.', 'error');
        setAttacking(false);
      }),
    ];

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [currentUser, showToast]);

  // Local countdown display (server owns the skip)
  useEffect(() => {
    if (!game || game.status === 'finished') return;

    const tick = () => {
      const current = gameRef.current;
      if (!current) return;
      const elapsed = Math.floor((Date.now() - current.turnStartedAt) / 1000);
      setSecondsLeft(Math.max(0, current.turnDurationSeconds - elapsed));
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [game?.turnStartedAt, game?.currentTurnPlayerId, game?.status]);

  const currentTurnPlayer = useMemo(
    () => game?.players.find((p) => p.id === game.currentTurnPlayerId),
    [game],
  );

  const isOwner = useMemo(
    () =>
      Boolean(
        game?.players.find((p) => p.id === currentUser?.id)?.isRoomOwner ||
          currentRoom?.ownerId === currentUser?.id,
      ),
    [game, currentRoom, currentUser],
  );

  const scoreboard = useMemo(() => {
    if (!game) return [];
    return [...game.players].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0),
    );
  }, [game]);

  const myShips = useMemo(
    () =>
      game && currentUser
        ? game.ships.filter((ship) => ship.ownerId === currentUser.id)
        : [],
    [game, currentUser],
  );

  const handleAttack = useCallback(
    async (row: number, column: number) => {
      if (!game || !currentUser || !game.isMyTurn || attacking) return;
      if (game.status === 'finished') return;

      setAttacking(true);
      try {
        const response = await emitAttack(game.matchId, row, column);
        if (!response.success) {
          throw new Error(response.message ?? 'Ataque inválido.');
        }
      } catch (error) {
        setAttacking(false);
        const message =
          error instanceof Error ? error.message : 'Ataque inválido.';
        showToast(message, 'error');
      }
    },
    [game, currentUser, attacking, showToast],
  );

  const handleConfirmLeave = async () => {
    try {
      await leaveRoom();
      navigate('/lobby');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível sair da partida.';
      showToast(message, 'error');
      setConfirmLeave(false);
    }
  };

  const handleNextMatch = async () => {
    if (!roomId || startingNext) return;
    setStartingNext(true);
    try {
      const response = await emitStartNextMatch(roomId);
      if (!response.success) {
        throw new Error(
          response.message ?? 'Não foi possível iniciar a próxima partida.',
        );
      }
      showToast('Iniciando próxima partida...', 'success');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar a próxima partida.';
      showToast(message, 'error');
    } finally {
      setStartingNext(false);
    }
  };

  const goBackToRoom = useCallback(
    (room: Room) => {
      setCurrentRoom(room);
      navigate(`/sala/${room.id}`);
    },
    [navigate, setCurrentRoom],
  );

  const handleReturnToRoom = async () => {
    if (!roomId || returningToRoom) return;
    setReturningToRoom(true);
    try {
      const response = await emitReturnToRoom(roomId);
      if (!response.success || !response.data?.room) {
        throw new Error(
          response.message ?? 'Não foi possível voltar para a sala.',
        );
      }
      // Prefer ACK navigation; room:returned keeps other clients in sync.
      goBackToRoom(response.data.room);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível voltar para a sala.';
      showToast(message, 'error');
      setReturningToRoom(false);
    }
  };

  useEffect(() => {
    return onSocketEvent('room:returned', (payload) => {
      const data = payload as { room: Room };
      if (!data.room?.id) return;
      if (roomId && data.room.id !== roomId) return;
      goBackToRoom(data.room);
      showToast('Todos voltaram para a sala.', 'info');
    });
  }, [roomId, goBackToRoom, showToast]);

  if (loading || !game || !currentUser) {
    return <LoadingScreen message="Preparando o campo de batalha..." />;
  }

  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <h1>{game.roomName}</h1>
            <div className={styles.metaRow}>
              <StatusBadge label={`Rodada ${game.round}`} tone="info" />
              <StatusBadge
                label={`Turno: ${currentTurnPlayer?.nickname ?? '—'}`}
                tone="warning"
              />
              <StatusBadge
                label={`Tabuleiro ${game.rows}×${game.columns}`}
                tone="neutral"
              />
              <StatusBadge label={currentUser.nickname} tone="success" withDot />
            </div>
          </div>

          <div className={styles.headerActions}>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Configurações"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <Settings size={18} />
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmLeave(true)}
            >
              <LogOut size={16} aria-hidden="true" />
              Sair da partida
            </Button>
          </div>
        </header>

        {settingsOpen && (
          <div className={styles.settingsBanner} role="status">
            Conectado ao servidor em tempo real.
          </div>
        )}

        <TurnTimer
          secondsLeft={secondsLeft}
          totalSeconds={game.turnDurationSeconds}
          playerNickname={currentTurnPlayer?.nickname ?? '—'}
          isMyTurn={game.isMyTurn}
        />

        <div
          className={`${styles.turnBanner} ${game.isMyTurn ? styles.myTurn : styles.waitTurn}`}
          role="status"
        >
          <Swords size={18} aria-hidden="true" />
          {game.status === 'finished'
            ? 'Partida encerrada'
            : game.isMyTurn
              ? 'Sua vez de atacar no tabuleiro compartilhado'
              : `Aguardando jogada de ${currentTurnPlayer?.nickname ?? 'outro jogador'}`}
        </div>

        <div className={styles.main}>
          <div className={styles.boardsArea}>
            <BattleBoard
              board={game.board}
              rows={game.rows}
              columns={game.columns}
              title="Tabuleiro compartilhado"
              viewerId={currentUser.id}
              players={game.players}
              interactive={
                game.isMyTurn && !attacking && game.status !== 'finished'
              }
              onCellClick={(row, column) => void handleAttack(row, column)}
            />
            <p className={styles.boardHint}>
              Seus navios aparecem em azul-marinho. Os navios rivais ficam ocultos
              até serem atingidos — aí a célula mostra a cor do jogador atingido.
            </p>
          </div>

          <aside className={styles.sidebar}>
            <section className={styles.sidePanel}>
              <h3>Jogadores da partida</h3>
              <ul className={styles.playerList}>
                {game.players.map((player) => (
                  <li
                    key={player.id}
                    className={`${styles.playerItem} ${
                      player.id === game.currentTurnPlayerId
                        ? styles.turnActive
                        : ''
                    } ${player.status === 'eliminated' ? styles.eliminated : ''}`}
                  >
                    <PlayerAvatar
                      nickname={player.nickname}
                      size="sm"
                      color={player.color}
                    />
                    <div className={styles.playerInfo}>
                      <strong>
                        {player.nickname}
                        {player.isCurrentUser ? ' (Você)' : ''}
                        {player.isBot ? ' · Bot' : ''}
                      </strong>
                      <span>
                        {player.remainingShips ?? 0} navios ·{' '}
                        {player.status === 'eliminated' ? 'Eliminado' : 'Ativo'}
                      </span>
                    </div>
                    <span className={styles.scoreBadge} title="Pontos na partida">
                      {player.score ?? 0} pts
                    </span>
                    {player.id === game.currentTurnPlayerId &&
                      player.status !== 'eliminated' &&
                      game.status !== 'finished' && (
                        <StatusBadge
                          label={`${secondsLeft}s`}
                          tone="warning"
                        />
                      )}
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.sidePanel}>
              <h3>Sua frota</h3>
              <ul className={styles.ships}>
                {SHIP_DEFINITIONS.map((definition) => {
                  const state = myShips.find((s) => s.type === definition.type);
                  return (
                    <li key={definition.type} className={styles.shipRow}>
                      <div className={styles.shipLabel}>
                        <ShipIcon size={14} aria-hidden="true" />
                        <span>{definition.name}</span>
                      </div>
                      <div className={styles.shipBlocks} aria-hidden="true">
                        {Array.from({ length: definition.size }).map((_, i) => (
                          <span
                            key={i}
                            className={`${styles.block} ${
                              state && (state.destroyed || i < state.hits)
                                ? styles.blockHit
                                : ''
                            }`}
                          />
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <div className={styles.sidePanel}>
              <GameHistory actions={game.history} />
            </div>
          </aside>
        </div>
      </div>

      {game.status === 'finished' && (
        <div className={styles.modalOverlay} role="presentation">
          <div
            className={`${styles.modal} ${styles.scoreboardModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scoreboard-title"
          >
            <div className={styles.scoreboardHeader}>
              <Trophy size={28} aria-hidden="true" />
              <h2 id="scoreboard-title">Placar final</h2>
            </div>
            <p className={styles.scoreboardHint}>
              Acerto +{POINTS_HIT} · Destruir navio +{POINTS_DESTROY} · Vitória +
              {POINTS_WIN}
            </p>
            <ol className={styles.scoreboardList}>
              {scoreboard.map((player, index) => (
                <li
                  key={player.id}
                  className={`${styles.scoreboardRow} ${
                    index === 0 ? styles.scoreboardFirst : ''
                  } ${player.isCurrentUser ? styles.scoreboardMe : ''}`}
                >
                  <span className={styles.scoreboardRank}>{index + 1}º</span>
                  <PlayerAvatar
                    nickname={player.nickname}
                    size="sm"
                    color={player.color}
                  />
                  <div className={styles.scoreboardInfo}>
                    <strong>
                      {player.nickname}
                      {player.isCurrentUser ? ' (Você)' : ''}
                    </strong>
                    <span>
                      {player.id === game.winnerId
                        ? 'Vencedor'
                        : player.isBot
                          ? 'Bot'
                          : 'Jogador'}
                      {player.status === 'eliminated' &&
                      player.id !== game.winnerId
                        ? ' · Eliminado'
                        : ''}
                    </span>
                  </div>
                  <span className={styles.scoreboardPoints}>
                    {player.score ?? 0} pts
                  </span>
                </li>
              ))}
            </ol>

            {isOwner ? (
              <Button
                size="lg"
                fullWidth
                disabled={startingNext || returningToRoom}
                onClick={() => void handleNextMatch()}
              >
                <Play size={18} aria-hidden="true" />
                {startingNext ? 'Iniciando...' : 'Iniciar próxima partida'}
              </Button>
            ) : (
              <p className={styles.waitingNext} role="status">
                Aguardando o dono da sala iniciar a próxima partida...
              </p>
            )}

            <Button
              variant="secondary"
              size="lg"
              fullWidth
              disabled={returningToRoom || startingNext}
              onClick={() => void handleReturnToRoom()}
            >
              <Users size={18} aria-hidden="true" />
              {returningToRoom ? 'Voltando...' : 'Voltar para a sala'}
            </Button>
          </div>
        </div>
      )}

      {confirmLeave && (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmLeave(false);
          }}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-title"
          >
            <h2 id="leave-title">Sair da partida?</h2>
            <p>
              Você será redirecionado ao lobby e perderá o progresso desta sessão.
            </p>
            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
                Continuar jogando
              </Button>
              <Button variant="danger" onClick={() => void handleConfirmLeave()}>
                Sair da partida
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
