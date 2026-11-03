// Gera dist/faroeste.html: o motor de regras vira um script inline dentro da página.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const here = new URL('.', import.meta.url);
const out = await build({
  entryPoints: [new URL('../engine/src/index.ts', here).pathname],
  bundle: true, format: 'iife', globalName: 'FaroesteEngine', minify: true, write: false, target: 'es2020',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = (await readFile(new URL('index.src.html', here), 'utf8')).replace('/*ENGINE*/', () => js);
await mkdir(new URL('dist/', here), { recursive: true });
await writeFile(new URL('dist/faroeste.html', here), html);
console.log('dist/faroeste.html', html.length, 'bytes');
