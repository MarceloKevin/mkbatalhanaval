import { Users } from 'lucide-react';
import type { Player } from '../../types/player';
import { PlayerCard } from '../PlayerCard/PlayerCard';
import styles from './OnlinePlayersList.module.css';

interface OnlinePlayersListProps {
  players: Player[];
  isLoading?: boolean;
}

export function OnlinePlayersList({
  players,
  isLoading = false,
}: OnlinePlayersListProps) {
  return (
    <section className={styles.panel} aria-labelledby="online-players-title">
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <Users size={20} aria-hidden="true" />
          <h2 id="online-players-title">Jogadores online</h2>
        </div>
        <span className={styles.count}>{players.length}</span>
      </header>

      <div className={styles.list} role="list">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeleton} aria-hidden="true" />
            ))
          : players.map((player) => (
              <div key={player.id} role="listitem">
                <PlayerCard player={player} />
              </div>
            ))}
      </div>
    </section>
  );
}
