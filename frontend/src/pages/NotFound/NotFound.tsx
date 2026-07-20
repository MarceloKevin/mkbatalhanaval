import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import styles from './NotFound.module.css';

export function NotFoundPage() {
  return (
    <main className={`${styles.page} page-enter`}>
      <div className={styles.card}>
        <Compass size={48} aria-hidden="true" />
        <h1>Página não encontrada</h1>
        <p>
          Este mapa não existe nos sete mares. Verifique a rota e tente novamente.
        </p>
        <Link to="/" className={styles.link}>
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
