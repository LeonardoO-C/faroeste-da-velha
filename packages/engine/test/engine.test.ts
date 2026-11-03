import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES, newLineGame, playLine, legalLineMoves,
  newUltimateGame, playUltimate, legalUltimateMoves,
  newRps, playRpsRound, resolveHands, type LineMode,
} from '../src/index.ts';

const playAll = (moves: number[], mode: LineMode = MODES.classico) => moves.reduce(playLine, newLineGame(mode));

test('clássico: vitória em linha, coluna e diagonais', () => {
  assert.equal(playAll([0, 3, 1, 4, 2]).winner, 'X');
  assert.deepEqual(playAll([0, 3, 1, 4, 2]).winLine, [0, 1, 2]);
  assert.equal(playAll([0, 1, 3, 2, 6]).winner, 'X');
  assert.equal(playAll([1, 0, 2, 4, 3, 8]).winner, 'O');
  assert.equal(playAll([2, 0, 4, 1, 6]).winner, 'X');
});

test('clássico: empate e bloqueio de jogadas', () => {
  const s = playAll([0, 1, 2, 4, 3, 5, 7, 6, 8]);
  assert.equal(s.winner, 'draw');
  assert.deepEqual(legalLineMoves(s), []);
  assert.throws(() => playLine(s, 0));
  assert.throws(() => playLine(playAll([0]), 0), /ocupada/);
  assert.throws(() => playLine(newLineGame(MODES.classico), 9), /inválida/);
});

test('quem começa pode ser O', () => {
  const s = playLine(newLineGame(MODES.classico, 'O'), 4);
  assert.equal(s.cells[4], 'O');
  assert.equal(s.turn, 'X');
});

test('estendido: 4 em linha no 5x5, 3 não basta', () => {
  // X: 0,1,2 ; O: 20,21,22 -> ninguém venceu ainda
  let s = playAll([0, 20, 1, 21, 2, 22], MODES.estendido);
  assert.equal(s.winner, null);
  s = playLine(s, 3);
  assert.equal(s.winner, 'X');
  assert.deepEqual(s.winLine, [0, 1, 2, 3]);
});

test('gomoku: 5 em linha na diagonal, jogada no meio fecha a linha', () => {
  const n = 15, d = (k: number) => (k + 3) * n + (k + 3);
  let s = playAll([d(0), 0, d(1), 1, d(3), 2, d(4), 3], MODES.gomoku);
  assert.equal(s.winner, null);
  s = playLine(s, d(2));
  assert.equal(s.winner, 'X');
  assert.equal(s.winLine?.length, 5);
});

test('ultimate: casa jogada manda o adversário para o tabuleiro correspondente', () => {
  let s = newUltimateGame();
  assert.equal(legalUltimateMoves(s).length, 81);
  s = playUltimate(s, { board: 4, cell: 2 });
  assert.equal(s.next, 2);
  assert.ok(legalUltimateMoves(s).every((m) => m.board === 2));
  assert.throws(() => playUltimate(s, { board: 0, cell: 0 }), /indicado/);
});

test('ultimate: tabuleiro decidido libera jogada em qualquer tabuleiro', () => {
  // X vence o tabuleiro 0 (casas 0,1,2); O joga de volta no 0 até ele fechar.
  const seq = [
    { board: 0, cell: 3 }, { board: 3, cell: 0 },
    { board: 0, cell: 4 }, { board: 4, cell: 0 },
    { board: 0, cell: 5 }, // X fecha a linha 3-4-5 do tabuleiro 0
  ];
  let s = seq.reduce(playUltimate, newUltimateGame());
  assert.equal(s.macro[0], 'X');
  assert.equal(s.next, 5);
  s = playUltimate(s, { board: 5, cell: 0 }); // manda X para o tabuleiro 0, já decidido
  assert.equal(s.next, null);
  assert.throws(() => playUltimate(s, { board: 0, cell: 0 }), /decidido/);
  assert.ok(legalUltimateMoves(s).every((m) => m.board !== 0));
});

test('ultimate: vencer 3 tabuleiros em linha vence a partida', () => {
  let s = newUltimateGame();
  // Monta direto um estado com X vencendo os tabuleiros 0 e 1 e quase o 2.
  s = { ...s, macro: ['X', 'X', null, null, null, null, null, null, null],
        boards: s.boards.map((b, i) => (i === 2 ? ['X', 'X', null, null, null, null, null, null, null] : b)) };
  s = playUltimate(s, { board: 2, cell: 2 });
  assert.equal(s.winner, 'X');
  assert.deepEqual(s.winLine, [0, 1, 2]);
});

test('pedra, papel e tesoura', () => {
  assert.equal(resolveHands('pedra', 'tesoura'), 'X');
  assert.equal(resolveHands('pedra', 'papel'), 'O');
  assert.equal(resolveHands('tesoura', 'tesoura'), 'tie');
  let s = playRpsRound(newRps(), 'papel', 'pedra');
  assert.equal(s.starter, 'X');
  assert.throws(() => playRpsRound(s, 'papel', 'pedra'));
});

test('pedra, papel e tesoura: 3 empates seguidos vão para o sorteio', () => {
  let s = newRps();
  s = playRpsRound(s, 'pedra', 'pedra');
  s = playRpsRound(s, 'papel', 'papel');
  assert.equal(s.starter, null);
  s = playRpsRound(s, 'tesoura', 'tesoura', () => 0.9);
  assert.equal(s.starter, 'O');
  assert.equal(s.bySortition, true);
});
