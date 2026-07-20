import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import styles from './SearchInput.module.css';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function SearchInput({ label = 'Pesquisar', className = '', ...rest }: SearchInputProps) {
  return (
    <label className={`${styles.wrapper} ${className}`}>
      <span className="sr-only">{label}</span>
      <Search className={styles.icon} size={18} aria-hidden="true" />
      <input className={styles.input} type="search" {...rest} />
    </label>
  );
}
