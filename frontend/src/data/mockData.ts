import type { GameAction } from '../types/game';
import type { Player } from '../types/player';
import type { Room } from '../types/room';

export const MOCK_ONLINE_PLAYERS: Player[] = [
  {
    id: 'player-capitao-kevin',
    nickname: 'CapitãoKevin',
    status: 'available',
  },
  {
    id: 'player-sea-hunter',
    nickname: 'SeaHunter',
    status: 'in-room',
  },
  {
    id: 'player-ocean-master',
    nickname: 'OceanMaster',
    status: 'playing',
  },
  {
    id: 'player-blue-shark',
    nickname: 'BlueShark',
    status: 'in-room',
  },
  {
    id: 'player-kraken-br',
    nickname: 'KrakenBR',
    status: 'available',
  },
  {
    id: 'player-admiral-wave',
    nickname: 'AdmiralWave',
    status: 'playing',
  },
  {
    id: 'player-deep-hunter',
    nickname: 'DeepHunter',
    status: 'available',
  },
  {
    id: 'player-naval-storm',
    nickname: 'NavalStorm',
    status: 'in-room',
  },
  {
    id: 'player-tide-rider',
    nickname: 'TideRider',
    status: 'available',
  },
  {
    id: 'player-coral-ghost',
    nickname: 'CoralGhost',
    status: 'playing',
  },
];

export const MOCK_ROOMS: Room[] = [
  {
    id: 'room-atlantico',
    name: 'Batalha no Atlântico',
    ownerId: 'player-sea-hunter',
    ownerNickname: 'SeaHunter',
    maxPlayers: 8,
    status: 'waiting',
    isPrivate: false,
    players: [
      {
        id: 'player-sea-hunter',
        nickname: 'SeaHunter',
        status: 'ready',
        isRoomOwner: true,
        isReady: true,
      },
      {
        id: 'player-blue-shark',
        nickname: 'BlueShark',
        status: 'ready',
        isReady: true,
      },
      {
        id: 'player-naval-storm',
        nickname: 'NavalStorm',
        status: 'waiting',
        isReady: false,
      },
    ],
  },
  {
    id: 'room-sete-mares',
    name: 'Domínio dos Sete Mares',
    ownerId: 'player-kraken-br',
    ownerNickname: 'KrakenBR',
    maxPlayers: 4,
    status: 'almost-full',
    isPrivate: false,
    players: [
      {
        id: 'player-kraken-br',
        nickname: 'KrakenBR',
        status: 'ready',
        isRoomOwner: true,
        isReady: true,
      },
      {
        id: 'player-tide-rider',
        nickname: 'TideRider',
        status: 'ready',
        isReady: true,
      },
      {
        id: 'player-deep-hunter',
        nickname: 'DeepHunter',
        status: 'waiting',
        isReady: false,
      },
    ],
  },
  {
    id: 'room-cacadores',
    name: 'Caçadores do Oceano',
    ownerId: 'player-ocean-master',
    ownerNickname: 'OceanMaster',
    maxPlayers: 6,
    status: 'playing',
    isPrivate: false,
    players: [
      {
        id: 'player-ocean-master',
        nickname: 'OceanMaster',
        status: 'playing',
        isRoomOwner: true,
        isReady: true,
      },
      {
        id: 'player-admiral-wave',
        nickname: 'AdmiralWave',
        status: 'playing',
        isReady: true,
      },
      {
        id: 'player-coral-ghost',
        nickname: 'CoralGhost',
        status: 'playing',
        isReady: true,
      },
      {
        id: 'player-extra-1',
        nickname: 'WaveBreaker',
        status: 'playing',
        isReady: true,
      },
    ],
  },
  {
    id: 'room-guerra-br',
    name: 'Guerra Naval BR',
    ownerId: 'player-blue-shark-2',
    ownerNickname: 'TorpedoX',
    maxPlayers: 8,
    status: 'full',
    isPrivate: false,
    players: Array.from({ length: 8 }, (_, i) => ({
      id: `player-full-${i}`,
      nickname: ['TorpedoX', 'MarBravo', 'AncoraSul', 'FogueteAzul', 'LemeNorte', 'BussolaBR', 'GaleaoRJ', 'FragataSP'][i],
      status: 'ready' as const,
      isRoomOwner: i === 0,
      isReady: true,
    })),
  },
  {
    id: 'room-almirantes',
    name: 'Sala dos Almirantes',
    ownerId: 'player-admiral-private',
    ownerNickname: 'AdmiralWave',
    maxPlayers: 2,
    status: 'waiting',
    isPrivate: true,
    players: [
      {
        id: 'player-admiral-private',
        nickname: 'AdmiralWave',
        status: 'waiting',
        isRoomOwner: true,
        isReady: false,
      },
    ],
  },
];

export const MOCK_GAME_HISTORY: GameAction[] = [
  {
    id: 'action-1',
    playerNickname: 'CapitãoKevin',
    message: 'CapitãoKevin atacou B4 e acertou.',
    timestamp: Date.now() - 60000,
    type: 'hit',
  },
  {
    id: 'action-2',
    playerNickname: 'SeaHunter',
    message: 'SeaHunter atacou F8 e caiu na água.',
    timestamp: Date.now() - 45000,
    type: 'miss',
  },
  {
    id: 'action-3',
    playerNickname: 'OceanMaster',
    message: 'OceanMaster destruiu um submarino.',
    timestamp: Date.now() - 30000,
    type: 'destroyed',
  },
  {
    id: 'action-4',
    playerNickname: 'BlueShark',
    message: 'BlueShark atacou C2 e acertou.',
    timestamp: Date.now() - 15000,
    type: 'hit',
  },
];
