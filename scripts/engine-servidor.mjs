// Gera supabase/functions/_shared/engine.js, o motor de regras em JavaScript para a função do Supabase.
// Rode de novo sempre que mudar packages/engine: node scripts/engine-servidor.mjs
import { build } from 'esbuild';

await build({
  entryPoints: [new URL('../packages/engine/src/index.ts', import.meta.url).pathname],
  outfile: new URL('../supabase/functions/_shared/engine.js', import.meta.url).pathname,
  bundle: true,
  format: 'esm',
  target: 'es2022',
  banner: { js: '// Arquivo gerado por scripts/engine-servidor.mjs a partir de packages/engine. Não edite.' },
});
console.log('supabase/functions/_shared/engine.js gerado');
