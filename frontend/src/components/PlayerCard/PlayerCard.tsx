import type { Player } from '../../types/player';
import { PLAYER_STATUS_LABELS } from '../../utils/constants';
import { PlayerAvatar } from '../PlayerAvatar/PlayerAvatar';
import { StatusBadge } from '../StatusBadge/StatusBadge';
import styles from './PlayerCard.module.css';

interface PlayerCardProps {
  player: Player;
}

function getTone(status: Player['status']) {
  if (status === 'available' || status === 'ready') return 'success' as const;
  if (status === 'playing') return 'warning' as const;
  if (status === 'eliminated') return 'danger' as const;
  return 'info' as const;
}

export function PlayerCard({ player }: PlayerCardProps) {
  return (
    <article
      className={`${styles.card} ${player.isCurrentUser ? styles.current : ''}`}
    >
      <div className={styles.left}>
        <span className={styles.online} aria-label="Online" />
        <PlayerAvatar
          nickname={player.nickname}
          size="sm"
          highlighted={Boolean(player.isCurrentUser)}
        />
        <div className={styles.info}>
          <strong>
            {player.nickname}
            {player.isCurrentUser && (
              <span className={styles.you}> — Você</span>
            )}
          </strong>
        </div>
      </div>
      <StatusBadge
        label={PLAYER_STATUS_LABELS[player.status] ?? player.status}
        tone={getTone(player.status)}
        withDot={player.status === 'available'}
      />
    </article>
  );
}
