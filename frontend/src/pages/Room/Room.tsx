import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Play, Users } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { ChangeNicknameModal } from '../../components/ChangeNicknameModal/ChangeNicknameModal';
import { EditRoomModal } from '../../components/EditRoomModal/EditRoomModal';
import { LoadingScreen } from '../../components/LoadingScreen/LoadingScreen';
import { RoomPlayersList } from '../../components/RoomPlayersList/RoomPlayersList';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { useUser } from '../../hooks/useUser';
import { emitStartGame, onSocketEvent } from '../../services/socketService';
import type { UpdateRoomPayload } from '../../types/room';
import { COUNTDOWN_SECONDS, ROOM_STATUS_LABELS } from '../../utils/constants';
import styles from './Room.module.css';

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    nickname,
    currentUser,
    currentRoom,
    loadRoom,
    leaveRoom,
    toggleReady,
    joinRoom,
    kickPlayer,
    addBot,
    replacePlayerWithBot,
    setPlayerColor,
    updateRoom,
    changeNickname,
    showToast,
  } = useUser();

  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [isAddingBot, setIsAddingBot] = useState(false);
  const [isChangingColor, setIsChangingColor] = useState(false);
  const [starting, setStarting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);

  useEffect(() => {
    if (!roomId || !currentUser) return;

    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        let room = await loadRoom(roomId);

        if (!room) {
          if (active) {
            showToast('Sala não encontrada.', 'error');
            navigate('/lobby');
          }
          return;
        }

        const alreadyIn = room.players.some(
          (p) => p.id === currentUser.id || p.nickname === currentUser.nickname,
        );

        if (
          !alreadyIn &&
          room.status !== 'playing' &&
          room.players.length < room.maxPlayers
        ) {
          room = await joinRoom(roomId);
        }

        if (room?.status === 'playing' && active) {
          navigate(`/jogando/${room.id}`);
        }
      } catch (error) {
        if (active) {
          const message =
            error instanceof Error
              ? error.message
              : 'Não foi possível entrar na sala.';
          showToast(message, 'error');
          navigate('/lobby');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [roomId, currentUser, loadRoom, joinRoom, navigate, showToast]);

  useEffect(() => {
    return onSocketEvent('room:game-started', (payload) => {
      const data = payload as { roomId: string };
      if (data.roomId === roomId) {
        setCountdown(COUNTDOWN_SECONDS);
      }
    });
  }, [roomId]);

  const me = useMemo(() => {
    if (!currentRoom || !currentUser) return null;
    return (
      currentRoom.players.find((p) => p.id === currentUser.id) ??
      currentRoom.players.find((p) => p.nickname === currentUser.nickname) ??
      null
    );
  }, [currentRoom, currentUser]);

  const isOwner = Boolean(me?.isRoomOwner);
  const playerCount = currentRoom?.players.length ?? 0;
  const allReady =
    playerCount >= 2 &&
    (currentRoom?.players.every((p) => p.isReady || p.isRoomOwner) ?? false);

  const canStart =
    isOwner &&
    playerCount >= 2 &&
    (currentRoom?.players.every((p) => Boolean(p.isReady)) ?? false);

  const startBlockReason = useMemo(() => {
    if (!isOwner) return null;
    if (playerCount < 2) {
      return 'É necessário pelo menos 2 jogadores para iniciar.';
    }
    if (!canStart) {
      return 'Todos os jogadores precisam estar prontos.';
    }
    return null;
  }, [isOwner, playerCount, canStart]);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      if (roomId) navigate(`/jogando/${roomId}`);
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown, navigate, roomId]);

  const handleLeave = async () => {
    await leaveRoom();
    navigate('/lobby');
  };

  const handleToggleReady = async () => {
    try {
      await toggleReady();
    } catch {
      showToast('Não foi possível alterar a prontidão.', 'error');
    }
  };

  const handleStart = async () => {
    if (!canStart || !roomId || starting) return;
    setStarting(true);
    try {
      const response = await emitStartGame(roomId);
      if (!response.success) {
        throw new Error(response.message ?? 'Não foi possível iniciar.');
      }
      showToast('Preparando a batalha...', 'success');
      setCountdown(COUNTDOWN_SECONDS);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível iniciar.';
      showToast(message, 'error');
    } finally {
      setStarting(false);
    }
  };

  const handleKick = async (playerId: string) => {
    setBusyPlayerId(playerId);
    try {
      await kickPlayer(playerId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não foi possível expulsar.';
      showToast(message, 'error');
    } finally {
      setBusyPlayerId(null);
    }
  };

  const handleAddBot = async () => {
    setIsAddingBot(true);
    try {
      await addBot();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível adicionar o bot.';
      showToast(message, 'error');
    } finally {
      setIsAddingBot(false);
    }
  };

  const handleReplaceWithBot = async (playerId: string) => {
    setBusyPlayerId(playerId);
    try {
      await replacePlayerWithBot(playerId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível substituir por bot.';
      showToast(message, 'error');
    } finally {
      setBusyPlayerId(null);
    }
  };

  const handleChangeColor = async (color: string) => {
    setIsChangingColor(true);
    try {
      await setPlayerColor(color);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível alterar a cor.';
      showToast(message, 'error');
    } finally {
      setIsChangingColor(false);
    }
  };

  const handleUpdateRoom = async (payload: UpdateRoomPayload) => {
    await updateRoom(payload);
    setEditOpen(false);
  };

  if (loading || !currentRoom || !currentUser) {
    return <LoadingScreen message="Entrando na sala..." />;
  }

  const countdownLabel =
    countdown === 0
      ? 'Batalha iniciada!'
      : countdown !== null
        ? String(countdown)
        : null;

  return (
    <div className={`${styles.page} page-enter`}>
      {countdownLabel !== null && (
        <div
          className={styles.countdownOverlay}
          role="alert"
          aria-live="assertive"
        >
          <span className={styles.countdownNumber}>{countdownLabel}</span>
        </div>
      )}

      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>{currentRoom.name}</h1>
            <p className={styles.meta}>
              ID: <code>{currentRoom.id}</code>
            </p>
            <div className={styles.badges}>
              <StatusBadge
                label={
                  ROOM_STATUS_LABELS[currentRoom.status] ??
                  'Aguardando jogadores'
                }
                tone="info"
              />
              <StatusBadge
                label={`${playerCount} de ${currentRoom.maxPlayers} jogadores`}
                tone="success"
                withDot
              />
            </div>
          </div>

          <div className={styles.headerActions}>
            <Button variant="secondary" onClick={() => void handleLeave()}>
              <ArrowLeft size={16} aria-hidden="true" />
              Sair da sala
            </Button>
            {isOwner && currentRoom.status !== 'playing' && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil size={16} aria-hidden="true" />
                Editar sala
              </Button>
            )}
          </div>
        </header>

        <section className={styles.panel}>
          <div className={styles.panelTop}>
            <h2>
              <Users size={20} aria-hidden="true" />
              Jogadores na sala
            </h2>

            {isOwner && (
              <div className={styles.startBlock}>
                <Button
                  size="lg"
                  onClick={() => void handleStart()}
                  disabled={!canStart || countdown !== null || starting}
                  className={styles.startBtn}
                >
                  <Play size={18} aria-hidden="true" />
                  {starting ? 'Iniciando...' : 'INICIAR JOGO'}
                </Button>
                {startBlockReason && (
                  <p className={styles.hint} role="status">
                    {startBlockReason}
                  </p>
                )}
              </div>
            )}
          </div>

          <RoomPlayersList
            players={currentRoom.players}
            maxPlayers={currentRoom.maxPlayers}
            currentUserId={currentUser.id}
            isOwner={isOwner}
            onKick={(id) => void handleKick(id)}
            onAddBot={() => void handleAddBot()}
            onReplaceWithBot={(id) => void handleReplaceWithBot(id)}
            onChangeColor={(color) => void handleChangeColor(color)}
            onEditNickname={() => setNicknameModalOpen(true)}
            busyPlayerId={busyPlayerId}
            isAddingBot={isAddingBot}
            isChangingColor={isChangingColor}
          />

          {!isOwner && me && (
            <div className={styles.readyActions}>
              <Button
                variant={me.isReady ? 'secondary' : 'success'}
                size="lg"
                fullWidth
                onClick={() => void handleToggleReady()}
              >
                {me.isReady ? 'Cancelar prontidão' : 'Estou pronto'}
              </Button>
            </div>
          )}

          {isOwner && (
            <p className={styles.ownerNote}>
              Como dono, você pode expulsar jogadores/bots, adicionar bots nas
              vagas livres ou substituir um jogador real por um bot.
            </p>
          )}
          {!allReady && playerCount >= 2 && !isOwner && (
            <p className={styles.hint}>
              Aguardando todos os jogadores ficarem prontos...
            </p>
          )}
        </section>
      </div>

      <EditRoomModal
        open={editOpen}
        room={currentRoom}
        onClose={() => setEditOpen(false)}
        onSubmit={handleUpdateRoom}
      />

      <ChangeNicknameModal
        open={nicknameModalOpen}
        currentNickname={me?.nickname ?? nickname ?? ''}
        onClose={() => setNicknameModalOpen(false)}
        onSubmit={changeNickname}
      />
    </div>
  );
}
