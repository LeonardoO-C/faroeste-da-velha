import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatch, joinMatch, pickHand, playMove, resign, tick, viewFor, MatchError, RPS_PICK_MS,
  type MatchState,
} from '../src/index.ts';

const A = 'ana', B = 'beto';
const T0 = 1_000_000;

/** Partida do Clássico já no duelo, com Ana (X) vencendo o Pedra, Papel e Tesoura. */
function started(mode: MatchState['mode'] = 'classico'): MatchState {
  let s = joinMatch(createMatch(mode, A), B, T0);
  s = pickHand(s, A, 'pedra', T0 + 100);
  s = pickHand(s, B, 'tesoura', T0 + 200);
  return s;
}

test('convite: anfitrião não entra duas vezes e a partida começa no duelo', () => {
  const s = createMatch('classico', A);
  assert.equal(s.phase, 'aguardando');
  assert.throws(() => joinMatch(s, A, T0), MatchError);
  const j = joinMatch(s, B, T0);
  assert.equal(j.phase, 'duelo');
  assert.throws(() => joinMatch(j, 'caio', T0), /começou/);
});

test('duelo: a escolha do adversário fica escondida até os dois escolherem', () => {
  let s = joinMatch(createMatch('classico', A), B, T0);
  s = pickHand(s, A, 'papel', T0 + 10);
  assert.equal(viewFor(s, B).hands.X, 'escolheu');
  assert.equal(viewFor(s, A).hands.X, 'papel');
  assert.throws(() => pickHand(s, A, 'pedra', T0 + 20), /já escolheu/);
  assert.throws(() => pickHand(s, 'caio', 'pedra', T0 + 20), /não está/);
  s = pickHand(s, B, 'pedra', T0 + 30);
  assert.equal(s.phase, 'jogando');
  assert.equal(s.game?.turn, 'X');
});

test('duelo: empate repete, e quem não escolhe a tempo recebe mão aleatória', () => {
  let s = joinMatch(createMatch('classico', A), B, T0);
  s = pickHand(s, A, 'pedra', T0);
  s = pickHand(s, B, 'pedra', T0);
  assert.equal(s.phase, 'duelo');
  assert.equal(s.rps.rounds.length, 1);
  s = pickHand(s, A, 'papel', T0 + 1000);
  assert.equal(tick(s, T0 + RPS_PICK_MS - 1), s); // prazo conta do fim da rodada empatada
  s = tick(s, T0 + RPS_PICK_MS, () => 0); // rng 0 -> pedra para o Beto
  assert.equal(s.phase, 'jogando');
  assert.equal(s.game?.turn, 'X');
});

test('jogadas: só na sua vez, casa válida, e vitória encerra a partida', () => {
  let s = started();
  assert.throws(() => playMove(s, B, 0, T0 + 300), /sua vez/);
  s = playMove(s, A, 0, T0 + 300);
  assert.throws(() => playMove(s, B, 0, T0 + 400), /ocupada/);
  for (const [who, cell] of [[B, 3], [A, 1], [B, 4], [A, 2]] as const) s = playMove(s, who, cell, T0 + 500);
  assert.equal(s.phase, 'fim');
  assert.deepEqual(s.result, { winner: 'X', reason: 'linha' });
  assert.throws(() => playMove(s, B, 5, T0 + 600));
});

test('pavio: o tempo gasto é descontado e acabar o tempo dá derrota', () => {
  let s = started();
  s = playMove(s, A, 4, T0 + 200 + 5000);
  assert.equal(s.clock.X, 55_000);
  // Beto deixa o pavio queimar.
  assert.equal(tick(s, T0 + 200 + 5000 + 59_000).phase, 'jogando');
  const done = tick(s, T0 + 200 + 5000 + 60_000);
  assert.deepEqual(done.result, { winner: 'X', reason: 'tempo' });
  assert.equal(done.clock.O, 0);
  // Jogada que chega depois do pavio acabar também perde.
  const late = playMove(s, B, 0, T0 + 200 + 5000 + 61_000);
  assert.deepEqual(late.result, { winner: 'X', reason: 'tempo' });
});

test('desistência dá a vitória ao adversário', () => {
  const s = resign(started(), A, T0 + 1000);
  assert.deepEqual(s.result, { winner: 'O', reason: 'desistencia' });
});

test('ultimate online: jogada no tabuleiro errado é recusada', () => {
  let s = started('ultimate');
  s = playMove(s, A, { board: 4, cell: 2 }, T0 + 300);
  assert.throws(() => playMove(s, B, { board: 0, cell: 0 }, T0 + 400), /indicado/);
  s = playMove(s, B, { board: 2, cell: 0 }, T0 + 400);
  assert.equal(s.version > 0, true);
});

test('estado sobrevive a JSON, como numa linha do banco', () => {
  const s = started();
  const back = JSON.parse(JSON.stringify(s)) as MatchState;
  assert.equal(playMove(back, A, 4, T0 + 300).game?.turn, 'O');
});
