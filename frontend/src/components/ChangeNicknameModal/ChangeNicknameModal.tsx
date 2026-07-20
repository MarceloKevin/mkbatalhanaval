import { useEffect, useId, useState, type FormEvent } from 'react';
import { Pencil, X } from 'lucide-react';
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
} from '../../utils/constants';
import { validateNickname } from '../../utils/validators';
import { Button } from '../Button/Button';
import styles from './ChangeNicknameModal.module.css';

interface ChangeNicknameModalProps {
  open: boolean;
  currentNickname: string;
  onClose: () => void;
  onSubmit: (nickname: string) => Promise<void>;
}

export function ChangeNicknameModal({
  open,
  currentNickname,
  onClose,
  onSubmit,
}: ChangeNicknameModalProps) {
  const titleId = useId();
  const [value, setValue] = useState(currentNickname);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(currentNickname);
    setError(null);
    setIsSubmitting(false);
  }, [open, currentNickname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmed = value.trim();
    const validation = validateNickname(trimmed);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    if (trimmed.toLowerCase() === currentNickname.trim().toLowerCase()) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível alterar o nickname.',
      );
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
          <h2 id={titleId}>Trocar nickname</h2>
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
            <Pencil size={16} aria-hidden="true" />
            Escolha um novo nome de comandante. Ele precisa estar disponível.
          </p>

          <div className={styles.field}>
            <label htmlFor="change-nickname">Novo nickname</label>
            <input
              id="change-nickname"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              minLength={NICKNAME_MIN_LENGTH}
              maxLength={NICKNAME_MAX_LENGTH}
              placeholder="Ex: CapitãoKevin"
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'change-nickname-error' : undefined}
            />
            {error && (
              <span id="change-nickname-error" className={styles.error} role="alert">
                {error}
              </span>
            )}
          </div>

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar nickname'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
