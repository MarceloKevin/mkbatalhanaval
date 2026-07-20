import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ToastMessage, ToastType } from '../types/game';
import type { Player } from '../types/player';
import type {
  CreateRoomPayload,
  Room,
  UpdateRoomPayload,
} from '../types/room';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  connectSocket,
  disconnectSocket,
  emitAddBot,
  emitCreateRoom,
  emitGetLobbyState,
  emitJoinLobby,
  emitJoinRoom,
  emitKickPlayer,
  emitLeaveRoom,
  emitPlayerReady,
  emitRenamePlayer,
  emitReplaceWithBot,
  emitSetPlayerColor,
  emitUpdateRoom,
  getSessionPlayerId,
  onSocketEvent,
} from '../services/socketService';
import { generateId } from '../utils/boardHelpers';
import { NICKNAME_STORAGE_KEY } from '../utils/constants';

interface UserContextValue {
  nickname: string | null;
  currentUser: Player | null;
  rooms: Room[];
  onlinePlayers: Player[];
  currentRoom: Room | null;
  isLoadingRooms: boolean;
  isLoadingPlayers: boolean;
  toasts: ToastMessage[];
  setNickname: (nickname: string) => Promise<void>;
  changeNickname: (nickname: string) => Promise<void>;
  clearUser: () => void;
  refreshRooms: () => Promise<void>;
  refreshPlayers: () => Promise<void>;
  createRoom: (payload: CreateRoomPayload) => Promise<Room>;
  updateRoom: (payload: UpdateRoomPayload) => Promise<Room>;
  joinRoom: (roomId: string, password?: string) => Promise<Room>;
  leaveRoom: () => Promise<void>;
  loadRoom: (roomId: string) => Promise<Room | null>;
  toggleReady: () => Promise<void>;
  setPlayerColor: (color: string) => Promise<void>;
  kickPlayer: (playerId: string) => Promise<void>;
  addBot: () => Promise<void>;
  replacePlayerWithBot: (playerId: string) => Promise<void>;
  setCurrentRoom: (room: Room | null) => void;
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
}

export const UserContext = createContext<UserContextValue | null>(null);

interface UserProviderProps {
  children: ReactNode;
}

function markCurrentUser(players: Player[], playerId: string | null): Player[] {
  return players.map((player) => ({
    ...player,
    isCurrentUser: player.id === playerId,
  }));
}

function withCurrentFlags(room: Room, playerId: string | null): Room {
  return {
    ...room,
    players: room.players.map((player) => ({
      ...player,
      isCurrentUser: player.id === playerId,
    })),
  };
}

export function UserProvider({ children }: UserProviderProps) {
  const [storedNickname, setStoredNickname, removeStoredNickname] =
    useLocalStorage<string | null>(NICKNAME_STORAGE_KEY, null);

  const [playerId, setPlayerId] = useState<string | null>(getSessionPlayerId());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<Player[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const currentUser = useMemo<Player | null>(() => {
    if (!storedNickname || !playerId) return null;
    return {
      id: playerId,
      nickname: storedNickname,
      status: currentRoom ? 'in-room' : 'available',
      isCurrentUser: true,
    };
  }, [storedNickname, playerId, currentRoom]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = generateId('toast');
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshLobby = useCallback(async () => {
    setIsLoadingRooms(true);
    setIsLoadingPlayers(true);
    try {
      const response = await emitGetLobbyState();
      if (!response.success || !response.data) {
        throw new Error(response.message ?? 'Falha ao carregar lobby.');
      }
      const id = getSessionPlayerId();
      setPlayerId(id);
      setRooms(response.data.rooms);
      setOnlinePlayers(markCurrentUser(response.data.players, id));
    } finally {
      setIsLoadingRooms(false);
      setIsLoadingPlayers(false);
    }
  }, []);

  const refreshRooms = useCallback(async () => {
    await refreshLobby();
  }, [refreshLobby]);

  const refreshPlayers = useCallback(async () => {
    await refreshLobby();
  }, [refreshLobby]);

  const setNickname = useCallback(
    async (nickname: string) => {
      await connectSocket(nickname);
      await emitJoinLobby(nickname);
      setStoredNickname(nickname);
      setPlayerId(getSessionPlayerId());
      await refreshLobby();
      showToast(`Bem-vindo a bordo, ${nickname}!`, 'success');
    },
    [setStoredNickname, showToast, refreshLobby],
  );

  const changeNickname = useCallback(
    async (nickname: string) => {
      const response = await emitRenamePlayer(nickname);
      if (!response.success || !response.data?.nickname) {
        throw new Error(
          response.message ?? 'Não foi possível alterar o nickname.',
        );
      }

      const nextNickname = response.data.nickname;
      setStoredNickname(nextNickname);

      if (response.data.room) {
        setCurrentRoom(
          withCurrentFlags(response.data.room, getSessionPlayerId()),
        );
      }

      await refreshLobby();
      showToast(`Nickname atualizado para ${nextNickname}.`, 'success');
    },
    [setStoredNickname, refreshLobby, showToast],
  );

  const clearUser = useCallback(() => {
    removeStoredNickname();
    setCurrentRoom(null);
    setPlayerId(null);
    setRooms([]);
    setOnlinePlayers([]);
    disconnectSocket();
  }, [removeStoredNickname]);

  const createRoom = useCallback(
    async (payload: CreateRoomPayload) => {
      const response = await emitCreateRoom(payload);
      if (!response.success || !response.data?.room) {
        throw new Error(response.message ?? 'Não foi possível criar a sala.');
      }
      const id = getSessionPlayerId();
      const room = withCurrentFlags(response.data.room, id);
      setCurrentRoom(room);
      setRooms((prev) => [room, ...prev.filter((r) => r.id !== room.id)]);
      showToast(`Sala "${room.name}" criada com sucesso!`, 'success');
      return room;
    },
    [showToast],
  );

  const updateRoom = useCallback(
    async (payload: UpdateRoomPayload) => {
      if (!currentRoom) {
        throw new Error('Você não está em uma sala.');
      }
      const response = await emitUpdateRoom(currentRoom.id, payload);
      if (!response.success || !response.data?.room) {
        throw new Error(
          response.message ?? 'Não foi possível atualizar a sala.',
        );
      }
      const room = withCurrentFlags(response.data.room, getSessionPlayerId());
      setCurrentRoom(room);
      setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
      showToast('Sala atualizada com sucesso!', 'success');
      return room;
    },
    [currentRoom, showToast],
  );

  const joinRoom = useCallback(
    async (roomId: string, password?: string) => {
      const response = await emitJoinRoom(roomId, password);
      if (!response.success || !response.data?.room) {
        throw new Error(response.message ?? 'Não foi possível entrar na sala.');
      }
      const id = getSessionPlayerId();
      const room = withCurrentFlags(response.data.room, id);
      setCurrentRoom(room);
      setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
      showToast(`Você entrou na sala "${room.name}".`, 'success');
      return room;
    },
    [showToast],
  );

  const leaveRoom = useCallback(async () => {
    if (!currentRoom) return;
    const response = await emitLeaveRoom(currentRoom.id);
    if (!response.success) {
      throw new Error(response.message ?? 'Não foi possível sair da sala.');
    }
    setCurrentRoom(null);
    await refreshLobby();
    showToast(
      currentRoom.status === 'playing'
        ? 'Você saiu da partida.'
        : 'Você saiu da sala.',
      'info',
    );
  }, [currentRoom, refreshLobby, showToast]);

  const loadRoom = useCallback(async (roomId: string) => {
    if (currentRoom?.id === roomId) return currentRoom;
    const found = rooms.find((room) => room.id === roomId);
    if (found) {
      setCurrentRoom(withCurrentFlags(found, getSessionPlayerId()));
      return found;
    }
    // Ask lobby snapshot; room may appear after join.
    const response = await emitGetLobbyState();
    const room = response.data?.rooms.find((item) => item.id === roomId) ?? null;
    if (room) {
      const flagged = withCurrentFlags(room, getSessionPlayerId());
      setCurrentRoom(flagged);
      return flagged;
    }
    return currentRoom?.id === roomId ? currentRoom : null;
  }, [currentRoom, rooms]);

  const toggleReady = useCallback(async () => {
    if (!currentRoom || !playerId) return;
    const me = currentRoom.players.find((p) => p.id === playerId);
    const nextReady = !me?.isReady;
    const response = await emitPlayerReady(currentRoom.id, nextReady);
    if (!response.success || !response.data?.room) {
      throw new Error(response.message ?? 'Não foi possível atualizar o status.');
    }
    setCurrentRoom(withCurrentFlags(response.data.room, playerId));
  }, [currentRoom, playerId]);

  const setPlayerColor = useCallback(
    async (color: string) => {
      if (!currentRoom) return;
      const response = await emitSetPlayerColor(currentRoom.id, color);
      if (!response.success || !response.data?.room) {
        throw new Error(response.message ?? 'Não foi possível alterar a cor.');
      }
      setCurrentRoom(withCurrentFlags(response.data.room, getSessionPlayerId()));
    },
    [currentRoom],
  );

  const kickPlayer = useCallback(
    async (targetPlayerId: string) => {
      if (!currentRoom) return;
      const response = await emitKickPlayer(currentRoom.id, targetPlayerId);
      if (!response.success || !response.data?.room) {
        throw new Error(response.message ?? 'Não foi possível expulsar.');
      }
      const removed = currentRoom.players.find((p) => p.id === targetPlayerId);
      const room = withCurrentFlags(response.data.room, getSessionPlayerId());
      setCurrentRoom(room);
      setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
      showToast(`${removed?.nickname ?? 'Jogador'} foi removido da sala.`, 'info');
    },
    [currentRoom, showToast],
  );

  const addBot = useCallback(async () => {
    if (!currentRoom) return;
    const response = await emitAddBot(currentRoom.id);
    if (!response.success || !response.data?.room) {
      throw new Error(response.message ?? 'Não foi possível adicionar o bot.');
    }
    const room = withCurrentFlags(response.data.room, getSessionPlayerId());
    const bot = room.players.find(
      (p) => p.isBot && !currentRoom.players.some((c) => c.id === p.id),
    );
    setCurrentRoom(room);
    setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
    showToast(`Bot ${bot?.nickname ?? ''} adicionado à sala.`, 'success');
  }, [currentRoom, showToast]);

  const replacePlayerWithBot = useCallback(
    async (targetPlayerId: string) => {
      if (!currentRoom) return;
      const previous = currentRoom.players.find((p) => p.id === targetPlayerId);
      const response = await emitReplaceWithBot(currentRoom.id, targetPlayerId);
      if (!response.success || !response.data?.room) {
        throw new Error(response.message ?? 'Não foi possível substituir.');
      }
      const room = withCurrentFlags(response.data.room, getSessionPlayerId());
      const bot = room.players.find(
        (p) => p.isBot && !currentRoom.players.some((c) => c.id === p.id),
      );
      setCurrentRoom(room);
      setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
      showToast(
        `${previous?.nickname ?? 'Jogador'} foi substituído por ${bot?.nickname ?? 'um bot'}.`,
        'info',
      );
    },
    [currentRoom, showToast],
  );

  useEffect(() => {
    if (!storedNickname) return;

    let cancelled = false;

    const boot = async () => {
      try {
        await connectSocket(storedNickname);
        if (cancelled) return;
        setPlayerId(getSessionPlayerId());
        await refreshLobby();
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : 'Não foi possível conectar ao servidor.';
          showToast(message, 'error');
        }
      }
    };

    void boot();

    const unsubs = [
      onSocketEvent('session:ready', (payload) => {
        const data = payload as { playerId: string };
        setPlayerId(data.playerId);
      }),
      onSocketEvent('lobby:rooms-updated', (payload) => {
        setRooms(payload as Room[]);
      }),
      onSocketEvent('lobby:players-updated', (payload) => {
        setOnlinePlayers(
          markCurrentUser(payload as Player[], getSessionPlayerId()),
        );
      }),
      onSocketEvent('room:updated', (payload) => {
        const room = withCurrentFlags(payload as Room, getSessionPlayerId());
        setCurrentRoom((prev) => (prev && prev.id === room.id ? room : prev));
        setRooms((prev) => {
          const exists = prev.some((item) => item.id === room.id);
          if (!exists) return [room, ...prev];
          return prev.map((item) => (item.id === room.id ? room : item));
        });
      }),
      onSocketEvent('room:kicked', () => {
        setCurrentRoom(null);
        showToast('Você foi removido da sala.', 'info');
      }),
    ];

    return () => {
      cancelled = true;
      for (const unsub of unsubs) unsub();
    };
  }, [storedNickname, refreshLobby, showToast]);

  const value = useMemo<UserContextValue>(
    () => ({
      nickname: storedNickname,
      currentUser,
      rooms,
      onlinePlayers,
      currentRoom,
      isLoadingRooms,
      isLoadingPlayers,
      toasts,
      setNickname,
      changeNickname,
      clearUser,
      refreshRooms,
      refreshPlayers,
      createRoom,
      updateRoom,
      joinRoom,
      leaveRoom,
      loadRoom,
      toggleReady,
      setPlayerColor,
      kickPlayer,
      addBot,
      replacePlayerWithBot,
      setCurrentRoom,
      showToast,
      dismissToast,
    }),
    [
      storedNickname,
      currentUser,
      rooms,
      onlinePlayers,
      currentRoom,
      isLoadingRooms,
      isLoadingPlayers,
      toasts,
      setNickname,
      changeNickname,
      clearUser,
      refreshRooms,
      refreshPlayers,
      createRoom,
      updateRoom,
      joinRoom,
      leaveRoom,
      loadRoom,
      toggleReady,
      setPlayerColor,
      kickPlayer,
      addBot,
      replacePlayerWithBot,
      showToast,
      dismissToast,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
