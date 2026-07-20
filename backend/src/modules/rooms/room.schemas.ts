import { z } from 'zod';
import {
  MAX_PLAYERS_OPTIONS,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  PLAYER_COLORS,
  ROOM_NAME_MAX_LENGTH,
  ROOM_NAME_MIN_LENGTH,
} from '../../shared/constants.js';

export const nicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN_LENGTH)
  .max(NICKNAME_MAX_LENGTH)
  .regex(/^[\p{L}\p{N}_ -]+$/u, 'Nickname inválido.');

export const createRoomSchema = z.object({
  name: z.string().trim().min(ROOM_NAME_MIN_LENGTH).max(ROOM_NAME_MAX_LENGTH),
  maxPlayers: z.union(
    MAX_PLAYERS_OPTIONS.map((value) => z.literal(value)) as [
      z.ZodLiteral<(typeof MAX_PLAYERS_OPTIONS)[number]>,
      ...z.ZodLiteral<(typeof MAX_PLAYERS_OPTIONS)[number]>[],
    ],
  ),
  isPrivate: z.boolean().default(false),
  password: z.string().min(3).max(40).optional(),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

const maxPlayersSchema = z.union(
  MAX_PLAYERS_OPTIONS.map((value) => z.literal(value)) as [
    z.ZodLiteral<(typeof MAX_PLAYERS_OPTIONS)[number]>,
    ...z.ZodLiteral<(typeof MAX_PLAYERS_OPTIONS)[number]>[],
  ],
);

export const updateRoomSchema = z.object({
  roomId: z.string().min(1),
  name: z.string().trim().min(ROOM_NAME_MIN_LENGTH).max(ROOM_NAME_MAX_LENGTH),
  maxPlayers: maxPlayersSchema,
  isPrivate: z.boolean(),
  /** Nova senha. Opcional se a sala já era privada e a senha permanece. */
  password: z.string().min(3).max(40).optional(),
});

export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;

export const roomIdSchema = z.object({
  roomId: z.string().min(1),
});

export const joinRoomSchema = roomIdSchema.extend({
  password: z.string().min(1).max(40).optional(),
});

export const readySchema = z.object({
  roomId: z.string().min(1),
  isReady: z.boolean(),
});

export const kickSchema = z.object({
  roomId: z.string().min(1),
  playerId: z.string().min(1),
});

export const replaceBotSchema = kickSchema;

export const setColorSchema = z.object({
  roomId: z.string().min(1),
  color: z.enum(
    PLAYER_COLORS as unknown as [
      (typeof PLAYER_COLORS)[number],
      ...(typeof PLAYER_COLORS)[number][],
    ],
  ),
});

export const attackSchema = z.object({
  matchId: z.string().min(1),
  row: z.number().int().min(0).max(20),
  column: z.number().int().min(0).max(20),
});

export const matchIdSchema = z.object({
  matchId: z.string().min(1),
});

export const renamePlayerSchema = z.object({
  nickname: nicknameSchema,
});
