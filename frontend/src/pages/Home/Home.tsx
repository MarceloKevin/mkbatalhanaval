import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Anchor, Ship } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { useUser } from '../../hooks/useUser';
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
} from '../../utils/constants';
import { validateNickname } from '../../utils/validators';
import styles from './Home.module.css';

export function HomePage() {
  const { nickname, setNickname } = useUser();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (nickname) {
    return <Navigate to="/lobby" replace />;
  }

  const submit = async () => {
    const validation = validateNickname(value);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setSubmitting(true);
    try {
      await setNickname(value.trim());
      navigate('/lobby');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível conectar.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <main className={`${styles.page} page-enter`}>
      <div className={styles.card}>
        <div className={styles.iconWrap} aria-hidden="true">
          <Ship size={48} />
        </div>

        <h1 className={styles.title}>Batalha Naval</h1>
        <p className={styles.subtitle}>
          Prepare sua frota, desafie outros jogadores e domine os mares.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label htmlFor="nickname" className={styles.label}>
            <Anchor size={16} aria-hidden="true" />
            Seu nickname
          </label>
          <input
            id="nickname"
            className={styles.input}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ex: CapitãoKevin"
            minLength={NICKNAME_MIN_LENGTH}
            maxLength={NICKNAME_MAX_LENGTH}
            autoComplete="nickname"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'nickname-error' : 'nickname-hint'}
            autoFocus
          />
          <span id="nickname-hint" className={styles.hint}>
            Entre {NICKNAME_MIN_LENGTH} e {NICKNAME_MAX_LENGTH} caracteres
          </span>
          {error && (
            <span id="nickname-error" className={styles.error} role="alert">
              {error}
            </span>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            className={styles.cta}
            disabled={submitting}
          >
            {submitting ? 'Conectando...' : 'Jogue agora'}
          </Button>
        </form>
      </div>
    </main>
  );
}
