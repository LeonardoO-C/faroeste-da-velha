// Partida online com o servidor como juiz.
// O estado é JSON puro, para ser guardado numa linha do banco. Toda função recebe `now` (ms)
// em vez de ler o relógio, então o servidor decide o tempo e os testes controlam o relógio.
import { type Player, type Outcome, other } from './types.ts';
import { MODES, type LineState, newLineGame, playLine } from './line.ts';
import { type UltimateState, type UltimateMove, newUltimateGame, playUltimate } from './ultimate.ts';
import { type Hand, type RpsState, HANDS, newRps, playRpsRound, randomHand } from './rps.ts';

export type ModeKey = 'classico' | 'estendido' | 'ultimate' | 'gomoku';

/** Tempo de cada jogador por modo, em segundos. */
export const MODE_SECONDS: Record<ModeKey, number> = { classico: 60, estendido: 120, ultimate: 180, gomoku: 300 };
export const RPS_PICK_MS = 5000;

export type EndReason = 'linha' | 'empate' | 'tempo' | 'desistencia';
export type Phase = 'aguardando' | 'duelo' | 'jogando' | 'fim';
export type MatchMove = number | UltimateMove;

export interface MatchState {
  mode: ModeKey;
  players: { X: string; O: string | null };
  phase: Phase;
  rps: RpsState;
  /** Escolhas da rodada atual do duelo. Segredo do servidor até as duas chegarem. */
  hands: { X: Hand | null; O: Hand | null };
  rpsDeadline: number | null;
  game: LineState | UltimateState | null;
  clock: { X: number; O: number };
  turnStartedAt: number | null;
  result: { winner: Outcome; reason: EndReason } | null;
  version: number;
}

export class MatchError extends Error {}

const fail = (msg: string): never => { throw new MatchError(msg); };

function seatOf(s: MatchState, userId: string): Player {
  if (s.players.X === userId) return 'X';
  if (s.players.O === userId) return 'O';
  return fail('Você não está nesta partida');
}

const bump = (s: MatchState, patch: Partial<MatchState>): MatchState => ({ ...s, ...patch, version: s.version + 1 });

export function createMatch(mode: ModeKey, hostId: string): MatchState {
  if (!(mode in MODE_SECONDS)) fail('Modo inválido');
  const ms = MODE_SECONDS[mode] * 1000;
  return {
    mode, players: { X: hostId, O: null }, phase: 'aguardando',
    rps: newRps(), hands: { X: null, O: null }, rpsDeadline: null,
    game: null, clock: { X: ms, O: ms }, turnStartedAt: null, result: null, version: 0,
  };
}

/** O convidado entra pelo link; o duelo começa na hora. */
export function joinMatch(s: MatchState, userId: string, now: number): MatchState {
  if (s.phase !== 'aguardando') fail('A partida já começou');
  if (s.players.X === userId) fail('Você já é o anfitrião desta partida');
  return bump(s, { players: { X: s.players.X, O: userId }, phase: 'duelo', rpsDeadline: now + RPS_PICK_MS });
}

function startGame(s: MatchState, starter: Player, now: number): MatchState {
  const game = s.mode === 'ultimate' ? newUltimateGame(starter) : newLineGame(MODES[s.mode as Exclude<ModeKey, 'ultimate'>], starter);
  return { ...s, phase: 'jogando', game, rpsDeadline: null, turnStartedAt: now };
}

function resolveRound(s: MatchState, now: number, rng: () => number): MatchState {
  const { X, O } = s.hands;
  if (!X || !O) return s;
  const rps = playRpsRound(s.rps, X, O, rng);
  const next: MatchState = { ...s, rps, hands: { X: null, O: null } };
  if (rps.starter) return startGame(next, rps.starter, now);
  return { ...next, rpsDeadline: now + RPS_PICK_MS };
}

export function pickHand(s: MatchState, userId: string, hand: Hand, now: number, rng: () => number = Math.random): MatchState {
  if (s.phase !== 'duelo') fail('Não é hora do duelo');
  if (!HANDS.includes(hand)) fail('Mão inválida');
  const seat = seatOf(s, userId);
  if (s.hands[seat]) fail('Você já escolheu');
  const withHand = { ...s, hands: { ...s.hands, [seat]: hand } };
  return bump(s, resolveRound(withHand, now, rng));
}

function finish(s: MatchState, winner: Outcome, reason: EndReason, now: number): MatchState {
  return { ...s, phase: 'fim', result: { winner, reason }, turnStartedAt: s.turnStartedAt === null ? null : now };
}

/** Desconta o tempo de quem está jogando. Devolve o estado finalizado se o pavio acabou. */
function settleClock(s: MatchState, now: number): MatchState {
  if (s.phase !== 'jogando' || !s.game || s.turnStartedAt === null) return s;
  const p = s.game.turn;
  const left = s.clock[p] - Math.max(0, now - s.turnStartedAt);
  const clock = { ...s.clock, [p]: Math.max(0, left) };
  const settled = { ...s, clock, turnStartedAt: now };
  return left <= 0 ? finish(settled, other(p), 'tempo', now) : settled;
}

export function playMove(s: MatchState, userId: string, move: MatchMove, now: number): MatchState {
  if (s.phase !== 'jogando' || !s.game) fail('A partida não está em andamento');
  const seat = seatOf(s, userId);
  if (s.game!.turn !== seat) fail('Não é a sua vez');
  const settled = settleClock(s, now);
  if (settled.phase === 'fim') return bump(s, settled);
  let game: LineState | UltimateState;
  try {
    game = s.mode === 'ultimate'
      ? playUltimate(settled.game as UltimateState, move as UltimateMove)
      : playLine(settled.game as LineState, move as number);
  } catch (e) {
    return fail((e as Error).message);
  }
  const next = { ...settled, game };
  if (game.winner) return bump(s, finish(next, game.winner, game.winner === 'draw' ? 'empate' : 'linha', now));
  return bump(s, next);
}

export function resign(s: MatchState, userId: string, now: number): MatchState {
  if (s.phase === 'fim') fail('A partida já terminou');
  const seat = seatOf(s, userId);
  if (s.phase === 'aguardando') return bump(s, finish(s, null, 'desistencia', now));
  return bump(s, finish(settleClock(s, now), other(seat), 'desistencia', now));
}

/**
 * Chamado pelo servidor periodicamente ou quando um cliente avisa que o tempo acabou.
 * Duelo vencido pelo tempo: mão aleatória para quem não escolheu. Pavio no fim: derrota.
 */
export function tick(s: MatchState, now: number, rng: () => number = Math.random): MatchState {
  if (s.phase === 'duelo' && s.rpsDeadline !== null && now >= s.rpsDeadline) {
    const hands = { X: s.hands.X ?? randomHand(rng), O: s.hands.O ?? randomHand(rng) };
    return bump(s, resolveRound({ ...s, hands }, now, rng));
  }
  if (s.phase === 'jogando') {
    const settled = settleClock(s, now);
    if (settled.phase === 'fim') return bump(s, settled);
  }
  return s;
}

/** O que cada jogador pode ver: a mão do adversário só aparece quando a rodada é resolvida. */
export function viewFor(s: MatchState, userId: string | null) {
  const seat = userId === s.players.X ? 'X' : userId === s.players.O ? 'O' : null;
  return {
    ...s,
    you: seat,
    hands: {
      X: seat === 'X' ? s.hands.X : s.hands.X ? 'escolheu' : null,
      O: seat === 'O' ? s.hands.O : s.hands.O ? 'escolheu' : null,
    },
  };
}
