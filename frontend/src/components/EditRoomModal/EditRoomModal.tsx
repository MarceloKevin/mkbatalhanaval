import { useEffect, useId, useState, type FormEvent } from 'react';
import { Lock, LockOpen, X } from 'lucide-react';
import type { MaxPlayers, Room, UpdateRoomPayload } from '../../types/room';
import { MAX_PLAYERS_OPTIONS } from '../../utils/constants';
import { validateRoomName, validateRoomPassword } from '../../utils/validators';
import { Button } from '../Button/Button';
import styles from './EditRoomModal.module.css';

interface EditRoomModalProps {
  open: boolean;
  room: Room;
  onClose: () => void;
  onSubmit: (payload: UpdateRoomPayload) => Promise<void>;
}

export function EditRoomModal({
  open,
  room,
  onClose,
  onSubmit,
}: EditRoomModalProps) {
  const titleId = useId();
  const [name, setName] = useState(room.name);
  const [maxPlayers, setMaxPlayers] = useState<MaxPlayers>(room.maxPlayers);
  const [isPrivate, setIsPrivate] = useState(room.isPrivate);
  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(room.name);
    setMaxPlayers(room.maxPlayers);
    setIsPrivate(room.isPrivate);
    setPassword('');
    setNameError(null);
    setPasswordError(null);
    setFormError(null);
    setIsSubmitting(false);
  }, [open, room]);

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
    setFormError(null);

    const nameValidation = validateRoomName(name);
    setNameError(nameValidation.error);
    if (!nameValidation.valid) return;

    if (isPrivate && !room.isPrivate) {
      const addValidation = validateRoomPassword(true, password);
      setPasswordError(addValidation.error);
      if (!addValidation.valid) return;
    } else if (isPrivate && password.trim()) {
      const changeValidation = validateRoomPassword(true, password);
      setPasswordError(changeValidation.error);
      if (!changeValidation.valid) return;
    } else {
      setPasswordError(null);
    }

    if (maxPlayers < room.players.length) {
      setFormError(
        `Há ${room.players.length} jogadores na sala. Escolha no mínimo esse valor.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        maxPlayers,
        isPrivate,
        password: isPrivate && password.trim() ? password.trim() : undefined,
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a sala.',
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
          <h2 id={titleId}>Editar sala</h2>
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
          <div className={styles.field}>
            <label htmlFor="edit-room-name">Nome da sala</label>
            <input
              id="edit-room-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              maxLength={30}
              placeholder="Ex: Batalha no Atlântico"
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? 'edit-room-name-error' : undefined}
              autoFocus
            />
            {nameError && (
              <span id="edit-room-name-error" className={styles.error} role="alert">
                {nameError}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <span id="edit-max-players-label">Quantidade máxima de jogadores</span>
            <div
              className={styles.options}
              role="group"
              aria-labelledby="edit-max-players-label"
            >
              {MAX_PLAYERS_OPTIONS.map((option) => {
                const disabled = option < room.players.length;
                return (
                  <button
                    key={option}
                    type="button"
                    className={`${styles.option} ${
                      maxPlayers === option ? styles.optionActive : ''
                    }`}
                    onClick={() => setMaxPlayers(option)}
                    aria-pressed={maxPlayers === option}
                    disabled={disabled}
                    title={
                      disabled
                        ? `Há ${room.players.length} jogadores na sala`
                        : undefined
                    }
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {room.players.length > 2 && (
              <span className={styles.hint}>
                Opções abaixo de {room.players.length} estão bloqueadas porque já
                há jogadores na sala.
              </span>
            )}
          </div>

          <div className={styles.privacy}>
            <div className={styles.privacyHeader}>
              <span className={styles.privacyLabel}>
                {isPrivate ? (
                  <>
                    <Lock size={16} aria-hidden="true" />
                    Sala com senha
                  </>
                ) : (
                  <>
                    <LockOpen size={16} aria-hidden="true" />
                    Sala pública
                  </>
                )}
              </span>

              {isPrivate ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsPrivate(false);
                    setPassword('');
                    setPasswordError(null);
                  }}
                >
                  <LockOpen size={14} aria-hidden="true" />
                  Retirar senha
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsPrivate(true);
                    setPassword('');
                    setPasswordError(null);
                  }}
                >
                  <Lock size={14} aria-hidden="true" />
                  Adicionar senha
                </Button>
              )}
            </div>

            {isPrivate && (
              <div className={styles.field}>
                <label htmlFor="edit-room-password">
                  {room.isPrivate
                    ? 'Nova senha (opcional)'
                    : 'Senha da sala'}
                </label>
                <input
                  id="edit-room-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder={
                    room.isPrivate
                      ? 'Deixe em branco para manter a atual'
                      : 'Digite uma senha'
                  }
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={
                    passwordError ? 'edit-room-password-error' : undefined
                  }
                />
                {passwordError && (
                  <span
                    id="edit-room-password-error"
                    className={styles.error}
                    role="alert"
                  >
                    {passwordError}
                  </span>
                )}
              </div>
            )}
          </div>

          {formError && (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          )}

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
