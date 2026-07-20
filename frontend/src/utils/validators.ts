import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  ROOM_NAME_MIN_LENGTH,
} from './constants';

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

export function validateNickname(value: string): ValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, error: 'O nickname é obrigatório.' };
  }

  if (trimmed.length < NICKNAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `O nickname deve ter no mínimo ${NICKNAME_MIN_LENGTH} caracteres.`,
    };
  }

  if (trimmed.length > NICKNAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `O nickname deve ter no máximo ${NICKNAME_MAX_LENGTH} caracteres.`,
    };
  }

  return { valid: true, error: null };
}

export function validateRoomName(value: string): ValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, error: 'O nome da sala é obrigatório.' };
  }

  if (trimmed.length < ROOM_NAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `O nome deve ter no mínimo ${ROOM_NAME_MIN_LENGTH} caracteres.`,
    };
  }

  if (trimmed.length > ROOM_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `O nome deve ter no máximo ${ROOM_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  return { valid: true, error: null };
}

export function validateRoomPassword(
  isPrivate: boolean,
  password: string,
): ValidationResult {
  if (!isPrivate) {
    return { valid: true, error: null };
  }

  if (!password.trim()) {
    return { valid: false, error: 'A senha é obrigatória para salas privadas.' };
  }

  if (password.trim().length < 3) {
    return { valid: false, error: 'A senha deve ter no mínimo 3 caracteres.' };
  }

  return { valid: true, error: null };
}
