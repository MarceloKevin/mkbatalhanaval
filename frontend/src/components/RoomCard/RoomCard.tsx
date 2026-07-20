import { DoorOpen, Lock, Users } from 'lucide-react';
import type { Room } from '../../types/room';
import { ROOM_STATUS_LABELS } from '../../utils/constants';
import { Button } from '../Button/Button';
import { StatusBadge } from '../StatusBadge/StatusBadge';
import styles from './RoomCard.module.css';

interface RoomCardProps {
  room: Room;
  onJoin: (roomId: string) => void;
  isJoining?: boolean;
}

function getTone(status: Room['status']) {
  if (status === 'waiting') return 'success' as const;
  if (status === 'almost-full') return 'warning' as const;
  if (status === 'full' || status === 'playing') return 'danger' as const;
  return 'info' as const;
}

export function RoomCard({ room, onJoin, isJoining = false }: RoomCardProps) {
  const occupancy = (room.players.length / room.maxPlayers) * 100;
  const disabled =
    room.status === 'full' ||
    room.status === 'playing' ||
    room.players.length >= room.maxPlayers;

  return (
    <article
      className={`${styles.card} ${room.isPrivate ? styles.privateCard : ''}`}
    >
      <div className={styles.top}>
        <div className={styles.titleBlock}>
          <h3>{room.name}</h3>
          <p className={styles.owner}>Criador: {room.ownerNickname}</p>
        </div>
        <StatusBadge
          label={ROOM_STATUS_LABELS[room.status] ?? room.status}
          tone={getTone(room.status)}
        />
      </div>

      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <span className={styles.players}>
            <Users size={16} aria-hidden="true" />
            {room.players.length}/{room.maxPlayers} jogadores
          </span>
          {room.isPrivate && (
            <span className={styles.privateBadge} title="Sala protegida por senha">
              <Lock size={12} aria-hidden="true" />
              Com senha
            </span>
          )}
        </div>
        <div
          className={styles.bar}
          role="progressbar"
          aria-valuenow={room.players.length}
          aria-valuemin={0}
          aria-valuemax={room.maxPlayers}
          aria-label="Ocupação da sala"
        >
          <div className={styles.fill} style={{ width: `${occupancy}%` }} />
        </div>
      </div>

      <Button
        variant="primary"
        size="sm"
        fullWidth
        disabled={disabled || isJoining}
        onClick={() => onJoin(room.id)}
      >
        <DoorOpen size={16} aria-hidden="true" />
        {disabled
          ? 'Indisponível'
          : room.isPrivate
            ? 'Entrar com senha'
            : 'Entrar na sala'}
      </Button>
    </article>
  );
}
