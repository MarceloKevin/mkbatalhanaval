import type { GameAction } from '../../types/game';
import styles from './GameHistory.module.css';

interface GameHistoryProps {
  actions: GameAction[];
}

export function GameHistory({ actions }: GameHistoryProps) {
  return (
    <section className={styles.panel} aria-labelledby="history-title">
      <h3 id="history-title">Histórico da partida</h3>
      <ul className={styles.list}>
        {actions.length === 0 && (
          <li className={styles.empty}>Nenhuma ação ainda.</li>
        )}
        {[...actions].reverse().map((action) => (
          <li key={action.id} className={`${styles.item} ${styles[action.type]}`}>
            {action.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
