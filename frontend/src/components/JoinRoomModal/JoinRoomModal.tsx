import { useEffect, useId, useState, type FormEvent } from 'react';
import { Lock, X } from 'lucide-react';
import type { Room } from '../../types/room';
import { Button } from '../Button/Button';
import styles from './JoinRoomModal.module.css';

interface JoinRoomModalProps {
  open: boolean;
  room: Room | null;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}

export function JoinRoomModal({
  open,
  room,
  onClose,
  onSubmit,
}: JoinRoomModalProps) {
  const titleId = useId();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setPasswordError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !room) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmed = password.trim();
    if (!trimmed) {
      setPasswordError('Informe a senha da sala.');
      return;
    }

    setIsSubmitting(true);
    setPasswordError(null);
    try {
      await onSubmit(trimmed);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível entrar na sala.';
      setPasswordError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.header}>
          <h2 id={titleId}>Sala privada</h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </header>

        <form
          className={styles.form}
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
        >
          <p className={styles.hint}>
            <Lock size={16} aria-hidden="true" />
            A sala <strong>{room.name}</strong> está protegida por senha.
          </p>

          <div className={styles.field}>
            <label htmlFor="join-room-password">Senha da sala</label>
            <input
              id="join-room-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="Digite a senha"
              autoFocus
              aria-invalid={Boolean(passwordError)}
              aria-describedby={
                passwordError ? 'join-room-password-error' : undefined
              }
            />
            {passwordError && (
              <span
                id="join-room-password-error"
                className={styles.error}
                role="alert"
              >
                {passwordError}
              </span>
            )}
          </div>

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando...' : 'Entrar na sala'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
