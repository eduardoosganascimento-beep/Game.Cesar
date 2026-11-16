# Sandman — A Lenda da Floresta

Jogo indie 2D em pixel art feito para rodar no navegador com **TypeScript + Canvas 2D + CSS**.

> A aldeia caiu. A família de Sandman foi levada por colonos portugueses.
> Anos de preparo depois, ele volta para resgatar quem ama — e acertar as contas.

**Versão atual:** `1.3` — nove capítulos, tutorial jogável, zumbis e três níveis de dificuldade.

## 🎮 Jogar agora

**[https://eduardoosganascimento-beep.github.io/Game.Cesar/](https://eduardoosganascimento-beep.github.io/Game.Cesar/)**

O site é publicado pelo **GitHub Pages** a partir do workflow `.github/workflows/deploy.yml`:
todo `push` na branch `main` roda o build e atualiza o site. Funciona em qualquer
computador com navegador — não precisa instalar nada.

> **Configuração obrigatória:** em *Settings → Pages → Source*, escolha
> **GitHub Actions**. Se ficar em "Deploy from a branch", o GitHub publica o
> `index.html` da raiz (que aponta para `src/main.ts`) e o jogo não carrega.

## Capítulos

| # | Capítulo | Tema visual | Mapa |
| --- | --- | --- | --- |
| — | Tutorial — A Trilha | Bosque | 96 colunas |
| 1 | A Aldeia | Aldeia | 132 colunas |
| 2 | O Rio Escuro | Rio | 156 colunas |
| 3 | O Acampamento | Acampamento | 176 colunas |
| 4 | O Reencontro | Noite | 196 colunas |
| 5 | O Portal | Bosque | 120 colunas |
| 6 | A Caverna | Bosque | 128 colunas |
| 7 | O Castelo | Acampamento | 136 colunas |
| 8 | O Futuro | Noite | 144 colunas |
| 9 | O Fim | Noite | 152 colunas |

Cada capítulo é um mapa aberto contínuo, com **checkpoints**, **memórias**
coletáveis e um portal de objetivo no final. Os cinco temas visuais
(aldeia, rio, acampamento, bosque e noite) são reaproveitados entre capítulos;
caverna e castelo ainda não têm cenário próprio.

## O que tem no jogo

- **Sandman** com sprites próprios de idle, corrida, salto, arremesso de lança,
  ataque corpo a corpo, dano e morte.
- **Combate**: golpe de lança, arremesso com projétil, avanço rápido (dash) e
  pisão em inimigos.
- **Inimigos**: capangas, soldados, feitores, capitães, índios, lobisomens,
  guardiões e zumbis — cada um com alcance e comportamento próprios.
- **Chefão guardião** com barra de vida no HUD.
- **Três dificuldades** (Fácil, Normal, Difícil) que escalam velocidade e dano
  dos inimigos. A escolha fica salva no navegador.
- **Memórias e checkpoints** com progresso salvo durante a fase.
- **Cenários** de dia, noite e floresta, com parallax em camadas, água, espinhos
  e fogo.
- **Efeitos** de impacto, poeira, faíscas e rastro de dash; áudio gerado por
  Web Audio (com botão de mudo no HUD).
- **Tutorial jogável** no menu principal, ensinando os controles passo a passo.

## Controles

| Ação | Tecla |
| --- | --- |
| Mover | `←` `→` ou `A` `D` |
| Pular | `Espaço`, `↑` ou `W` |
| Atacar (corpo a corpo) | `J` ou `Z` |
| Arremessar a lança | `L` ou `X` |
| Avançar (dash) | `Shift` ou `K` |
| Reiniciar capítulo | `R` |
| Pausar / voltar | `Esc` |

## Rodar localmente

Requisitos: **Node.js 18+** (recomendado 20+) e npm.

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (por padrão `http://localhost:5173`).

Para gerar e conferir a versão de produção:

```bash
npm run build       # typecheck + vite build em dist/
npm run preview     # serve dist/ em http://localhost:4173
npm run typecheck   # só o tsc --noEmit
npm run levels:check # valida os JSONs de fase
```

O build embute os arquivos de `public/` no bundle como data URI (plugin
`virtual:sandman-assets` em `vite.config.ts`), então o site publicado funciona
em qualquer hospedagem, inclusive em subpasta do GitHub Pages.

## Estrutura

```
Game.Cesar/
├── index.html              # menu, HUD, pausa e tela de fim
├── styles/main.css         # layout, molduras, overlays e menu
├── src/
│   ├── main.ts             # loop, regras da fase e renderização
│   ├── engine.ts           # constantes, câmera, colisão AABB
│   ├── input.ts            # teclado
│   ├── player.ts           # movimento, colisão, ataque, arremesso e dash
│   ├── enemy.ts            # IA dos inimigos e do chefão
│   ├── level.ts            # tilemap e leitura dos JSONs de fase
│   ├── chapters.ts         # ordem dos capítulos e textos de transição
│   ├── difficulty.ts       # dificuldades e persistência
│   ├── animator.ts         # clipes de animação
│   ├── sprites.ts          # atlas, brilho e recortes
│   ├── scenery.ts          # cenário, água, construções e objetivo
│   ├── background.ts       # parallax de floresta e noite
│   ├── effects.ts          # partículas, tremor e rastro
│   ├── audio.ts            # efeitos sonoros via Web Audio
│   ├── ui/hud.ts           # corações, memórias, chefão e prompts
│   ├── ui/screens.ts       # menu, capítulos, pausa e fim
│   └── data/levels/        # fases em JSON (cap1..cap9 + tutorial)
├── public/assets/          # sprites e fundos (embutidos no build)
├── source-art/             # arte-fonte versionada (folha de zumbi e referências)
├── scripts/                # geradores de sprites/fases e validadores
├── docs/                   # plano do jogo e guia de arte
└── .github/workflows/      # deploy automático no GitHub Pages
```

## Como as fases funcionam

Cada fase é um JSON em `src/data/levels/`. O mapa é uma lista de strings, uma
por linha, e cada caractere é um tile de 16×16:

| Char | Significado |
| --- | --- |
| `.` | vazio |
| `#` | bloco sólido |
| `-` | plataforma atravessável de cima |
| `~` | água (dano) |
| `^` | espinhos (dano) |
| `+` | tile decorativo de fundo (não colide) |

Além dos tiles, o JSON define `spawn` e uma lista de `entities` (`enemy`,
`checkpoint` e `memory`). O validador confere spawn, chão sob inimigos e
checkpoints, limites do mapa e largura consistente das linhas:

```bash
npm run levels:check
```

Para gerar/regenerar as fases a partir do gerador:

```bash
node scripts/build-levels.mjs
```

## Arte e sprites

Os sprites finais ficam em `public/assets/sprites/` e são versionados. Os
geradores leem as folhas originais:

```bash
node scripts/build-player-sprites.mjs    # Sandman
node scripts/build-colonist-sprites.mjs  # colonos
node scripts/build-wolf-sprites.mjs      # lobisomem Kennedy
node scripts/build-zombie-sprites.mjs    # zumbis (lê source-art/)
node scripts/crop-sheet.mjs              # recorte genérico de uma folha
```

As folhas de Sandman, colonos e lobo ficam em `raw/`, que **não é versionada**
(~12 MB de material de trabalho). A folha de zumbi e as referências visuais
ficam em `source-art/`, que é versionada — veja `source-art/README.md`.

Cada pasta de sprite tem um `atlas.json` com a lista de quadros, o tamanho e a
**âncora** (ponto dos pés usado para posicionar o personagem no chão).

## Estado do desenvolvimento

- O **índio** ainda não tem folha própria recortada: o atlas em
  `public/assets/sprites/indio/` está vazio e o jogo usa os quadros de Sandman
  como placeholder.
- O **urso** (boss do Capítulo 1) tem estatísticas e clipes definidos em
  `src/enemy.ts` e `src/animator.ts`, mas ainda não tem sprite nem spawn nas
  fases — não é jogável no momento.
- O jogo não tem controles por toque; foi pensado para teclado em desktop.

## Créditos

- Conceito, história e direção: projeto **Game.Cesar**
- Arte dos personagens: folhas de sprite do próprio projeto
- Referências históricas em `docs/PLANO-DO-JOGO.md`

## Licença

Projeto pessoal em desenvolvimento. Todos os direitos reservados por enquanto.
