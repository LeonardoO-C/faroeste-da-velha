// ---------- Online (Supabase) ----------
// Inserido em index.src.html pelo build, dentro do mesmo escopo do resto do jogo.
const Online = (() => {
  const URL_SUPABASE = 'https://fvgeaoyitwbbiubsnoxw.supabase.co';
  const CHAVE_PUBLICA = 'sb_publishable_6BL0AA6Z3fWL02p4qMRYRQ_SVQ5vb4m';
  let sb = null, canal = null, id = null, view = null, offset = 0, myHand = null, askedTime = 0, lastRounds = 0, shownGame = false;

  function client() {
    if (sb) return sb;
    if (!window.supabase) throw new Error('Não foi possível carregar o modo online. Confira a internet e recarregue a página.');
    sb = window.supabase.createClient(URL_SUPABASE, CHAVE_PUBLICA);
    return sb;
  }

  async function login() {
    const c = client();
    const { data } = await c.auth.getSession();
    if (data.session) return data.session;
    const { data: d, error } = await c.auth.signInAnonymously();
    if (error) throw new Error('Não foi possível entrar no modo online: ' + error.message);
    return d.session;
  }

  async function call(body) {
    await login();
    const { data, error } = await client().functions.invoke('partida', { body: { partida: id, ...body } });
    if (error) {
      let msg = 'Falha ao falar com o servidor';
      try { msg = (await error.context.json()).erro || msg; } catch {}
      throw new Error(msg);
    }
    if (data.agora) offset = data.agora - Date.now();
    return data;
  }

  const serverNow = () => Date.now() + offset;
  const link = () => location.href.split('#')[0] + '#p-' + id;

  function screen(title, body) {
    clear();
    $app.innerHTML = `
      <div class="topbar"><button class="link" id="back" type="button">Menu</button><span class="display">Online</span></div>
      <div class="duel"><h2>${title}</h2>${body}</div>`;
    document.getElementById('back').onclick = () => { leave(); location.hash = ''; menu(); };
  }

  function errorScreen(msg) {
    screen('Deu ruim na estrada', `<p>${msg}</p><button class="cta ghost" id="retry" type="button">Tentar de novo</button>`);
    document.getElementById('retry').onclick = () => location.reload();
  }

  function leave() {
    if (canal) { client().removeChannel(canal); canal = null; }
    clear(); id = null; view = null; myHand = null; lastRounds = 0; shownGame = false;
  }

  function subscribe() {
    canal = client().channel('partida-' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'partidas', filter: 'id=eq.' + id },
        (msg) => update({ ...msg.new.estado, you: view?.you ?? null }))
      .subscribe();
  }

  /** Aplica um estado vindo do servidor, ignorando versões antigas. */
  function update(v) {
    if (view && v.version < view.version) return;
    const prev = view;
    view = v;
    if (v.hands && v.you && v.hands[v.you] && v.hands[v.you] !== 'escolheu') myHand = v.hands[v.you];
    if (v.phase === 'aguardando') return waiting();
    if (v.phase === 'duelo' || (v.rps.rounds.length > lastRounds && !shownGame)) return duelView(prev);
    if (v.phase === 'jogando' || v.phase === 'fim') return gameView(prev);
  }

  function waiting() {
    screen('Esperando o adversário', `
      <p>Mande este link para quem vai duelar com você. A partida começa quando a pessoa abrir.</p>
      <input id="invite" class="invite" readonly value="${link()}" aria-label="Link do convite">
      <button class="cta" id="copy" type="button">Copiar link</button>
      <p class="note" id="copied" aria-live="polite"></p>`);
    const input = document.getElementById('invite');
    document.getElementById('copy').onclick = async () => {
      try { await navigator.clipboard.writeText(input.value); document.getElementById('copied').textContent = 'Link copiado.'; }
      catch { input.select(); document.getElementById('copied').textContent = 'Selecionei o link: copie e mande para seu amigo.'; }
    };
  }

  function duelView() {
    const v = view;
    const rounds = v.rps.rounds;
    const newRound = rounds.length > lastRounds ? rounds[rounds.length - 1] : null;
    const opp = v.you === 'X' ? 'O' : 'X';
    if (!document.getElementById('hands-online')) {
      screen('Duelo ao meio-dia', `
        <p id="dmsg"></p>
        <div class="standoff">
          <div class="gunman x"><div class="hand" id="hme">?</div><div class="who">Você</div></div>
          <div class="vs">x</div>
          <div class="gunman o"><div class="hand" id="hopp">?</div><div class="who">Adversário</div></div>
        </div>
        <div class="count" id="count"></div>
        <div class="pickbar"><i id="pbar"></i></div>
        <div class="hands" id="hands-online">${E.HANDS.map((h) => `<button type="button" id="hand-${h}" data-h="${h}"><span>${HAND_ICON[h]}</span>${HAND_LABEL[h]}</button>`).join('')}</div>`);
      document.querySelectorAll('#hands-online button').forEach((b) => b.onclick = () => pick(b.dataset.h));
    }
    const $msg = document.getElementById('dmsg'), $count = document.getElementById('count');
    const $me = document.getElementById('hme'), $opp = document.getElementById('hopp');
    const setHands = (on) => document.querySelectorAll('#hands-online button').forEach((b) => b.disabled = !on);

    if (newRound) {
      // Rodada resolvida pelo servidor: revela as duas mãos.
      lastRounds = rounds.length;
      myHand = null;
      $me.textContent = HAND_ICON[newRound[v.you.toLowerCase()]];
      $opp.textContent = HAND_ICON[newRound[opp.toLowerCase()]];
      $me.classList.add('shown'); $opp.classList.add('shown');
      bang(); setHands(false);
      if (v.rps.starter) {
        const me = v.rps.starter === v.you;
        $count.textContent = v.rps.bySortition ? 'Sorteio!' : me ? 'Você venceu' : 'O adversário venceu';
        $msg.textContent = `${me ? 'Você atira' : 'O adversário atira'} primeiro.`;
        shownGame = false;
        setTimeout(() => { shownGame = true; gameView(null); }, 1800);
        return;
      }
      $count.textContent = 'Empate!';
      $msg.textContent = 'De novo.';
      setTimeout(() => { if (view && view.phase === 'duelo') { $me.textContent = $opp.textContent = '?'; $me.classList.remove('shown'); $opp.classList.remove('shown'); $count.textContent = ''; duelView(); } }, 1400);
      return;
    }

    const oppPicked = v.hands[opp] === 'escolheu';
    $me.textContent = myHand ? HAND_ICON[myHand] : '?';
    $opp.textContent = oppPicked ? '✔' : '?';
    $msg.textContent = myHand ? (oppPicked ? 'Revelando…' : 'Esperando o adversário escolher…') : 'Escolha sua mão. Você tem 5 segundos.';
    setHands(!myHand);
    clear();
    timer = setInterval(() => {
      const left = Math.max(0, (view.rpsDeadline ?? 0) - serverNow());
      const bar = document.getElementById('pbar'); if (bar) bar.style.width = (left / 50) + '%';
      if (left <= 0 && Date.now() - askedTime > 1500) { askedTime = Date.now(); send({ acao: 'tempo' }); }
    }, 100);
  }

  async function pick(h) {
    myHand = h;
    document.querySelectorAll('#hands-online button').forEach((b) => b.disabled = true);
    document.getElementById('hme').textContent = HAND_ICON[h];
    document.getElementById('dmsg').textContent = 'Esperando o adversário escolher…';
    tick();
    await send({ acao: 'mao', mao: h });
  }

  function gameView(prev) {
    const v = view;
    if (!shownGame && v.rps.rounds.length > lastRounds) return duelView(prev);
    shownGame = true;
    const fresh = !S || !S.online || S.matchId !== id;
    const lastMove = v.game.moves[v.game.moves.length - 1] ?? null;
    if (fresh) {
      S = { online: true, matchId: id, you: v.you, modeKey: v.mode, conf: MODES[v.mode], wins: { X: 0, O: 0 }, games: 1, starter: v.game.moves.length ? null : v.game.turn };
    }
    const moved = !prev || !prev.game || prev.game.moves.length !== v.game.moves.length;
    S.g = v.game; S.last = lastMove; S.over = v.phase === 'fim'; S.sending = false;
    S.clock = { ...v.clock };
    if (fresh) renderGame(); else { drawBoard(); if (moved && lastMove !== null) { bang(); buzz(25); shake(); } }
    clear();
    timer = setInterval(() => {
      if (!S || !S.online) return clear();
      if (view.phase === 'jogando' && view.turnStartedAt) {
        const p = view.game.turn;
        S.clock = { ...view.clock, [p]: Math.max(0, view.clock[p] - (serverNow() - view.turnStartedAt)) };
        if (S.clock[p] <= 0 && Date.now() - askedTime > 1500) { askedTime = Date.now(); send({ acao: 'tempo' }); }
      }
      paintClocks();
    }, 100);
    paintClocks();
    if (v.phase === 'fim') finishOnline();
  }

  function finishOnline() {
    clear();
    const r = view.result;
    const won = r.winner === view.you;
    const title = r.winner === 'draw' || r.winner === null ? 'Empate' : won ? 'Você venceu!' : 'O adversário venceu';
    const why = { linha: 'Três tiros em linha. Duelo resolvido.', empate: 'Ninguém fechou a linha.', tempo: 'O pavio queimou até o fim.', desistencia: 'Desistência.' }[r.reason] || '';
    if (r.winner && r.winner !== 'draw') { bang(true); buzz([40, 60, 80]); }
    if (document.querySelector('.overlay')) return;
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = `<div class="poster"><h2>${title}</h2><p>${why}</p>
      <div class="row"><button class="cta" id="newonline" type="button">Nova partida online</button>
      <button class="cta ghost" id="tomenu" type="button">Menu</button></div></div>`;
    setTimeout(() => {
      $app.appendChild(o);
      document.getElementById('newonline').onclick = () => { o.remove(); const m = view.mode; leave(); create(m); };
      document.getElementById('tomenu').onclick = () => { o.remove(); leave(); location.hash = ''; menu(); };
    }, 700);
  }

  async function send(body) {
    try {
      const data = await call(body);
      update(data.partida);
    } catch (e) {
      if (S && S.online) { S.sending = false; const st = document.getElementById('status'); if (st) st.textContent = e.message; drawBoard(); }
      else if (body.acao === 'mao') { myHand = null; duelView(); }
      console.warn(e);
    }
  }

  async function create(mode) {
    leave();
    screen('Selando o cavalo…', '<p>Criando a partida.</p>');
    try {
      const data = await call({ acao: 'criar', modo: mode });
      id = data.id;
      history.replaceState(null, '', '#p-' + id);
      subscribe();
      update(data.partida);
    } catch (e) { errorScreen(e.message); }
  }

  async function join(matchId) {
    leave();
    id = matchId;
    screen('Chegando na cidade…', '<p>Entrando na partida.</p>');
    try {
      const data = await call({ acao: 'entrar' });
      subscribe();
      update(data.partida);
    } catch (e) { errorScreen(e.message); }
  }

  return {
    create,
    move(m) { if (!S) return; S.sending = true; drawBoard(); send({ acao: 'jogada', jogada: m }); },
    send,
    /** Abre direto na partida quando o link de convite traz #p-<id>. */
    boot() {
      const m = /^#p-([0-9a-f-]{36})$/i.exec(location.hash);
      if (!m) return false;
      join(m[1]);
      return true;
    },
  };
})();
