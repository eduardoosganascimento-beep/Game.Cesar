import cap1 from './data/levels/cap1.json'
import cap2 from './data/levels/cap2.json'
import cap3 from './data/levels/cap3.json'
import cap4 from './data/levels/cap4.json'
import cap5 from './data/levels/cap5.json'
import tutorial from './data/levels/tutorial.json'
import type { BgScene } from './background'
import type { LevelData } from './level'

// Fase de tutorial: jogável pelo menu principal, mas não aparece na lista
// de capítulos nem entra na sequência de capítulos.
export const TUTORIAL: ChapterDef = {
  data: tutorial as unknown as LevelData,
  kicker: 'Tutorial',
  endText: 'Os primeiros passos do guardião. A floresta espera na aldeia — boa travessia, Sandman.',
  tint: 'rgba(255, 209, 102, 0.06)',
  lockGoalUntilBoss: false,
  tag: 'Tutorial',
  cutscene: {
    title: 'O despertar',
    lines: ['Sandman acorda. A aldeia está em silêncio.', 'Pegue o cajado e a lança. A floresta vai te guiar.'],
  },
  bg: 'river-dawn',
  detail: 'Aprenda a lança, o tacape e o salto antes de encarar a floresta.',
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
  bg: BgScene
  detail: string
}

export const CHAPTERS: ChapterDef[] = [
  {
    data: cap1 as unknown as LevelData,
    kicker: 'Capítulo um',
    endText: 'A aldeia foi tomada. O rio leva os invasores — e o guardião vai atrás.',
    tint: 'rgba(255, 96, 24, 0.05)',
    lockGoalUntilBoss: false,
    tag: 'Aldeia',
    cutscene: {
      title: 'A aldeia em cinzas',
      lines: ['Sandman volta: a aldeia foi tomada.', 'Seu povo foi levado rio abaixo.', '— Vou trazê-los de volta —, jura o guardião.'],
    },
    bg: 'village-fire',
    detail: 'Reacenda os marcos de fogueira e atravesse a aldeia tomada antes que o rastro esfrie.',
  },
  {
    data: cap2 as unknown as LevelData,
    kicker: 'Capítulo dois',
    endText: 'Além do rio, fumaça sobe entre as árvores. O acampamento dos invasores não fica longe.',
    tint: 'rgba(160, 220, 230, 0.045)',
    lockGoalUntilBoss: false,
    tag: 'Rio',
    cutscene: {
      title: 'O rio escuro',
      lines: ['A correnteza é forte, mas Sandman atravessa.', 'Do outro lado, fumaça sobe entre as árvores.', 'Os invasores acamparam ali.', 'O rastro do seu povo termina nesse caminho.'],
    },
    bg: 'waterfall',
    detail: 'Correnteza, névoa e soldados de arcabuz: o rio não perdoa quem hesita.',
  },
  {
    data: cap3 as unknown as LevelData,
    kicker: 'Capítulo três',
    endText: 'O acampamento caiu. Atrás da paliçada, um caminho de pedra leva ao coração da mata.',
    tint: 'rgba(44, 64, 140, 0.09)',
    lockGoalUntilBoss: true,
    tag: 'Ruínas',
    cutscene: {
      title: 'As ruínas',
      lines: ['A noite cai sobre as ruínas antigas.', 'Fogueiras inimigas queimam entre as colunas.', 'Hoje a floresta cobra o preço da invasão.'],
    },
    bg: 'temple-night',
    detail: 'Colunas antigas e fogueiras inimigas — a mata cobra o preço da invasão.',
  },
  {
    data: cap4 as unknown as LevelData,
    kicker: 'Capítulo quatro',
    endText: 'O povo está livre. A floresta ainda guarda cicatrizes — mas há para onde voltar.',
    tint: 'rgba(110, 130, 200, 0.07)',
    lockGoalUntilBoss: false,
    tag: 'Bosque',
    cutscene: {
      title: 'O coração da mata',
      lines: ['No bosque sagrado, os ancestrais sussurram.', 'Sandman sente seu povo muito perto.', 'A última barreira está adiante.'],
    },
    bg: 'temple-steps',
    detail: 'No bosque sagrado, os ancestrais apontam a última barreira.',
  },
  {
    data: cap5 as unknown as LevelData,
    kicker: 'Capítulo cinco',
    endText: 'O guardião retorna à aldeia. O povo está livre, e a floresta respira de novo.',
    tint: 'rgba(255, 214, 140, 0.06)',
    lockGoalUntilBoss: true,
    tag: 'Fim',
    cutscene: {
      title: 'O regresso',
      lines: ['As algemas caem. O povo corre para Sandman.', 'A aldeia se reconstrói com suas próprias mãos.', 'A floresta respira. A lenda começa.'],
    },
    bg: 'forest-dawn',
    detail: 'Amanhecer: o povo livre reconstrói a aldeia, e a lenda começa.',
  },
]

export function shortTitle(name: string): string {
  const parts = name.split('—')
  return (parts[1] ?? name).trim()
}
