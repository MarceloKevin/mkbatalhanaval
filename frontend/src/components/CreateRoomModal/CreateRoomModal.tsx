import { useEffect, useId, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { CreateRoomPayload, MaxPlayers } from '../../types/room';
import { MAX_PLAYERS_OPTIONS } from '../../utils/constants';
import { validateRoomName, validateRoomPassword } from '../../utils/validators';
import { Button } from '../Button/Button';
import styles from './CreateRoomModal.module.css';

interface CreateRoomModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateRoomPayload) => Promise<void>;
}

export function CreateRoomModal({ open, onClose, onSubmit }: CreateRoomModalProps) {
  const titleId = useId();
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<MaxPlayers>(4);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setMaxPlayers(4);
      setIsPrivate(false);
      setPassword('');
      setNameError(null);
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

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const nameValidation = validateRoomName(name);
    const passwordValidation = validateRoomPassword(isPrivate, password);

    setNameError(nameValidation.error);
    setPasswordError(passwordValidation.error);

    if (!nameValidation.valid || !passwordValidation.valid) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        maxPlayers,
        isPrivate,
        password: isPrivate ? password.trim() : undefined,
      });
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
          <h2 id={titleId}>Criar sala</h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </header>

        <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className={styles.field}>
            <label htmlFor="room-name">Nome da sala</label>
            <input
              id="room-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              maxLength={30}
              placeholder="Ex: Batalha no Atlântico"
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? 'room-name-error' : undefined}
              autoFocus
            />
            {nameError && (
              <span id="room-name-error" className={styles.error} role="alert">
                {nameError}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <span id="max-players-label">Quantidade máxima de jogadores</span>
            <div
              className={styles.options}
              role="group"
              aria-labelledby="max-players-label"
            >
              {MAX_PLAYERS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`${styles.option} ${maxPlayers === option ? styles.optionActive : ''}`}
                  onClick={() => setMaxPlayers(option)}
                  aria-pressed={maxPlayers === option}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => {
                setIsPrivate(e.target.checked);
                if (!e.target.checked) {
                  setPassword('');
                  setPasswordError(null);
                }
              }}
            />
            Sala privada
          </label>

          {isPrivate && (
            <div className={styles.field}>
              <label htmlFor="room-password">Senha da sala</label>
              <input
                id="room-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
                placeholder="Digite uma senha"
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? 'room-password-error' : undefined}
              />
              {passwordError && (
                <span id="room-password-error" className={styles.error} role="alert">
                  {passwordError}
                </span>
              )}
            </div>
          )}

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Criando...' : 'Criar sala'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
