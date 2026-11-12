# Sandman

Jogo indie 2D em pixel art, feito para rodar no navegador com **TypeScript + Canvas 2D + CSS**.

> A aldeia caiu. A família de Sandman foi levada por colonos portugueses.
> Anos de preparo depois, ele volta para resgatar quem ama — e acertar as contas.

**Versão atual:** `0.5` — quatro capítulos jogáveis, cabanas em vista de cima e o guardião dos colonos.

## 🎮 Jogar agora no navegador

**[https://eduardoosganascimento-beep.github.io/Game.Cesar/](https://eduardoosganascimento-beep.github.io/Game.Cesar/)**

O site é servido pelo **GitHub Pages** a partir da pasta `docs/` deste repositório.
Funciona em qualquer computador com navegador — não precisa instalar nada.

## O que tem no jogo

- **Sandman (índio)** com a folha de sprites nova: idle, corrida, salto, arremesso
  de lança, ataque corpo a corpo, dano e morte — todos os quadros com a mesma
  altura e as mesmas cores da arte original.
- **Cabanas** que o Sandman entra com `E` (ou `S`/`↓`): as cabanas de colonos,
  com guardas e um **Guardião** com vida extra.
  - Dentro a visão muda: o cômodo é visto **de cima**, com chão de tábuas,
    tapete, mesa, barris, lareira e a porta que só abre quando o interior é limpo.
- **Noite** no capítulo 4, com o fundo de luar e estrelas.
- Mapas grandes (100, 124, 140 e 152 colunas) com plataformas, espinhos,
  colonos, memórias e marcos.
- Tiro de mosquete com projétil visível, pisão que machuca o colono (nunca o
  jogador) e pixels de impacto diferentes para cada arma (faca, bala, lança).

## Rodar localmente

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (por padrão `http://localhost:5173`).

Para gerar a versão de produção (site com sprites embutidos, 3 arquivos):

```bash
npm run build
npm run preview
```

## Controles

| Ação | Tecla |
| --- | --- |
| Mover | `←` `→` ou `A` `D` |
| Pular | `Espaço`, `↑` ou `W` |
| Atacar (corpo a corpo) | `J` ou `Z` |
| Arremessar a lança | `L` ou `X` |
| Avançar (impulso) | `Shift` ou `K` |
| Entrar/sair de cabana | `E`, `S` ou `↓` |
| Reiniciar capítulo | `R` |
| Pausar | `Esc` |

## O que já funciona

- Quatro capítulos com mapas grandes (100, 124, 140 e 152 colunas)
- Sprites em pixel art: Sandman (índio), colonos, índios e o lobisomem
- Animações próprias de idle, corrida, salto, arremesso, ataque, dano e morte
- Arremesso de lança com projétil, e dano por arma com pixels distintos
- Pisão que machuca o colono (nunca o jogador)
- Cabanas que o Sandman entra, com porta trancada até limpar o interior
- Colonos que atiram de mosquete com bala visível e dano por impacto
- Guardião (o chefão das cabanas de colonos) com 9 de vida
- Fundo de dia (floresta) e de noite (lua e estrelas) no capítulo 4
- Fogo de artillery, água, espinhos, marcos de renascimento e memórias
- Câmera com suavização, pausa, reinício e fim de capítulo
- Parallax de floresta em duas camadas

## Estrutura

```
Sandman/
├── index.html
├── styles/main.css
├── src/
│   ├── main.ts           # loop, regras do capítulo e renderização
│   ├── engine.ts         # constantes, câmera, loop, colisão AABB
│   ├── input.ts          # teclado
│   ├── level.ts          # tilemap e dados de fase
│   ├── player.ts         # movimento, colisão, ataque e arremesso
│   ├── enemy.ts          # IA dos colonos, índios e do lobo
│   ├── cabins.ts         # cabanas e seus interiores
│   ├── scenery.ts        # cenário, cabanas e interiores
│   ├── animator.ts       # clipes de animação
│   ├── sprites.ts        # atlas, brilho e recortes
│   ├── ui/hud.ts         # corações, memórias, boss e prompts
│   └── data/levels/      # fases em JSON
├── public/assets/        # sprites e fundo (embutidos no build)
├── scripts/              # geradores de sprites e de fases
└── docs/                 # plano do jogo, guia de arte e o site publicado
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

## Scripts de arte

```bash
node scripts/build-player-sprites.mjs   # recorte do Sandman (folha nova)
node scripts/build-colonist-sprites.mjs  # recorte dos colonos
node scripts/build-wolf-sprites.mjs      # recorte do lobisomem Kennedy
```

## Créditos

- Conceito, história e direção: projeto **Game.Cesar**
- Arte dos personagens: folhas de sprite do próprio projeto
- Referências históricas em `docs/PLANO-DO-JOGO.md`

## Licença

Projeto pessoal em desenvolvimento. Todos os direitos reservados por enquanto.
