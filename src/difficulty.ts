// src/difficulty.ts — dificuldades do Sandman
// Cada dificuldade escala velocidade de inimigos, dano recebido e
// resistência dos próprios inimigos (quantidade de ameaças no campo).

export type Difficulty = 'facil' | 'normal' | 'dificil'

export const DIFFICULTIES: Difficulty[] = ['facil', 'normal', 'dificil']

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  dificil: 'Difícil',
}

export const DELTAS: {
  speed: Record<Difficulty, number>
  damage: Record<Difficulty, number>
  enemies: Record<Difficulty, number>
} = {
  speed: { facil: 0.8, normal: 1, dificil: 1.25 },
  damage: { facil: 0.65, normal: 1, dificil: 1.35 },
  enemies: { facil: 0.6, normal: 1, dificil: 1.5 },
}

const STORAGE_KEY = 'sandman:difficulty'
const PROGRESS_KEY = 'sandman:progress'
const COMPLETED_KEY = 'sandman:completed'

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'facil' || value === 'normal' || value === 'dificil'
}

export function readDifficulty(): Difficulty {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isDifficulty(stored)) return stored
  } catch {
    // localStorage indisponível (modo privado, SSR): mantém o normal.
  }
  return 'normal'
}

export function writeDifficulty(difficulty: Difficulty): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, difficulty)
  } catch {
    // Ignora falhas de persistência.
  }
}

// Capítulo mais alto liberado (0 a 4). Usado por Continue e pela retomada.
export function readProgress(): number {
  try {
    const value = Number(window.localStorage.getItem(PROGRESS_KEY))
    if (Number.isFinite(value)) return Math.max(0, Math.min(4, Math.floor(value)))
  } catch {
    // localStorage indisponível: começa do primeiro capítulo.
  }
  return 0
}

export function writeProgress(index: number): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, String(Math.max(0, Math.min(4, Math.floor(index)))))
  } catch {
    // Ignora falhas de persistência.
  }
}

// Verdadeiro depois que o capítulo final é concluído uma vez.
export function readCompleted(): boolean {
  try {
    return window.localStorage.getItem(COMPLETED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeCompleted(): void {
  try {
    window.localStorage.setItem(COMPLETED_KEY, '1')
  } catch {
    // Ignora falhas de persistência.
  }
}
