// Jogos de N em linha num tabuleiro quadrado: Clássico, Estendido e Gomoku.
import { type Player, type Outcome, other } from './types.ts';

export interface LineMode {
  id: string;
  size: number;
  win: number;
}

export const MODES = {
  classico: { id: 'classico', size: 3, win: 3 },
  estendido: { id: 'estendido', size: 5, win: 4 },
  gomoku: { id: 'gomoku', size: 15, win: 5 },
} as const satisfies Record<string, LineMode>;

export interface LineState {
  mode: LineMode;
  cells: (Player | null)[];
  turn: Player;
  winner: Outcome;
  winLine: number[] | null;
  moves: number[];
}

export function newLineGame(mode: LineMode, starter: Player = 'X'): LineState {
  return {
    mode,
    cells: Array(mode.size * mode.size).fill(null),
    turn: starter,
    winner: null,
    winLine: null,
    moves: [],
  };
}

export function legalLineMoves(s: LineState): number[] {
  if (s.winner) return [];
  const out: number[] = [];
  s.cells.forEach((c, i) => c === null && out.push(i));
  return out;
}

const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];

/** Linha vencedora que passa por `idx`, ou null. */
export function findLineThrough(cells: (Player | null)[], size: number, win: number, idx: number): number[] | null {
  const p = cells[idx];
  if (!p) return null;
  const r0 = Math.floor(idx / size);
  const c0 = idx % size;
  for (const [dr, dc] of DIRS) {
    const line = [idx];
    for (const sign of [1, -1]) {
      let r = r0 + dr * sign;
      let c = c0 + dc * sign;
      while (r >= 0 && r < size && c >= 0 && c < size && cells[r * size + c] === p) {
        if (sign === 1) line.push(r * size + c); else line.unshift(r * size + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= win) return line;
  }
  return null;
}

export function playLine(s: LineState, idx: number): LineState {
  if (s.winner) throw new Error('Partida já terminou');
  if (!Number.isInteger(idx) || idx < 0 || idx >= s.cells.length) throw new Error('Casa inválida');
  if (s.cells[idx] !== null) throw new Error('Casa ocupada');
  const cells = s.cells.slice();
  cells[idx] = s.turn;
  const winLine = findLineThrough(cells, s.mode.size, s.mode.win, idx);
  const full = cells.every((c) => c !== null);
  return {
    mode: s.mode,
    cells,
    turn: other(s.turn),
    winner: winLine ? s.turn : full ? 'draw' : null,
    winLine,
    moves: [...s.moves, idx],
  };
}
