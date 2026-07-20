import { useEffect, useId, useRef, useState } from 'react';
import { Bot, Pencil, UserX } from 'lucide-react';
import type { Player } from '../../types/player';
import { PLAYER_COLORS } from '../../utils/constants';
import { Button } from '../Button/Button';
import { PlayerAvatar } from '../PlayerAvatar/PlayerAvatar';
import { StatusBadge } from '../StatusBadge/StatusBadge';
import styles from './RoomPlayersList.module.css';

interface RoomPlayersListProps {
  players: Player[];
  maxPlayers: number;
  currentUserId?: string;
  isOwner?: boolean;
  onKick?: (playerId: string) => void;
  onAddBot?: () => void;
  onReplaceWithBot?: (playerId: string) => void;
  onChangeColor?: (color: string) => void;
  onEditNickname?: () => void;
  busyPlayerId?: string | null;
  isAddingBot?: boolean;
  isChangingColor?: boolean;
}

export function RoomPlayersList({
  players,
  maxPlayers,
  currentUserId,
  isOwner = false,
  onKick,
  onAddBot,
  onReplaceWithBot,
  onChangeColor,
  onEditNickname,
  busyPlayerId = null,
  isAddingBot = false,
  isChangingColor = false,
}: RoomPlayersListProps) {
  const slots = Array.from({ length: maxPlayers }, (_, index) => {
    return players[index] ?? null;
  });

  const firstEmptyIndex = slots.findIndex((slot) => slot === null);
  const takenColors = new Set(
    players.map((player) => player.color).filter(Boolean) as string[],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerId = useId();

  useEffect(() => {
    if (!pickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setPickerOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pickerOpen]);

  return (
    <div className={styles.list} role="list">
      {slots.map((player, index) => {
        if (!player) {
          const showAddBot = isOwner && onAddBot && index === firstEmptyIndex;

          return (
            <div
              key={`empty-${index}`}
              className={`${styles.slot} ${styles.empty}`}
              role="listitem"
            >
              <span className={styles.position}>{index + 1}</span>
              <div className={styles.emptyAvatar} aria-hidden="true" />
              <div className={styles.emptyContent}>
                <span className={styles.emptyText}>Aguardando jogador...</span>
                {showAddBot && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isAddingBot}
                    onClick={onAddBot}
                    aria-label="Adicionar bot nesta posição"
                  >
                    <Bot size={14} aria-hidden="true" />
                    Adicionar bot
                  </Button>
                )}
              </div>
            </div>
          );
        }

        const isMe = player.id === currentUserId || player.isCurrentUser;
        const canManage = isOwner && !player.isRoomOwner && !isMe;
        const isBusy = busyPlayerId === player.id;
        const canChangeColor = isMe && Boolean(onChangeColor);
        const canEditNickname = isMe && Boolean(onEditNickname);

        return (
          <div
            key={player.id}
            className={`${styles.slot} ${isMe ? styles.me : ''}`}
            role="listitem"
          >
            <span className={styles.position}>{index + 1}</span>
            <PlayerAvatar
              nickname={player.nickname}
              size="sm"
              highlighted={isMe}
              color={player.color}
            />
            <div className={styles.info}>
              <div className={styles.nickRow}>
                <strong>
                  {player.nickname}
                  {isMe && <span className={styles.you}> (Você)</span>}
                </strong>
                {canEditNickname && (
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
                {player.color && (
                  <div
                    className={styles.colorControl}
                    ref={canChangeColor ? pickerRef : undefined}
                  >
                    {canChangeColor ? (
                      <>
                        <button
                          type="button"
                          className={styles.colorSwatch}
                          style={{ backgroundColor: player.color }}
                          aria-label="Trocar sua cor"
                          aria-expanded={pickerOpen}
                          aria-controls={pickerId}
                          disabled={isChangingColor}
                          onClick={() => setPickerOpen((open) => !open)}
                          title="Trocar cor"
                        />
                        {pickerOpen && (
                          <div
                            id={pickerId}
                            className={styles.colorPicker}
                            role="listbox"
                            aria-label="Escolher cor"
                          >
                            {PLAYER_COLORS.map((color) => {
                              const taken =
                                takenColors.has(color) &&
                                color !== player.color;
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  role="option"
                                  aria-selected={color === player.color}
                                  className={`${styles.colorOption} ${
                                    color === player.color
                                      ? styles.colorSelected
                                      : ''
                                  }`}
                                  style={{ backgroundColor: color }}
                                  disabled={taken || isChangingColor}
                                  title={
                                    taken
                                      ? 'Cor já usada por outro jogador'
                                      : color
                                  }
                                  onClick={() => {
                                    if (color === player.color) {
                                      setPickerOpen(false);
                                      return;
                                    }
                                    onChangeColor?.(color);
                                    setPickerOpen(false);
                                  }}
                                />
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <span
                        className={styles.colorDot}
                        style={{ backgroundColor: player.color }}
                        title={`Cor de ${player.nickname}`}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                )}
              </div>
              <div className={styles.tags}>
                {player.isRoomOwner && (
                  <StatusBadge label="Dono da sala" tone="info" />
                )}
                {player.isBot && <StatusBadge label="Bot" tone="neutral" />}
                <StatusBadge
                  label={player.isReady ? 'Pronto' : 'Aguardando'}
                  tone={player.isReady ? 'success' : 'neutral'}
                  withDot={Boolean(player.isReady)}
                />
              </div>
            </div>

            {canManage && (
              <div className={styles.actions}>
                {!player.isBot && onReplaceWithBot && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => onReplaceWithBot(player.id)}
                    aria-label={`Substituir ${player.nickname} por bot`}
                    title="Substituir por bot"
                  >
                    <Bot size={14} aria-hidden="true" />
                    Substituir
                  </Button>
                )}
                {onKick && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => onKick(player.id)}
                    aria-label={`Expulsar ${player.nickname}`}
                    title="Expulsar"
                  >
                    <UserX size={14} aria-hidden="true" />
                    Expulsar
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
