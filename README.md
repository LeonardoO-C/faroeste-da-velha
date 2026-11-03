# Faroeste da Velha

Jogo da velha competitivo com tema de faroeste mineiro.

- `packages/engine`: motor de regras (Clássico 3x3, Estendido 5x5, Gomoku 15x15, Ultimate), Pedra, Papel e Tesoura e bot com 3 níveis. TypeScript puro, usado no app e no servidor.
- `packages/prototype`: protótipo jogável em uma página HTML, para testar a diversão e o visual.

```
npm install
npm test                                  # testes do motor
node packages/prototype/build.mjs         # gera packages/prototype/dist/faroeste.html
```
