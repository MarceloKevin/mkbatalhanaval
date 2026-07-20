import type { CellStatus } from '../../types/game';
import { getColumnLabel } from '../../utils/boardHelpers';
import { darkenHex } from '../../utils/playerColors';
import styles from './BoardCell.module.css';

interface BoardCellProps {
  row: number;
  column: number;
  status: CellStatus;
  interactive?: boolean;
  /** Color of the ship owner — used for hit/destroyed cells. */
  hitColor?: string;
  onClick?: (row: number, column: number) => void;
}

export function BoardCellComponent({
  row,
  column,
  status,
  interactive = false,
  hitColor,
  onClick,
}: BoardCellProps) {
  const label = `${getColumnLabel(column)}${row + 1}`;
  const canClick = interactive;
  const usesPlayerColor =
    Boolean(hitColor) && (status === 'hit' || status === 'destroyed');

  const coloredStyle = usesPlayerColor
    ? {
        background:
          status === 'destroyed'
            ? `linear-gradient(145deg, ${hitColor}, ${darkenHex(hitColor!, 0.4)})`
            : `linear-gradient(145deg, ${hitColor}, ${darkenHex(hitColor!, 0.2)})`,
      }
    : undefined;

  return (
    <button
      type="button"
      className={`${styles.cell} ${styles[status]} ${canClick ? styles.clickable : ''} ${
        usesPlayerColor ? styles.coloredHit : ''
      }`}
      style={coloredStyle}
      disabled={!canClick}
      onClick={() => onClick?.(row, column)}
      aria-label={`Célula ${label}, ${status}`}
      title={label}
    >
      {(status === 'miss' || status === 'hit' || status === 'destroyed') && (
        <span className={styles.marker} aria-hidden="true" />
      )}
    </button>
  );
}
