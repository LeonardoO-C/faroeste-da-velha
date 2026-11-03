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

// Versão para hospedar (GitHub Pages): página completa, com o cabeçalho que o visualizador do Claude adiciona sozinho.
const site = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1f130d">
<style>
*,*::before,*::after{box-sizing:border-box}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0}
img{max-width:100%}
[hidden]{display:none!important}
</style>
${html}
</head>
</html>
`.replace('</head>\n</html>', '</html>');
await mkdir(new URL('dist/site/', here), { recursive: true });
await writeFile(new URL('dist/site/index.html', here), site);
console.log('dist/faroeste.html', html.length, 'bytes; dist/site/index.html', site.length, 'bytes');
