// Arquivo gerado por scripts/engine-servidor.mjs a partir de packages/engine. Não edite.

// packages/engine/src/types.ts
function other(p) {
  return p === "X" ? "O" : "X";
}

// packages/engine/src/line.ts
var MODES = {
  classico: { id: "classico", size: 3, win: 3 },
  estendido: { id: "estendido", size: 5, win: 4 },
  gomoku: { id: "gomoku", size: 15, win: 5 }
};
function newLineGame(mode, starter = "X") {
  return {
    mode,
    cells: Array(mode.size * mode.size).fill(null),
    turn: starter,
    winner: null,
    winLine: null,
    moves: []
  };
}
function legalLineMoves(s) {
  if (s.winner) return [];
  const out = [];
  s.cells.forEach((c, i) => c === null && out.push(i));
  return out;
}
var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
function findLineThrough(cells, size, win, idx) {
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
        if (sign === 1) line.push(r * size + c);
        else line.unshift(r * size + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= win) return line;
  }
  return null;
}
function playLine(s, idx) {
  if (s.winner) throw new Error("Partida j\xE1 terminou");
  if (!Number.isInteger(idx) || idx < 0 || idx >= s.cells.length) throw new Error("Casa inv\xE1lida");
  if (s.cells[idx] !== null) throw new Error("Casa ocupada");
  const cells = s.cells.slice();
  cells[idx] = s.turn;
  const winLine = findLineThrough(cells, s.mode.size, s.mode.win, idx);
  const full = cells.every((c) => c !== null);
  return {
    mode: s.mode,
    cells,
    turn: other(s.turn),
    winner: winLine ? s.turn : full ? "draw" : null,
    winLine,
    moves: [...s.moves, idx]
  };
}

// packages/engine/src/ultimate.ts
function newUltimateGame(starter = "X") {
  return {
    boards: Array.from({ length: 9 }, () => Array(9).fill(null)),
    macro: Array(9).fill(null),
    next: null,
    turn: starter,
    winner: null,
    winLine: null,
    moves: []
  };
}
function legalUltimateMoves(s) {
  if (s.winner) return [];
  const out = [];
  for (let b = 0; b < 9; b++) {
    if (s.macro[b] !== null) continue;
    if (s.next !== null && s.next !== b) continue;
    s.boards[b].forEach((c, cell) => c === null && out.push({ board: b, cell }));
  }
  return out;
}
function playUltimate(s, m) {
  if (s.winner) throw new Error("Partida j\xE1 terminou");
  const { board, cell } = m;
  if (![board, cell].every((n) => Number.isInteger(n) && n >= 0 && n < 9)) throw new Error("Jogada inv\xE1lida");
  if (s.macro[board] !== null) throw new Error("Tabuleiro j\xE1 decidido");
  if (s.next !== null && s.next !== board) throw new Error("Jogue no tabuleiro indicado");
  if (s.boards[board][cell] !== null) throw new Error("Casa ocupada");
  const boards = s.boards.map((b) => b.slice());
  boards[board][cell] = s.turn;
  const macro = s.macro.slice();
  if (findLineThrough(boards[board], 3, 3, cell)) macro[board] = s.turn;
  else if (boards[board].every((c) => c !== null)) macro[board] = "draw";
  const macroCells = macro.map((o) => o === "X" || o === "O" ? o : null);
  const winLine = macro[board] === s.turn ? findLineThrough(macroCells, 3, 3, board) : null;
  const allDecided = macro.every((o) => o !== null);
  let winner = null;
  if (winLine) winner = s.turn;
  else if (allDecided) {
    const x = macro.filter((o2) => o2 === "X").length;
    const o = macro.filter((v) => v === "O").length;
    winner = x > o ? "X" : o > x ? "O" : "draw";
  }
  return {
    boards,
    macro,
    next: macro[cell] === null ? cell : null,
    turn: other(s.turn),
    winner,
    winLine,
    moves: [...s.moves, m]
  };
}

// packages/engine/src/rps.ts
var HANDS = ["pedra", "papel", "tesoura"];
var BEATS = { pedra: "tesoura", papel: "pedra", tesoura: "papel" };
function resolveHands(x, o) {
  if (x === o) return "tie";
  return BEATS[x] === o ? "X" : "O";
}
var MAX_TIES = 3;
function newRps() {
  return { rounds: [], starter: null, bySortition: false };
}
function randomHand(rng = Math.random) {
  return HANDS[Math.floor(rng() * 3)];
}
function playRpsRound(s, x, o, rng = Math.random) {
  if (s.starter) throw new Error("Quem come\xE7a j\xE1 foi decidido");
  const result = resolveHands(x, o);
  const rounds = [...s.rounds, { x, o, result }];
  if (result !== "tie") return { rounds, starter: result, bySortition: false };
  if (rounds.length >= MAX_TIES) {
    return { rounds, starter: rng() < 0.5 ? "X" : "O", bySortition: true };
  }
  return { rounds, starter: null, bySortition: false };
}

// packages/engine/src/bot.ts
var pick = (xs, rng) => xs[Math.floor(rng() * xs.length)];
function immediateWin(s, p) {
  for (const m of legalLineMoves(s)) {
    const cells = s.cells.slice();
    cells[m] = p;
    if (findLineThrough(cells, s.mode.size, s.mode.win, m)) return m;
  }
  return null;
}
function evaluate(cells, size, win, me) {
  const opp = other(me);
  let score = 0;
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) for (const [dr, dc] of dirs) {
    const er = r + dr * (win - 1), ec = c + dc * (win - 1);
    if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
    let mine = 0, theirs = 0;
    for (let k = 0; k < win; k++) {
      const v = cells[(r + dr * k) * size + (c + dc * k)];
      if (v === me) mine++;
      else if (v === opp) theirs++;
    }
    if (mine && !theirs) score += 4 ** mine;
    else if (theirs && !mine) score -= 4 ** theirs * 1.2;
  }
  return score;
}
function candidateMoves(s) {
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
function minimax3(s, me, depth) {
  if (s.winner === me) return 10 - depth;
  if (s.winner === "draw") return 0;
  if (s.winner) return depth - 10;
  const scores = legalLineMoves(s).map((m) => minimax3(playLine(s, m), me, depth + 1));
  return s.turn === me ? Math.max(...scores) : Math.min(...scores);
}
function lineBotMove(s, level, rng = Math.random) {
  const legal = legalLineMoves(s);
  if (!legal.length) throw new Error("Sem jogadas");
  const me = s.turn;
  if (level === "facil") {
    const win2 = immediateWin(s, me);
    return win2 !== null && rng() < 0.5 ? win2 : pick(legal, rng);
  }
  const win = immediateWin(s, me);
  if (win !== null) return win;
  const block = immediateWin({ ...s, turn: other(me) }, other(me));
  if (block !== null) return block;
  if (level === "dificil" && s.mode.size === 3) {
    let best2 = -Infinity, bestMoves2 = [];
    for (const m of legal) {
      const v = minimax3(playLine(s, m), me, 1);
      if (v > best2) {
        best2 = v;
        bestMoves2 = [m];
      } else if (v === best2) bestMoves2.push(m);
    }
    return pick(bestMoves2, rng);
  }
  const { size, win: w } = s.mode;
  let best = -Infinity, bestMoves = [];
  for (const m of candidateMoves(s)) {
    const after = playLine(s, m);
    let v = evaluate(after.cells, size, w, me);
    if (level === "dificil") {
      if (immediateWin(after, other(me)) !== null) v = -1e9;
      else {
        let worst = Infinity;
        for (const r of candidateMoves(after)) worst = Math.min(worst, evaluate(playLine(after, r).cells, size, w, me));
        if (worst !== Infinity) v = worst;
      }
    } else {
      v += rng() * 8;
    }
    if (v > best) {
      best = v;
      bestMoves = [m];
    } else if (v === best) bestMoves.push(m);
  }
  return pick(bestMoves, rng);
}
function scoreUltimate(s, me) {
  if (s.winner === me) return 1e6;
  if (s.winner === "draw") return 0;
  if (s.winner) return -1e6;
  const macroCells = s.macro.map((o) => o === "X" || o === "O" ? o : null);
  let v = evaluate(macroCells, 3, 3, me) * 50;
  s.boards.forEach((b, i) => {
    if (s.macro[i] === null) v += evaluate(b, 3, 3, me) * (i === 4 ? 1.5 : 1);
  });
  return v;
}
function ultimateBotMove(s, level, rng = Math.random) {
  const legal = legalUltimateMoves(s);
  if (!legal.length) throw new Error("Sem jogadas");
  const me = s.turn;
  if (level === "facil") return pick(legal, rng);
  let best = -Infinity, bestMoves = [];
  for (const m of legal) {
    const after = playUltimate(s, m);
    let v = scoreUltimate(after, me);
    if (level === "dificil" && !after.winner) {
      let worst = Infinity;
      for (const r of legalUltimateMoves(after)) worst = Math.min(worst, scoreUltimate(playUltimate(after, r), me));
      v = worst;
    } else if (level === "medio") {
      v += rng() * 20;
    }
    if (v > best) {
      best = v;
      bestMoves = [m];
    } else if (v === best) bestMoves.push(m);
  }
  return pick(bestMoves, rng);
}

// packages/engine/src/match.ts
var MODE_SECONDS = { classico: 60, estendido: 120, ultimate: 180, gomoku: 300 };
var RPS_PICK_MS = 5e3;
var MatchError = class extends Error {
};
var fail = (msg) => {
  throw new MatchError(msg);
};
function seatOf(s, userId) {
  if (s.players.X === userId) return "X";
  if (s.players.O === userId) return "O";
  return fail("Voc\xEA n\xE3o est\xE1 nesta partida");
}
var bump = (s, patch) => ({ ...s, ...patch, version: s.version + 1 });
function createMatch(mode, hostId) {
  if (!(mode in MODE_SECONDS)) fail("Modo inv\xE1lido");
  const ms = MODE_SECONDS[mode] * 1e3;
  return {
    mode,
    players: { X: hostId, O: null },
    phase: "aguardando",
    rps: newRps(),
    hands: { X: null, O: null },
    rpsDeadline: null,
    game: null,
    clock: { X: ms, O: ms },
    turnStartedAt: null,
    result: null,
    version: 0
  };
}
function joinMatch(s, userId, now) {
  if (s.phase !== "aguardando") fail("A partida j\xE1 come\xE7ou");
  if (s.players.X === userId) fail("Voc\xEA j\xE1 \xE9 o anfitri\xE3o desta partida");
  return bump(s, { players: { X: s.players.X, O: userId }, phase: "duelo", rpsDeadline: now + RPS_PICK_MS });
}
function startGame(s, starter, now) {
  const game = s.mode === "ultimate" ? newUltimateGame(starter) : newLineGame(MODES[s.mode], starter);
  return { ...s, phase: "jogando", game, rpsDeadline: null, turnStartedAt: now };
}
function resolveRound(s, now, rng) {
  const { X, O } = s.hands;
  if (!X || !O) return s;
  const rps = playRpsRound(s.rps, X, O, rng);
  const next = { ...s, rps, hands: { X: null, O: null } };
  if (rps.starter) return startGame(next, rps.starter, now);
  return { ...next, rpsDeadline: now + RPS_PICK_MS };
}
function pickHand(s, userId, hand, now, rng = Math.random) {
  if (s.phase !== "duelo") fail("N\xE3o \xE9 hora do duelo");
  if (!HANDS.includes(hand)) fail("M\xE3o inv\xE1lida");
  const seat = seatOf(s, userId);
  if (s.hands[seat]) fail("Voc\xEA j\xE1 escolheu");
  const withHand = { ...s, hands: { ...s.hands, [seat]: hand } };
  return bump(s, resolveRound(withHand, now, rng));
}
function finish(s, winner, reason, now) {
  return { ...s, phase: "fim", result: { winner, reason }, turnStartedAt: s.turnStartedAt === null ? null : now };
}
function settleClock(s, now) {
  if (s.phase !== "jogando" || !s.game || s.turnStartedAt === null) return s;
  const p = s.game.turn;
  const left = s.clock[p] - Math.max(0, now - s.turnStartedAt);
  const clock = { ...s.clock, [p]: Math.max(0, left) };
  const settled = { ...s, clock, turnStartedAt: now };
  return left <= 0 ? finish(settled, other(p), "tempo", now) : settled;
}
function playMove(s, userId, move, now) {
  if (s.phase !== "jogando" || !s.game) fail("A partida n\xE3o est\xE1 em andamento");
  const seat = seatOf(s, userId);
  if (s.game.turn !== seat) fail("N\xE3o \xE9 a sua vez");
  const settled = settleClock(s, now);
  if (settled.phase === "fim") return bump(s, settled);
  let game;
  try {
    game = s.mode === "ultimate" ? playUltimate(settled.game, move) : playLine(settled.game, move);
  } catch (e) {
    return fail(e.message);
  }
  const next = { ...settled, game };
  if (game.winner) return bump(s, finish(next, game.winner, game.winner === "draw" ? "empate" : "linha", now));
  return bump(s, next);
}
function resign(s, userId, now) {
  if (s.phase === "fim") fail("A partida j\xE1 terminou");
  const seat = seatOf(s, userId);
  if (s.phase === "aguardando") return bump(s, finish(s, null, "desistencia", now));
  return bump(s, finish(settleClock(s, now), other(seat), "desistencia", now));
}
function tick(s, now, rng = Math.random) {
  if (s.phase === "duelo" && s.rpsDeadline !== null && now >= s.rpsDeadline) {
    const hands = { X: s.hands.X ?? randomHand(rng), O: s.hands.O ?? randomHand(rng) };
    return bump(s, resolveRound({ ...s, hands }, now, rng));
  }
  if (s.phase === "jogando") {
    const settled = settleClock(s, now);
    if (settled.phase === "fim") return bump(s, settled);
  }
  return s;
}
function viewFor(s, userId) {
  const seat = userId === s.players.X ? "X" : userId === s.players.O ? "O" : null;
  return {
    ...s,
    you: seat,
    hands: {
      X: seat === "X" ? s.hands.X : s.hands.X ? "escolheu" : null,
      O: seat === "O" ? s.hands.O : s.hands.O ? "escolheu" : null
    }
  };
}
export {
  HANDS,
  MAX_TIES,
  MODES,
  MODE_SECONDS,
  MatchError,
  RPS_PICK_MS,
  createMatch,
  findLineThrough,
  joinMatch,
  legalLineMoves,
  legalUltimateMoves,
  lineBotMove,
  newLineGame,
  newRps,
  newUltimateGame,
  other,
  pickHand,
  playLine,
  playMove,
  playRpsRound,
  playUltimate,
  randomHand,
  resign,
  resolveHands,
  tick,
  ultimateBotMove,
  viewFor
};
