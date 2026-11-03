// Ultimate: 9 tabuleiros 3x3. A casa jogada define em qual tabuleiro o adversário joga.
import { type Player, type Outcome, other } from './types.ts';
import { findLineThrough } from './line.ts';

export interface UltimateMove { board: number; cell: number }

export interface UltimateState {
  boards: (Player | null)[][];
  macro: Outcome[];
  /** Tabuleiro obrigatório da próxima jogada; null = qualquer um aberto. */
  next: number | null;
  turn: Player;
  winner: Outcome;
  winLine: number[] | null;
  moves: UltimateMove[];
}

export function newUltimateGame(starter: Player = 'X'): UltimateState {
  return {
    boards: Array.from({ length: 9 }, () => Array(9).fill(null)),
    macro: Array(9).fill(null),
    next: null,
    turn: starter,
    winner: null,
    winLine: null,
    moves: [],
  };
}

export function legalUltimateMoves(s: UltimateState): UltimateMove[] {
  if (s.winner) return [];
  const out: UltimateMove[] = [];
  for (let b = 0; b < 9; b++) {
    if (s.macro[b] !== null) continue;
    if (s.next !== null && s.next !== b) continue;
    s.boards[b].forEach((c, cell) => c === null && out.push({ board: b, cell }));
  }
  return out;
}

export function playUltimate(s: UltimateState, m: UltimateMove): UltimateState {
  if (s.winner) throw new Error('Partida já terminou');
  const { board, cell } = m;
  if (![board, cell].every((n) => Number.isInteger(n) && n >= 0 && n < 9)) throw new Error('Jogada inválida');
  if (s.macro[board] !== null) throw new Error('Tabuleiro já decidido');
  if (s.next !== null && s.next !== board) throw new Error('Jogue no tabuleiro indicado');
  if (s.boards[board][cell] !== null) throw new Error('Casa ocupada');

  const boards = s.boards.map((b) => b.slice());
  boards[board][cell] = s.turn;
  const macro = s.macro.slice();
  if (findLineThrough(boards[board], 3, 3, cell)) macro[board] = s.turn;
  else if (boards[board].every((c) => c !== null)) macro[board] = 'draw';

  // Linha no macro: tabuleiros empatados não contam para ninguém.
  const macroCells = macro.map((o) => (o === 'X' || o === 'O' ? o : null));
  const winLine = macro[board] === s.turn ? findLineThrough(macroCells, 3, 3, board) : null;
  const allDecided = macro.every((o) => o !== null);

  let winner: Outcome = null;
  if (winLine) winner = s.turn;
  else if (allDecided) {
    // Desempate: quem venceu mais tabuleiros.
    const x = macro.filter((o) => o === 'X').length;
    const o = macro.filter((v) => v === 'O').length;
    winner = x > o ? 'X' : o > x ? 'O' : 'draw';
  }

  return {
    boards,
    macro,
    next: macro[cell] === null ? cell : null,
    turn: other(s.turn),
    winner,
    winLine,
    moves: [...s.moves, m],
  };
}
