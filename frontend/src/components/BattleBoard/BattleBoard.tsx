import type { BoardCell, CellStatus } from '../../types/game';
import type { Player } from '../../types/player';
import {
  canAttackCell,
  getColumnLabel,
  getDisplayStatus,
} from '../../utils/boardHelpers';
import { resolvePlayerColor } from '../../utils/playerColors';
import { BoardCellComponent } from '../BoardCell/BoardCell';
import styles from './BattleBoard.module.css';

interface BattleBoardProps {
  board: BoardCell[][];
  rows?: number;
  columns?: number;
  interactive?: boolean;
  viewerId?: string;
  players?: Player[];
  onCellClick?: (row: number, column: number) => void;
  title?: string;
}

export function BattleBoard({
  board,
  rows = 10,
  columns = 10,
  interactive = false,
  viewerId,
  players = [],
  onCellClick,
  title,
}: BattleBoardProps) {
  const cells = [];

  cells.push(
    <div key="corner" className={styles.corner} aria-hidden="true" />,
  );

  for (let col = 0; col < columns; col += 1) {
    cells.push(
      <div key={`col-${col}`} className={styles.label} aria-hidden="true">
        {getColumnLabel(col)}
      </div>,
    );
  }

  for (let row = 0; row < rows; row += 1) {
    cells.push(
      <div key={`row-${row}`} className={styles.label} aria-hidden="true">
        {row + 1}
      </div>,
    );

    for (let col = 0; col < columns; col += 1) {
      const cell = board[row]?.[col] ?? {
        row,
        column: col,
        status: 'water' as CellStatus,
      };

      const displayStatus = getDisplayStatus(cell, viewerId);
      const attackable = interactive && canAttackCell(cell, viewerId);
      const hitColor =
        displayStatus === 'hit' || displayStatus === 'destroyed'
          ? resolvePlayerColor(players, cell.ownerId)
          : undefined;

      cells.push(
        <BoardCellComponent
          key={`${row}-${col}`}
          row={row}
          column={col}
          status={displayStatus}
          interactive={attackable}
          hitColor={hitColor}
          onClick={onCellClick}
        />,
      );
    }
  }

  return (
    <div className={styles.wrapper}>
      {title && <h3 className={styles.title}>{title}</h3>}
      <div className={styles.scroll}>
        <div
          className={styles.board}
          style={{
            gridTemplateColumns: `28px repeat(${columns}, minmax(20px, 1fr))`,
            maxWidth: `${Math.min(560, 40 + columns * 32)}px`,
          }}
          role="grid"
          aria-label={title ?? 'Tabuleiro de batalha naval'}
        >
          {cells}
        </div>
      </div>
    </div>
  );
}
