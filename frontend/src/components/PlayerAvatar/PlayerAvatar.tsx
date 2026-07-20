import styles from './PlayerAvatar.module.css';

interface PlayerAvatarProps {
  nickname: string;
  size?: 'sm' | 'md' | 'lg';
  highlighted?: boolean;
  color?: string;
}

export function PlayerAvatar({
  nickname,
  size = 'md',
  highlighted = false,
  color,
}: PlayerAvatarProps) {
  const letter = nickname.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className={`${styles.avatar} ${styles[size]} ${highlighted ? styles.highlighted : ''}`}
      style={
        color
          ? {
              background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 55%, #0c4a6e))`,
            }
          : undefined
      }
      aria-hidden="true"
    >
      {letter}
    </div>
  );
}
