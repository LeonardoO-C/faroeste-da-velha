// Pedra, Papel e Tesoura para decidir quem começa. Após 3 empates seguidos, sorteio.
import type { Player } from './types.ts';

export type Hand = 'pedra' | 'papel' | 'tesoura';
export const HANDS: readonly Hand[] = ['pedra', 'papel', 'tesoura'];

const BEATS: Record<Hand, Hand> = { pedra: 'tesoura', papel: 'pedra', tesoura: 'papel' };

export function resolveHands(x: Hand, o: Hand): Player | 'tie' {
  if (x === o) return 'tie';
  return BEATS[x] === o ? 'X' : 'O';
}

export interface RpsState {
  rounds: { x: Hand; o: Hand; result: Player | 'tie' }[];
  /** Quem começa a partida, quando decidido. */
  starter: Player | null;
  bySortition: boolean;
}

export const MAX_TIES = 3;

export function newRps(): RpsState {
  return { rounds: [], starter: null, bySortition: false };
}

/** Escolha que não chegou a tempo vira uma mão aleatória. */
export function randomHand(rng: () => number = Math.random): Hand {
  return HANDS[Math.floor(rng() * 3)];
}

export function playRpsRound(s: RpsState, x: Hand, o: Hand, rng: () => number = Math.random): RpsState {
  if (s.starter) throw new Error('Quem começa já foi decidido');
  const result = resolveHands(x, o);
  const rounds = [...s.rounds, { x, o, result }];
  if (result !== 'tie') return { rounds, starter: result, bySortition: false };
  if (rounds.length >= MAX_TIES) {
    return { rounds, starter: rng() < 0.5 ? 'X' : 'O', bySortition: true };
  }
  return { rounds, starter: null, bySortition: false };
}
