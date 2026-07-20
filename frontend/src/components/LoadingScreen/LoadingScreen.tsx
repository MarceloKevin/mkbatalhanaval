import { Ship } from 'lucide-react';
import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({
  message = 'Carregando...',
}: LoadingScreenProps) {
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <div className={styles.icon}>
        <Ship size={36} aria-hidden="true" />
      </div>
      <p>{message}</p>
    </div>
  );
}
