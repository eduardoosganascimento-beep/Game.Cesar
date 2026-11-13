# Guia de arte — sprites, recortes e o site publicado

Este documento explica como as folhas de sprite entram no jogo e como o
resultado é publicado no GitHub Pages.

## Onde cada sprite mora

| Personagem | Pasta | Gerador |
| --- | --- | --- |
| Sandman (índio) | `public/assets/sprites/player/` | `node scripts/build-player-sprites.mjs` |
| Colonos | `public/assets/sprites/colonist/` | `node scripts/build-colonist-sprites.mjs` |
| Índios | `public/assets/sprites/indio/` | `node scripts/build-player-sprites.mjs` |
| Kennedy (lobo) | `public/assets/sprites/wolf/` | `node scripts/build-wolf-sprites.mjs` |

Cada pasta tem um `atlas.json` com a lista de quadros, o tamanho de cada um e a
**âncora** (o ponto dos pés usado para posicionar o personagem no chão).

## Como o recorte funciona

### Folha do Sandman e do lobo

1. O fundo xadrez/claro é removido por componentes de pixels claros e neutros.
   Brilhos pequenos (olhos, dentes) são preservados.
2. Os componentes grandes viram o corpo; efeitos próximos (poeira, faíscas) são
   anexados ao quadro.
3. A folha é reduzida por média de área para o mesmo porte dos colonos.
4. **Todos os quadros saem com o mesmo tamanho** e a âncora é ajustada ao
   deslocamento da arte dentro do quadro — é isso que impede o sprite de
   "descolar" do personagem.

### Folha dos colonos

1. O fundo azul-escuro é medido e removido por distância de cor.
2. A redução usa média de alfa, então o corpo fica inteiro (sem buracos).
3. Cada quadro é posicionado pelo corpo principal, e não pela lâmina ou fumaça.

## Animações

| Clipe | Quadros | FPS |
| --- | --- | --- |
| `idle` | 7 | 6 |
| `run` | 7 | 12 |
| `jump` / `fall` | 2 / 1 | 8 / 1 |
| `attack` (corpo a corpo) | 5 | 18 |
| `throw` (arremesso de lança) | 5 | 12 |
| `hurt` | 3 | 10 |
| `death` | 5 | 7 |

O jogo espelha o desenho quando o personagem anda para a esquerda.

## Como publicar

O `vite.config.ts` embute todos os arquivos de `public/` dentro do bundle como
data URI. Com isso o site publicado tem apenas três arquivos:

```
dist/
├── index.html
├── index.css
└── index.js
```

Para publicar:

```bash
npm run build
```

Depois envie os três arquivos de `dist/` para a pasta `docs/` do repositório
`eduardoosganascimento-beep/Game.Cesar`. O GitHub Pages serve essa pasta e o
jogo fica disponível em:

**https://eduardoosganascimento-beep.github.io/Game.Cesar/**

## Regras para o recorte funcionar

- Um sprite por quadro, sem espaço extra entre eles.
- O fundo precisa ser uma cor única (ou xadrez de duas cores iguais).
- Nada importante encostado na borda da célula: a ponta da lança pode
  atravessar, e o recorte acompanha o corpo.
- Os rótulos das folhas são apagados automaticamente.
