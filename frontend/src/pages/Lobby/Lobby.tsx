import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Radar, RefreshCw } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { ChangeNicknameModal } from '../../components/ChangeNicknameModal/ChangeNicknameModal';
import { CreateRoomModal } from '../../components/CreateRoomModal/CreateRoomModal';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { Header } from '../../components/Header/Header';
import { JoinRoomModal } from '../../components/JoinRoomModal/JoinRoomModal';
import { OnlinePlayersList } from '../../components/OnlinePlayersList/OnlinePlayersList';
import { RoomCard } from '../../components/RoomCard/RoomCard';
import { SearchInput } from '../../components/SearchInput/SearchInput';
import { useUser } from '../../hooks/useUser';
import type { CreateRoomPayload, Room } from '../../types/room';
import styles from './Lobby.module.css';

export function LobbyPage() {
  const navigate = useNavigate();
  const {
    nickname,
    currentUser,
    rooms,
    onlinePlayers,
    isLoadingRooms,
    isLoadingPlayers,
    clearUser,
    refreshRooms,
    refreshPlayers,
    createRoom,
    joinRoom,
    changeNickname,
    showToast,
  } = useUser();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [passwordRoom, setPasswordRoom] = useState<Room | null>(null);

  useEffect(() => {
    void refreshRooms();
    void refreshPlayers();
  }, [refreshRooms, refreshPlayers]);

  const filteredRooms = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter((room) => room.name.toLowerCase().includes(term));
  }, [rooms, search]);

  const handleLogout = () => {
    clearUser();
    navigate('/');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshRooms(), refreshPlayers()]);
      showToast('Lista atualizada.', 'info');
    } finally {
      setRefreshing(false);
    }
  };

  const enterRoom = async (roomId: string, password?: string) => {
    setJoiningId(roomId);
    try {
      const room = await joinRoom(roomId, password);
      setPasswordRoom(null);
      navigate(`/sala/${room.id}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível entrar na sala.';
      if (password !== undefined) {
        throw error instanceof Error ? error : new Error(message);
      }
      showToast(message, 'error');
    } finally {
      setJoiningId(null);
    }
  };

  const handleJoin = (roomId: string) => {
    const room = rooms.find((item) => item.id === roomId);
    if (!room) {
      showToast('Sala não encontrada.', 'error');
      return;
    }

    if (room.isPrivate) {
      setPasswordRoom(room);
      return;
    }

    void enterRoom(roomId);
  };

  const handleCreate = async (payload: CreateRoomPayload) => {
    try {
      const room = await createRoom(payload);
      setModalOpen(false);
      navigate(`/sala/${room.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao criar sala.';
      showToast(message, 'error');
    }
  };

  if (!nickname || !currentUser) return null;

  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.container}>
        <Header
          nickname={nickname}
          onLogout={handleLogout}
          onEditNickname={() => setNicknameModalOpen(true)}
        />

        <div className={styles.actions}>
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={18} aria-hidden="true" />
            Criar sala
          </Button>

          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar sala por nome..."
            className={styles.search}
          />

          <span className={styles.found}>
            {filteredRooms.length}{' '}
            {filteredRooms.length === 1 ? 'sala encontrada' : 'salas encontradas'}
          </span>

          <Button
            variant="secondary"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            aria-label="Atualizar lista"
          >
            <RefreshCw
              size={16}
              className={refreshing ? styles.spin : undefined}
              aria-hidden="true"
            />
            Atualizar
          </Button>
        </div>

        <div className={styles.grid}>
          <OnlinePlayersList
            players={onlinePlayers}
            isLoading={isLoadingPlayers}
          />

          <section className={styles.rooms} aria-labelledby="rooms-title">
            <header className={styles.roomsHeader}>
              <h2 id="rooms-title">Salas disponíveis</h2>
            </header>

            <div className={styles.roomsBody}>
              {isLoadingRooms ? (
                <div className={styles.skeletons} aria-busy="true">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={styles.skeleton} />
                  ))}
                </div>
              ) : filteredRooms.length === 0 ? (
                <EmptyState
                  icon={<Radar size={28} />}
                  title="Nenhuma sala encontrada."
                  description="Tente buscar outro nome ou crie uma nova sala."
                />
              ) : (
                <div className={styles.roomGrid}>
                  {filteredRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      onJoin={handleJoin}
                      isJoining={joiningId === room.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <CreateRoomModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />

      <ChangeNicknameModal
        open={nicknameModalOpen}
        currentNickname={nickname}
        onClose={() => setNicknameModalOpen(false)}
        onSubmit={changeNickname}
      />

      <JoinRoomModal
        open={Boolean(passwordRoom)}
        room={passwordRoom}
        onClose={() => setPasswordRoom(null)}
        onSubmit={async (password) => {
          if (!passwordRoom) return;
          await enterRoom(passwordRoom.id, password);
        }}
      />
    </div>
  );
}
