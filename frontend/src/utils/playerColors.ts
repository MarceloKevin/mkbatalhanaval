/** Darken a hex color for destroyed ship cells. */
export function darkenHex(hex: string, amount = 0.35): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;

  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(raw.slice(offset, offset + 2), 16);
    return Math.max(0, Math.round(value * (1 - amount)));
  });

  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function resolvePlayerColor(
  players: Array<{ id: string; color?: string }>,
  ownerId?: string,
): string | undefined {
  if (!ownerId) return undefined;
  return players.find((player) => player.id === ownerId)?.color;
}
