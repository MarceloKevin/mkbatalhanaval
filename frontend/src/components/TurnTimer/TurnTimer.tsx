import { Timer } from 'lucide-react';
import styles from './TurnTimer.module.css';

interface TurnTimerProps {
  secondsLeft: number;
  totalSeconds: number;
  playerNickname: string;
  isMyTurn: boolean;
}

export function TurnTimer({
  secondsLeft,
  totalSeconds,
  playerNickname,
  isMyTurn,
}: TurnTimerProps) {
  const progress = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));
  const urgent = secondsLeft <= 5;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div
      className={`${styles.timer} ${isMyTurn ? styles.mine : styles.theirs} ${urgent ? styles.urgent : ''}`}
      role="timer"
      aria-live="polite"
      aria-label={`Tempo restante de ${playerNickname}: ${display}`}
    >
      <div className={styles.header}>
        <Timer size={18} aria-hidden="true" />
        <span className={styles.label}>
          {isMyTurn ? 'Seu tempo' : `Tempo de ${playerNickname}`}
        </span>
        <strong className={styles.countdown}>{display}</strong>
      </div>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
