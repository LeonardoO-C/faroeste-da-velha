# Faroeste da Velha

Jogo da velha competitivo com tema de faroeste mineiro.

- `packages/engine`: motor de regras (Clássico 3x3, Estendido 5x5, Gomoku 15x15, Ultimate), Pedra, Papel e Tesoura e bot com 3 níveis. TypeScript puro, usado no app e no servidor.
- `packages/prototype`: protótipo jogável em uma página HTML, para testar a diversão e o visual.

```
npm install
npm test                                  # testes do motor
node packages/prototype/build.mjs         # gera packages/prototype/dist/faroeste.html
```

## Online (Supabase)

- `supabase/migrations`: tabelas `partidas` (pública, vai pelo Realtime) e `partidas_segredo` (estado completo, só o servidor lê).
- `supabase/functions/partida`: o juiz das partidas. Usa o motor de regras gerado em `supabase/functions/_shared/engine.js`.
- `packages/prototype/online.js`: convite por link, duelo e partida em tempo real no protótipo.

Para publicar (precisa de `SUPABASE_ACCESS_TOKEN`):

```
node scripts/engine-servidor.mjs            # sempre que mudar packages/engine
npx supabase link --project-ref fvgeaoyitwbbiubsnoxw
npx supabase db push
npx supabase functions deploy partida
```

No painel do Supabase, ative o login anônimo em Authentication → Sign In / Providers.
