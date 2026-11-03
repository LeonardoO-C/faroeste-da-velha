import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES, newLineGame, playLine, lineBotMove, newUltimateGame, playUltimate, ultimateBotMove,
  type Level, type LineMode, type Player,
} from '../src/index.ts';

function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function lineMatch(mode: LineMode, x: Level, o: Level, seed: number) {
  const rng = seeded(seed);
  let s = newLineGame(mode);
  while (!s.winner) s = playLine(s, lineBotMove(s, s.turn === 'X' ? x : o, rng));
  return s.winner;
}

test('difícil nunca perde no 3x3', () => {
  for (let i = 0; i < 40; i++) {
    assert.notEqual(lineMatch(MODES.classico, 'dificil', 'facil', i), 'O');
    assert.notEqual(lineMatch(MODES.classico, 'facil', 'dificil', i), 'X');
  }
});

test('difícil contra difícil no 3x3 empata', () => {
  assert.equal(lineMatch(MODES.classico, 'dificil', 'dificil', 1), 'draw');
});

test('bot completa a linha e bloqueia', () => {
  let s = [0, 3, 1].reduce(playLine, newLineGame(MODES.classico)); // O deve bloquear em 2
  assert.equal(lineBotMove(s, 'medio'), 2);
  s = [0, 3, 1, 4].reduce(playLine, newLineGame(MODES.classico)); // X vence em 2
  assert.equal(lineBotMove(s, 'medio'), 2);
});

test('níveis maiores vencem os menores na maioria das partidas', () => {
  const tally = (mode: LineMode, strong: Level, weak: Level, n: number) => {
    let wins = 0, losses = 0;
    for (let i = 0; i < n; i++) {
      const strongIs: Player = i % 2 ? 'X' : 'O';
      const w = strongIs === 'X' ? lineMatch(mode, strong, weak, i) : lineMatch(mode, weak, strong, i);
      if (w === strongIs) wins++; else if (w !== 'draw') losses++;
    }
    return { wins, losses };
  };
  const a = tally(MODES.estendido, 'medio', 'facil', 20);
  assert.ok(a.wins > a.losses * 3, JSON.stringify(a));
  const b = tally(MODES.gomoku, 'dificil', 'facil', 6);
  assert.ok(b.wins >= 5, JSON.stringify(b));
});

test('ultimate: bot difícil vence o fácil', () => {
  let wins = 0;
  for (let i = 0; i < 10; i++) {
    const rng = seeded(i);
    const hard: Player = i % 2 ? 'X' : 'O';
    let s = newUltimateGame();
    while (!s.winner) s = playUltimate(s, ultimateBotMove(s, s.turn === hard ? 'dificil' : 'facil', rng));
    if (s.winner === hard) wins++;
  }
  assert.ok(wins >= 8, `venceu ${wins}/10`);
});
