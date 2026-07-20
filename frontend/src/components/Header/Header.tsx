import { Anchor, LogOut, Pencil, Ship, Wifi } from 'lucide-react';
import { Button } from '../Button/Button';
import { PlayerAvatar } from '../PlayerAvatar/PlayerAvatar';
import styles from './Header.module.css';

interface HeaderProps {
  nickname: string;
  onLogout: () => void;
  onEditNickname?: () => void;
}

export function Header({ nickname, onLogout, onEditNickname }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Ship size={28} aria-hidden="true" />
        <span className={styles.brandName}>Batalha Naval</span>
      </div>

      <div className={styles.status}>
        <Wifi size={16} aria-hidden="true" />
        <span>Servidor online</span>
        <span className={styles.onlineDot} aria-hidden="true" />
      </div>

      <div className={styles.user}>
        <PlayerAvatar nickname={nickname} size="sm" highlighted />
        <div className={styles.userInfo}>
          <span className={styles.userLabel}>
            <Anchor size={12} aria-hidden="true" /> Comandante
          </span>
          <div className={styles.nickRow}>
            <strong>{nickname}</strong>
            {onEditNickname && (
              <button
                type="button"
                className={styles.editNick}
                onClick={onEditNickname}
                aria-label="Trocar nickname"
                title="Trocar nickname"
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          aria-label="Sair da conta"
        >
          <LogOut size={16} aria-hidden="true" />
          Sair
        </Button>
      </div>
    </header>
  );
}
