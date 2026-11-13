# Sandman

Jogo indie 2D em pixel art, feito para rodar no navegador com **TypeScript + Canvas 2D + CSS**.

> A aldeia caiu. A família de Sandman foi levada por colonos portugueses.
> Anos de preparo depois, ele volta para resgatar quem ama — e acertar as contas.

**Versão atual:** `1.1` — quatro capítulos jogáveis em mapa aberto, com checkpoints, e um tutorial jogável.

## 🎮 Jogar agora no navegador

**[https://eduardoosganascimento-beep.github.io/Game.Cesar/](https://eduardoosganascimento-beep.github.io/Game.Cesar/)**

O site é publicado pelo **GitHub Pages** a partir do workflow `.github/workflows/deploy.yml`:
todo `push` na branch `main` roda o build e atualiza o site. Funciona em qualquer
computador com navegador — não precisa instalar nada.

## O que tem no jogo

- **Sandman (índio)** com a folha de sprites: idle, corrida, salto, arremesso
  de lança, ataque corpo a corpo, dano e morte — todos os quadros com a mesma
  altura e as mesmas cores da arte original.
- **Mapa aberto** em cada capítulo, sem interiores: a trilha é contínua e o
  progresso é salvo em **checkpoints** (marcas de renascimento).
- **Noite** no capítulo 4, com o fundo de luar e estrelas.
- Mapas grandes (100, 124, 140 e 152 colunas) com plataformas, espinhos,
  colonos, memórias e marcos.
- Tiro de mosquete com projétil visível, pisão que machuca o colono (nunca o
  jogador) e pixels de impacto diferentes para cada arma (daca, bala, lança).
- **Tutorial jogável** no menu principal: uma fase curta que ensina a andar,
  pular, atacar, arremessar a lança, coletar memórias e ativar checkpoints,
  passo a passo.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (por padrão `http://localhost:5173`).

Para gerar a versão de produção (site com sprites embutidos em poucos arquivos):

```bash
npm run build     # roda `tsc --noEmit` e depois o vite build em dist/
npm run preview   # serve o build local em http://localhost:4173
```

> `npm run build` **falha se houver erro de tipo**. O typecheck (`tsc --noEmit`)
> faz parte do build justamente para não subir site quebrado.

## Controles

| Ação | Tecla |
| --- | --- |
| Mover | `←` `→` ou `A` `D` |
| Pular | `Espaço`, `↑` ou `W` |
| Atacar (corpo a corpo) | `J` ou `Z` |
| Arremessar a lança | `L` ou `X` |
| Avançar (impulso) | `Shift` ou `K` |
| Reiniciar capítulo | `R` |
| Pausar | `Esc` |

## O que já funciona

- Quatro capítulos com mapas grandes (100, 124, 140 e 152 colunas)
- Sprites em pixel art: Sandman (índio), colonos, índios e o lobisomem
- Animações próprias de idle, corrida, salto, arremesso, ataque, dano e morte
- Arremesso de lança com projétil, e dano por arma com pixels distintos
- Pisão que machuca o colono (nunca o jogador)
- Colonos que atiram de mosquete com bala visível e dano por impacto
- Guardião (o chefão do acampamento) com 9 de vida
- Fundo de dia (floresta) e de noite (lua e estrelas) no capítulo 4
- Fogo de artillery, água, espinhos, marcos de renascimento e memórias
- Câmera com suavização, pausa, reinício e fim de capítulo
- Parallax de floresta em duas camadas

## Estrutura

```
Game.Cesar/
├── index.html
├── styles/main.css
├── src/
│   ├── main.ts           # loop, regras do capítulo e renderização
│   ├── engine.ts         # constantes, câmera, loop, colisão AABB
│   ├── input.ts          # teclado
│   ├── level.ts          # tilemap e dados de fase
│   ├── player.ts         # movimento, colisão, ataque e arremesso
│   ├── enemy.ts          # IA dos colonos, índios e do lobo
│   ├── scenery.ts        # cenário, água, construções e objetivo
│   ├── animator.ts       # clipes de animação
│   ├── sprites.ts        # atlas, brilho e recortes
│   ├── ui/hud.ts         # corações, memórias, boss e prompts
│   └── data/levels/      # fases em JSON
├── public/assets/        # sprites e fundo (embutidos no build)
├── scripts/              # geradores de sprites e de fases
├── docs/                 # plano do jogo e guia de arte
└── .github/workflows/    # deploy automático no GitHub Pages
```

## Como as fases funcionam

Cada fase é um JSON em `src/data/levels/`, gerado por `scripts/build-levels.mjs`:

```bash
node scripts/build-levels.mjs
```

Legenda dos tiles:

| Char | Significado |
| --- | --- |
| `.` | vazio |
| `#` | bloco sólido |
| `-` | plataforma atravessável de cima |
| `~` | água (dano) |
| `^` | espinhos |
| `+` | tile decorativo de fundo (não colide) |

## Scripts de arte

```bash
node scripts/build-player-sprites.mjs   # recorte do Sandman (folha nova)
node scripts/build-colonist-sprites.mjs  # recorte dos colonos
node scripts/build-wolf-sprites.mjs      # recorte do lobisomem Kennedy
```

Esses scripts leem as folhas originais da pasta `raw/`, que **não é versionada**
(uns 12 MB de material de trabalho). O resultado vai para `public/assets/`, que
é versionado e entra no build.

## Créditos

- Conceito, história e direção: projeto **Game.Cesar**
- Arte dos personagens: folhas de sprite do próprio projeto
- Referências históricas em `docs/PLANO-DO-JOGO.md`

## Licença

Projeto pessoal em desenvolvimento. Todos os direitos reservados por enquanto.
