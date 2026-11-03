-- Partidas online do Faroeste da Velha.
-- `partidas` é pública para os jogadores (o que aparece na tela e vai pelo Realtime).
-- `partidas_segredo` guarda o estado completo, com as mãos do Pedra, Papel e Tesoura
-- ainda não reveladas, e só o servidor (service role) lê e escreve nela.

create table public.partidas (
  id uuid primary key default gen_random_uuid(),
  modo text not null check (modo in ('classico', 'estendido', 'ultimate', 'gomoku')),
  anfitriao uuid not null references auth.users (id) on delete cascade,
  convidado uuid references auth.users (id) on delete set null,
  fase text not null default 'aguardando',
  estado jsonb not null,
  versao integer not null default 0,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

create table public.partidas_segredo (
  partida_id uuid primary key references public.partidas (id) on delete cascade,
  estado jsonb not null
);

alter table public.partidas enable row level security;
alter table public.partidas_segredo enable row level security;

-- Qualquer pessoa logada pode ver uma partida: o convidado precisa ler a partida
-- pelo link antes de entrar. O estado público não traz nenhum segredo.
create policy "partidas visíveis para quem está logado"
  on public.partidas for select
  to authenticated
  using (true);

-- Nenhuma policy de escrita: só a função `partida`, com a service role, grava.
-- `partidas_segredo` não tem policy nenhuma, então nenhum cliente lê.

create index partidas_anfitriao_idx on public.partidas (anfitriao);
create index partidas_convidado_idx on public.partidas (convidado);

alter publication supabase_realtime add table public.partidas;
