import styles from './OceanBackground.module.css';

interface OceanBackgroundProps {
  variant?: 'full' | 'subtle';
}

export function OceanBackground({ variant = 'full' }: OceanBackgroundProps) {
  return (
    <div className={`${styles.bg} ${styles[variant]}`} aria-hidden="true">
      <div className={styles.radar} />
      <div className={styles.shipSilhouette} />
      <div className={styles.shipSilhouetteSecondary} />
      <div className={styles.bubbles}>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={styles.bubble}
            style={{
              left: `${8 + i * 9}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${10 + (i % 4) * 2}s`,
              width: `${8 + (i % 3) * 4}px`,
              height: `${8 + (i % 3) * 4}px`,
            }}
          />
        ))}
      </div>
      <div className={styles.waves}>
        <div className={styles.wave} />
        <div className={`${styles.wave} ${styles.wave2}`} />
      </div>
    </div>
  );
}
