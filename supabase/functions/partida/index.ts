// Função `partida`: o juiz das partidas online.
// Recebe { acao, ... } do jogo, confere quem é o jogador pelo login, aplica a ação com o
// mesmo motor de regras do app (bundle em ../_shared/engine.js) e grava o resultado.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import * as E from '../_shared/engine.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

type Body = {
  acao: 'criar' | 'entrar' | 'mao' | 'jogada' | 'desistir' | 'tempo' | 'ver';
  partida?: string;
  modo?: string;
  mao?: string;
  jogada?: number | { board: number; cell: number };
};

async function userId(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user?.id ?? null;
}

function publicRow(state: any) {
  return {
    fase: state.phase,
    convidado: state.players.O,
    estado: E.viewFor(state, null),
    versao: state.version,
    atualizada_em: new Date().toISOString(),
  };
}

function apply(state: any, uid: string, body: Body, now: number) {
  // Prazos vencidos (duelo ou pavio) são resolvidos antes de qualquer ação.
  const s = E.tick(state, now);
  switch (body.acao) {
    case 'entrar':
      if (s.players.X === uid || s.players.O === uid) return s; // já está na partida
      return E.joinMatch(s, uid, now);
    case 'mao': return E.pickHand(s, uid, body.mao, now);
    case 'jogada': return E.playMove(s, uid, body.jogada, now);
    case 'desistir': return E.resign(s, uid, now);
    case 'tempo':
    case 'ver': return s;
    default: throw new E.MatchError('Ação desconhecida');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ erro: 'Use POST' }, 405);

  const uid = await userId(req);
  if (!uid) return json({ erro: 'Entre no jogo antes de jogar online' }, 401);

  let body: Body;
  try { body = await req.json(); } catch { return json({ erro: 'Pedido inválido' }, 400); }
  const now = Date.now();

  try {
    if (body.acao === 'criar') {
      const state = E.createMatch(body.modo, uid);
      const { data, error } = await admin.from('partidas')
        .insert({ modo: body.modo, anfitriao: uid, ...publicRow(state) })
        .select('id').single();
      if (error) throw error;
      const { error: e2 } = await admin.from('partidas_segredo').insert({ partida_id: data.id, estado: state });
      if (e2) throw e2;
      return json({ id: data.id, partida: E.viewFor(state, uid), agora: now });
    }

    if (!body.partida) return json({ erro: 'Falta o id da partida' }, 400);

    // Duas tentativas: se o adversário gravou ao mesmo tempo, recarrega e aplica de novo.
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: secret, error } = await admin.from('partidas_segredo')
        .select('estado').eq('partida_id', body.partida).maybeSingle();
      if (error) throw error;
      if (!secret) return json({ erro: 'Partida não encontrada' }, 404);

      const before = secret.estado;
      const after = apply(before, uid, body, now);
      if (after === before || after.version === before.version) {
        return json({ id: body.partida, partida: E.viewFor(after, uid), agora: now });
      }

      const { data: updated, error: e1 } = await admin.from('partidas')
        .update(publicRow(after))
        .eq('id', body.partida).eq('versao', before.version)
        .select('id');
      if (e1) throw e1;
      if (!updated?.length) continue; // outra gravação chegou antes

      const { error: e2 } = await admin.from('partidas_segredo')
        .update({ estado: after }).eq('partida_id', body.partida);
      if (e2) throw e2;
      return json({ id: body.partida, partida: E.viewFor(after, uid), agora: now });
    }
    return json({ erro: 'Muitas jogadas ao mesmo tempo, tente de novo' }, 409);
  } catch (e) {
    if (e instanceof E.MatchError) return json({ erro: e.message }, 422);
    console.error(e);
    return json({ erro: 'Erro no servidor' }, 500);
  }
});
