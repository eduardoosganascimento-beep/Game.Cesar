# Plano do Jogo — Sandman

> Game Design Document (versão inicial)
> Projeto: jogo indie 2D em pixel art, rodando no navegador.
> Repositório: `eduardoosganascimento-beep/Game.Cesar`

---

## 1. Visão geral

| Item | Definição |
|---|---|
| **Nome provisório** | Sandman |
| **Gênero** | Ação-aventura 2D (plataforma + combate leve) |
| **Tema** | Vingança e reencontro familiar em contexto de colonização |
| **Plataforma** | Navegador (desktop e mobile com controles na tela) |
| **Tecnologia** | HTML + CSS + JavaScript/TypeScript, Canvas 2D |
| **Modo** | Um jogador, narrativa linear |
| **Público** | 14+ anos, fãs de jogos indie narrativos |
| **Duração alvo** | 45 a 90 minutos de campanha |
| **Idioma** | Português (com opção de inglês depois) |

## 2. Premissa

Sandman é um indígena que vive com a família em uma aldeia. Colonos
portugueses invadem a região e sequestram sua família. Sem forças para reagir
no momento, ele sobrevive escondido.

Meses — e depois anos — se passam. Sandman treina, aprende a lutar, endurece.
Quando se sente pronto, parte atrás de duas coisas ao mesmo tempo: **resgatar a
família** e **cobrar a vingança** de quem a levou.

O jogo é a jornada dessa busca: da aldeia destruída até o assentamento dos
colonos.

## 3. Personagens

| Personagem | Papel | Descrição |
|---|---|---|
| **Sandman** | Protagonista | Jovem indígena. Silencioso, determinado, movido por perda e memória. Evolui de sobrevivente a caçador. |
| **Família de Sandman** | Motivação | Mãe, pai e irmãos. Aparecem em flashbacks e no resgate final. |
| **Colonos portugueses** | Antagonistas | Grupo armado que sequestra e explora. O líder é o alvo final. |
| **Aldeia** | Cenário/aliados | Anciãos e vizinhos que ensinam habilidades a Sandman. |

## 4. Tom e referências

- **Tom:** melancólico no início, tenso no meio, catártico no fim.
- **Narrativa:** contada por ambiente, flashbacks curtos e poucas falas.
- **Referências de jogabilidade:** plataformas de ação 2D com combate simples
  e progressão por capítulos.
- **Referências visuais:** pixel art com paleta terrosa, silhuetas fortes,
  iluminação por camadas de cor.

### 4.1 Cuidado com o tema (importante)

O tema envolve povos indígenas e colonização. Para tratar com respeito:

- Não usar caricatura, estereótipo visual ou fala "genérica de índio".
- Basear cenário, vestimentas e objetos em pesquisa real (povos do litoral
  brasileiro, século XVI) e citar as fontes no repositório.
- Mostrar a aldeia como comunidade viva: cultura, rotina, tecnologia própria —
  não apenas "vítimas".
- A violência é sugerida, não exibida de forma gratuita.
- Se possível, buscar leitura/validação de alguém da área ou de comunidades
  indígenas antes de publicar.

## 5. Estrutura narrativa — 5 capítulos

| Cap. | Título | O que acontece | Mecânica nova |
|---|---|---|---|
| 1 | **A Aldeia** | Apresentação da rotina, da família e do ataque | Movimento, pulo, esconder-se |
| 2 | **As Cinzas** | Sandman sobrevive sozinho, aprende a caçar | Combate básico, arco |
| 3 | **O Treino** | Anos de preparação, provas dos anciãos | Esquiva, contra-ataque, escalada |
| 4 | **A Trilha** | Viagem por floresta, rio e acampamentos inimigos | Furtividade, armadilhas |
| 5 | **O Assentamento** | Invasão do forte, confronto com o líder, resgate | Combinação de tudo |

**Final:** Sandman encontra a família. A vingança é consumada, mas o custo
emocional aparece — o final não é "feliz e limpo", é agridoce.

## 6. Pilares de design

1. **Perda que move** — toda mecânica reforça a jornada de Sandman.
2. **Silêncio que fala** — narrativa por ambiente, sem cutscenes longas.
3. **Combate legível** — poucas opções, todas com resposta clara.
4. **Curto e denso** — campanha de 45 a 90 minutos, sem enrolação.
5. **Respeito ao tema** — nenhuma escolha de arte ou roteiro reforça estereótipo.

## 7. Loop de jogo

```
Explorar a área
  → identificar inimigo ou obstáculo
    → escolher: lutar, esconder ou desviar
      → executar a ação
        → avançar e ouvir um fragmento da história
```

Loop de combate: aproximar → atacar/esquivar → recuar → repetir.

## 8. Mecânicas

### 8.1 Movimento
- Correr para os lados
- Pular com altura variável
- Escalar superfícies marcadas (a partir do cap. 3)
- Agachar/esconder-se em arbustos (furtividade)

### 8.2 Combate
- Ataque corpo a corpo com alcance curto
- Arremesso de lança (projetil que atravessa a tela)
- Esquiva com janela de invencibilidade curta
- Inimigos com padrão simples: patrulha, investida, ataque à distância
- Pisão: cair sobre um colono machuca o colono, nunca o jogador
- Cada arma deixa pixels de impacto próprios (faca, bala, lança)

### 8.2.1 Cabanas
- Sandman entra nas cabanas do caminho com `E` (ou `S`/`↓`)
- Dentro há colonos guarding a mesa e uma porta de saída
- A porta fica trancada até o interior ser limpo
- Cabana limpa continua limpa até o capítulo recomeçar

### 8.3 Recursos
- **Vida:** 3 corações, recuperáveis em fogueiras
- **Resistência:** limita esquiva e escalada
- **Munição:** flechas coletadas no cenário
- **Memórias:** itens narrativos que liberam flashbacks

### 8.4 Controles

| Ação | Teclado | Controle |
|---|---|---|
| Mover | ← → / A D | Analógico/direcional |
| Pular | Espaço | Botão A |
| Atacar | J ou Z | Botão X |
| Arremessar lança | L ou X | Botão Y |
| Avançar | Shift ou K | Botão B |
| Entrar/sair de cabana | E / S / ↓ | Botão A |
| Pausar | Esc | Start |

## 9. Progressão e regras

- **Checkpoint:** início de cada capítulo e em fogueiras.
- **Morte:** reinicia no último checkpoint, sem perda de progresso narrativo.
- **Dificuldade:** três níveis (História, Normal, Desafio).
- **Salvamento:** local (`localStorage`), sem conta.
- **Vitória:** concluir o capítulo 5.
- **Derrota:** não há game over permanente.

## 10. Arte e áudio

- **Resolução interna:** 320×180, escala inteira para caber na tela.
- **Tiles:** 16×16 px.
- **Paleta:** terrosos + verde de mata + vermelho de fogo, limitada por capítulo.
- **Camadas:** fundo (parallax), meio, jogável, frente.
- **Animações por personagem:** idle, correr, pular, cair, atacar, esquivar, dano, morte.
- **Áudio:** música ambiente por capítulo + efeitos de passo, golpe, arco, fogo.
- **Ferramentas:** Aseprite (arte), Audacity (som), assets livres com licença.

## 11. Tecnologia

| Camada | Escolha |
|---|---|
| Linguagem | TypeScript (compilado para JS) |
| Build | Vite |
| Renderização | Canvas 2D |
| Estilo/UI | CSS puro (menu, HUD, telas) |
| Física | Implementação própria (AABB + gravidade) |
| Assets | PNG + áudio OGG/MP3 |
| Versionamento | Git + GitHub |
| Publicação | GitHub Pages |

### 11.1 Por que TypeScript + Canvas
TypeScript dá segurança nos tipos para física, estados do jogador e dados de
fase. Canvas 2D é simples, leve e suficiente para pixel art com controles
precisos. CSS cuida de menus, HUD e telas — separando interface de jogo.

### 11.2 Estrutura de pastas prevista

```
Game.Cesar/
├── index.html
├── README.md
├── PLANO-DO-JOGO.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── assets/
│       ├── sprites/
│       ├── tiles/
│       └── audio/
├── src/
│   ├── main.ts          # bootstrap + loop
│   ├── engine/
│   │   ├── loop.ts
│   │   ├── input.ts
│   │   ├── physics.ts
│   │   ├── camera.ts
│   │   └── renderer.ts
│   ├── entities/
│   │   ├── player.ts
│   │   ├── enemy.ts
│   │   └── projectile.ts
│   ├── world/
│   │   ├── level.ts
│   │   └── tilemap.ts
│   ├── ui/
│   │   ├── hud.ts
│   │   └── menu.ts
│   └── data/
│       └── levels/
│           ├── cap1.json
│           └── ...
└── styles/
    └── main.css
```

## 12. Cronograma

| Etapa | Entrega | Prazo estimado |
|---|---|---|
| 1. Planejamento | Este documento | feito |
| 2. Protótipo | Sandman anda, pula e colide | semana 1 |
| 3. Núcleo | Câmera, tilemap, capítulo 1 jogável | semana 2 |
| 4. Combate | Ataque, esquiva, inimigo básico | semana 3 |
| 5. Conteúdo | Capítulos 2 a 4 | semanas 4–6 |
| 6. Capítulo final | Capítulo 5 + final | semana 7 |
| 7. Polimento | Som, HUD, menus, dificuldade | semana 8 |
| 8. Publicação | GitHub Pages + README final | semana 9 |

## 13. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Escopo grande demais | Não terminar | 5 capítulos curtos, cortar extras |
| Combate "duro" | Jogo frustrante | Ajustar janelas de esquiva cedo |
| Tema mal tratado | Problema ético | Pesquisa + leitura crítica antes de publicar |
| Falta de arte | Bloqueio | Sprites provisórias até o fim da fase 4 |
| Performance no mobile | Jogo travado | Limitar partículas e camadas de parallax |

## 14. Critérios de sucesso

- [ ] Os 5 capítulos são jogáveis do início ao fim
- [ ] Um jogador novo entende os controles sem tutorial escrito
- [ ] Roda no navegador, desktop e mobile, sem instalar
- [ ] A história é compreensível só por ambiente e flashbacks
- [ ] Nenhum elemento visual ou de roteiro depende de estereótipo indígena

## 15. Próximos passos

1. Definir o visual de Sandman (silhueta + 3 cores base).
2. Montar o protótipo de movimento e validar o "peso" do pulo.
3. Escrever o roteiro curto dos flashbacks do capítulo 1.
4. Pesquisar referências históricas e registrar as fontes no repositório.

---

*Documento inicial. O plano deve evoluir junto com o jogo.*
