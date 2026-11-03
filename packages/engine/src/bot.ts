// Bot com 3 níveis. Fácil: quase aleatório. Médio: vence/bloqueia e avalia linhas.
// Difícil: minimax perfeito no 3x3 e busca rasa com avaliação nos tabuleiros maiores.
import { type Player, other } from './types.ts';
import { type LineState, legalLineMoves, playLine } from './line.ts';
import { type UltimateState, type UltimateMove, legalUltimateMoves, playUltimate } from './ultimate.ts';
import { findLineThrough } from './line.ts';

export type Level = 'facil' | 'medio' | 'dificil';
type Rng = () => number;

const pick = <T>(xs: T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)];

// ---------- Jogos de N em linha ----------

function immediateWin(s: LineState, p: Player): number | null {
  for (const m of legalLineMoves(s)) {
    const cells = s.cells.slice();
    cells[m] = p;
    if (findLineThrough(cells, s.mode.size, s.mode.win, m)) return m;
  }
  return null;
}

/** Pontua as janelas de `win` casas: janelas só com peças minhas valem mais quanto mais cheias. */
function evaluate(cells: (Player | null)[], size: number, win: number, me: Player): number {
  const opp = other(me);
  let score = 0;
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) for (const [dr, dc] of dirs) {
    const er = r + dr * (win - 1), ec = c + dc * (win - 1);
    if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
    let mine = 0, theirs = 0;
    for (let k = 0; k < win; k++) {
      const v = cells[(r + dr * k) * size + (c + dc * k)];
      if (v === me) mine++; else if (v === opp) theirs++;
    }
    if (mine && !theirs) score += 4 ** mine;
    else if (theirs && !mine) score -= 4 ** theirs * 1.2;
  }
  return score;
}

/** Só casas perto de peças existentes, para o Gomoku não avaliar 225 casas. */
function candidateMoves(s: LineState): number[] {
  const legal = legalLineMoves(s);
  if (s.moves.length === 0) return [Math.floor(s.cells.length / 2)];
  const n = s.mode.size;
  const near = legal.filter((i) => {
    const r = Math.floor(i / n), c = i % n;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n && s.cells[rr * n + cc]) return true;
    }
    return false;
  });
  return near.length ? near : legal;
}

function minimax3(s: LineState, me: Player, depth: number): number {
  if (s.winner === me) return 10 - depth;
  if (s.winner === 'draw') return 0;
  if (s.winner) return depth - 10;
  const scores = legalLineMoves(s).map((m) => minimax3(playLine(s, m), me, depth + 1));
  return s.turn === me ? Math.max(...scores) : Math.min(...scores);
}

export function lineBotMove(s: LineState, level: Level, rng: Rng = Math.random): number {
  const legal = legalLineMoves(s);
  if (!legal.length) throw new Error('Sem jogadas');
  const me = s.turn;

  if (level === 'facil') {
    const win = immediateWin(s, me);
    return win !== null && rng() < 0.5 ? win : pick(legal, rng);
  }

  const win = immediateWin(s, me);
  if (win !== null) return win;
  const block = immediateWin({ ...s, turn: other(me) }, other(me));
  if (block !== null) return block;

  if (level === 'dificil' && s.mode.size === 3) {
    let best = -Infinity, bestMoves: number[] = [];
    for (const m of legal) {
      const v = minimax3(playLine(s, m), me, 1);
      if (v > best) { best = v; bestMoves = [m]; } else if (v === best) bestMoves.push(m);
    }
    return pick(bestMoves, rng);
  }

  const { size, win: w } = s.mode;
  let best = -Infinity, bestMoves: number[] = [];
  for (const m of candidateMoves(s)) {
    const after = playLine(s, m);
    let v = evaluate(after.cells, size, w, me);
    if (level === 'dificil') {
      // Considera a melhor resposta do adversário (busca de 2 meias-jogadas).
      if (immediateWin(after, other(me)) !== null) v = -1e9;
      else {
        let worst = Infinity;
        for (const r of candidateMoves(after)) worst = Math.min(worst, evaluate(playLine(after, r).cells, size, w, me));
        if (worst !== Infinity) v = worst;
      }
    } else {
      v += rng() * 8; // médio erra de vez em quando
    }
    if (v > best) { best = v; bestMoves = [m]; } else if (v === best) bestMoves.push(m);
  }
  return pick(bestMoves, rng);
}

// ---------- Ultimate ----------

function scoreUltimate(s: UltimateState, me: Player): number {
  if (s.winner === me) return 1e6;
  if (s.winner === 'draw') return 0;
  if (s.winner) return -1e6;
  const macroCells = s.macro.map((o) => (o === 'X' || o === 'O' ? o : null));
  let v = evaluate(macroCells, 3, 3, me) * 50;
  s.boards.forEach((b, i) => {
    if (s.macro[i] === null) v += evaluate(b, 3, 3, me) * (i === 4 ? 1.5 : 1);
  });
  return v;
}

export function ultimateBotMove(s: UltimateState, level: Level, rng: Rng = Math.random): UltimateMove {
  const legal = legalUltimateMoves(s);
  if (!legal.length) throw new Error('Sem jogadas');
  const me = s.turn;
  if (level === 'facil') return pick(legal, rng);

  let best = -Infinity, bestMoves: UltimateMove[] = [];
  for (const m of legal) {
    const after = playUltimate(s, m);
    let v = scoreUltimate(after, me);
    if (level === 'dificil' && !after.winner) {
      let worst = Infinity;
      for (const r of legalUltimateMoves(after)) worst = Math.min(worst, scoreUltimate(playUltimate(after, r), me));
      v = worst;
    } else if (level === 'medio') {
      v += rng() * 20;
    }
    if (v > best) { best = v; bestMoves = [m]; } else if (v === best) bestMoves.push(m);
  }
  return pick(bestMoves, rng);
}
