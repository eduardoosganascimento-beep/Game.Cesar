import cap1 from './data/levels/cap1.json'
import cap2 from './data/levels/cap2.json'
import cap3 from './data/levels/cap3.json'
import cap4 from './data/levels/cap4.json'
import cap5 from './data/levels/cap5.json'
import cap6 from './data/levels/cap6.json'
import cap7 from './data/levels/cap7.json'
import cap8 from './data/levels/cap8.json'
import cap9 from './data/levels/cap9.json'
import tutorial from './data/levels/tutorial.json'
import type { LevelData } from './level'

// Fase de tutorial: jogável pelo menu principal, mas não aparece na lista
// de capítulos nem entra na sequência de capítulos.
export const TUTORIAL: ChapterDef = {
  data: tutorial as unknown as LevelData,
  kicker: 'Tutorial',
  endText:
    'Controles dominados. A floresta espera por você na Aldeia — boa travessia, Sand.',
  tint: 'rgba(255, 209, 102, 0.06)',
  lockGoalUntilBoss: false,
  tag: 'Tutorial',
}

export type ChapterDef = {
  data: LevelData
  kicker: string
  endText: string
  tint: string
  lockGoalUntilBoss: boolean
  tag: string
}

export const CHAPTERS: ChapterDef[] = [
  {
    data: cap1 as unknown as LevelData,
    kicker: 'Capítulo um',
    endText:
      'A trilha segue para o rio. Se a família foi levada rio abaixo, é por lá que Sand vai.',
    tint: 'rgba(255, 172, 86, 0.05)',
    lockGoalUntilBoss: false,
    tag: 'Aldeia',
  },
  {
    data: cap2 as unknown as LevelData,
    kicker: 'Capítulo dois',
    endText:
      'Do outro lado do rio, fumaça sobe entre as árvores. O acampamento não fica longe.',
    tint: 'rgba(64, 168, 184, 0.08)',
    lockGoalUntilBoss: false,
    tag: 'Rio',
  },
  {
    data: cap3 as unknown as LevelData,
    kicker: 'Capítulo três',
    endText:
      'O feitor caiu. Atrás da paliçada, um caminho de pedra leva ao coração da mata.',
    tint: 'rgba(255, 126, 62, 0.07)',
    lockGoalUntilBoss: false,
    tag: 'Acampamento',
  },
  {
    data: cap4 as unknown as LevelData,
    kicker: 'Capítulo quatro',
    endText:
      'A família está livre. A floresta ainda guarda cicatrizes — mas Sand finalmente tem para onde voltar.',
    tint: 'rgba(134, 106, 226, 0.08)',
    lockGoalUntilBoss: false,
    tag: 'Bosque',
  },
  {
    data: cap5 as unknown as LevelData,
    kicker: 'Capítulo cinco',
    endText:
      'Um portal dimensional se abre. Sand atravessa e encontra versões alternadas de sua família.',
    tint: 'rgba(255, 209, 102, 0.08)',
    lockGoalUntilBoss: false,
    tag: 'Portal',
  },
  {
    data: cap6 as unknown as LevelData,
    kicker: 'Capítulo seis',
    endText:
      'Uma cavidade natural na rocha. Memórias antigas são despertadas pelo eco da água.',
    tint: 'rgba(64, 168, 184, 0.08)',
    lockGoalUntilBoss: false,
    tag: 'Caverna',
  },
  {
    data: cap7 as unknown as LevelData,
    kicker: 'Capítulo sete',
    endText:
      'Antigos castelos se erguem entre musgo e trepadeiras. Guardiões ancestrais protegem o caminho.',
    tint: 'rgba(255, 126, 62, 0.07)',
    lockGoalUntilBoss: false,
    tag: 'Castelo',
  },
  {
    data: cap8 as unknown as LevelData,
    kicker: 'Capítulo oito',
    endText:
      'Tecnologia antiga piscando em torres distantes. O ar cheira a ozônio e ozônio.',
    tint: 'rgba(134, 106, 226, 0.08)',
    lockGoalUntilBoss: false,
    tag: 'Futuro',
  },
  {
    data: cap9 as unknown as LevelData,
    kicker: 'Capítulo nove',
    endText:
      'Sandman retorna para casa. A família está livre. A floresta ainda guarda cicatrizes.',
    tint: 'rgba(255, 209, 102, 0.08)',
    lockGoalUntilBoss: false,
    tag: 'Fim',
  },
  {
    data: tutorial as unknown as LevelData,
    kicker: 'Tutorial',
    endText:
      'Controles dominados. A floresta espera por você na Aldeia — boa travessia, Sand.',
    tint: 'rgba(255, 209, 102, 0.06)',
    lockGoalUntilBoss: false,
    tag: 'Tutorial',
  },
]

export function shortTitle(name: string): string {
  const parts = name.split('—')
  return (parts[1] ?? name).trim()
}
