import cap1 from './data/levels/cap1.json'
import cap2 from './data/levels/cap2.json'
import cap3 from './data/levels/cap3.json'
import cap4 from './data/levels/cap4.json'
import cap5 from './data/levels/cap5.json'
import tutorial from './data/levels/tutorial.json'
import type { LevelData } from './level'

// Fase de tutorial: jogável pelo menu principal, mas não aparece na lista
// de capítulos nem entra na sequência de capítulos.
export const TUTORIAL: ChapterDef = {
  data: tutorial as unknown as LevelData,
  kicker: 'Tutorial',
  endText: 'Os primeiros passos do guardião. A floresta espera na aldeia — boa travessia, Sand.',
  tint: 'rgba(255, 209, 102, 0.06)',
  lockGoalUntilBoss: false,
  tag: 'Tutorial',
  cutscene: {
    title: 'O despertar',
    lines: ['Sandro acorda. A aldeia está em silêncio.', 'Pegue o cajado e a lança. A floresta vai te guiar.'],
  },
  bg: 'fg-spring',
}

export type Cutscene = {
  title: string
  lines: string[]
}

export type ChapterDef = {
  data: LevelData
  kicker: string
  endText: string
  tint: string
  lockGoalUntilBoss: boolean
  tag: string
  cutscene: Cutscene
  bg: 'forest-kenney' | 'fg-spring' | 'fg-summer' | 'fg-autumn' | 'fg-winter'
}

export const CHAPTERS: ChapterDef[] = [
  {
    data: cap1 as unknown as LevelData,
    kicker: 'Capítulo um',
    endText: 'A aldeia foi tomada. O rio leva os invasores — e o guardião vai atrás.',
    tint: 'rgba(197, 122, 61, 0.06)',
    lockGoalUntilBoss: false,
    tag: 'Aldeia',
    cutscene: {
      title: 'A aldeia em cinzas',
      lines: ['Sandro volta: a aldeia foi tomada.', 'Seu povo foi levado rio abaixo.', '— Vou trazê-los de volta —, jura o guardião.'],
    },
  bg: 'fg-spring',
  },
  {
    data: cap2 as unknown as LevelData,
    kicker: 'Capítulo dois',
    endText: 'Além do rio, fumaça sobe entre as árvores. O acampamento dos invasores não fica longe.',
    tint: 'rgba(64, 168, 184, 0.08)',
    lockGoalUntilBoss: false,
    tag: 'Rio',
    cutscene: {
      title: 'O rio escuro',
      lines: ['A correnteza é forte, mas Sandro atravessa.', 'Do outro lado, fumaça sobe entre as árvores.', 'Os invasores acamparam ali.', 'O rastro do seu povo termina nesse caminho.'],
    },
  bg: 'fg-summer',
  },
  {
    data: cap3 as unknown as LevelData,
    kicker: 'Capítulo três',
    endText: 'O acampamento caiu. Atrás da paliçada, um caminho de pedra leva ao coração da mata.',
    tint: 'rgba(190, 96, 48, 0.07)',
    lockGoalUntilBoss: false,
    tag: 'Acampamento',
    cutscene: {
      title: 'O acampamento',
      lines: ['Sandro se aproxima em silêncio.', 'As fogueiras queimam na madrugada.', 'Hoje a floresta cobra o preço da invasão.'],
    },
  bg: 'fg-autumn',
  },
  {
    data: cap4 as unknown as LevelData,
    kicker: 'Capítulo quatro',
    endText: 'O povo está livre. A floresta ainda guarda cicatrizes — mas há para onde voltar.',
    tint: 'rgba(134, 106, 226, 0.08)',
    lockGoalUntilBoss: false,
    tag: 'Bosque',
    cutscene: {
      title: 'O coração da mata',
      lines: ['No bosque sagrado, os ancestrais sussurram.', 'Sandro sente seu povo muito perto.', 'A última barreira está adiante.'],
    },
  bg: 'fg-winter',
  },
  {
    data: cap5 as unknown as LevelData,
    kicker: 'Capítulo cinco',
    endText: 'O guardião retorna à aldeia. O povo está livre, e a floresta respira de novo.',
    tint: 'rgba(255, 209, 102, 0.08)',
    lockGoalUntilBoss: false,
    tag: 'Fim',
    cutscene: {
      title: 'O regresso',
      lines: ['As algemas caem. O povo corre para Sandro.', 'A aldeia se reconstrói com suas próprias mãos.', 'A floresta respira. A lenda começa.'],
    },
  bg: 'forest-kenney',
  },
]

export function shortTitle(name: string): string {
  const parts = name.split('—')
  return (parts[1] ?? name).trim()
}
