import styles from './StatusBadge.module.css';

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
  withDot?: boolean;
}

export function StatusBadge({
  label,
  tone = 'info',
  withDot = false,
}: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {withDot && <span className={styles.dot} aria-hidden="true" />}
      {label}
    </span>
  );
}
