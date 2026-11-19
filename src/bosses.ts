// Chefes do Sandman — todos partem do mesmo corpo do capitão, mas cada um
// recebe paleta, coroa, velocidade e agressividade próprias. Os nomes vêm do
// tupi antigo, conforme a direção do projeto (povos do litoral, séc. XVI).

import type { BossConfig } from './enemy'
import type { EnemyKind } from './level'

// Sy = mãe; Tuba = pai; Kypy'y = irmã; Kybykuera = irmãos.
const CHAPTER_BOSSES: Record<number, BossConfig> = {
  1: {
    name: 'Sy',
    title: 'Mãe',
    skin: 'sy',
    role: 'boss',
    hp: 10,
    speed: 48,
    damage: 2,
    meleeRange: 42,
    throwRange: 132,
    chargeRange: 190,
    attackCooldown: 1.15,
    chargeCooldown: 3.4,
    scale: 1,
    aura: '#c4473a',
    rim: '#ffcf9a',
    nameColor: '#ffd9a0',
  },
  2: {
    name: 'Tuba',
    title: 'Pai',
    skin: 'tuba',
    role: 'boss',
    hp: 12,
    speed: 50,
    damage: 2,
    meleeRange: 46,
    throwRange: 124,
    chargeRange: 180,
    attackCooldown: 1.25,
    chargeCooldown: 3,
    scale: 1,
    aura: '#4f8f4a',
    rim: '#c9f0a8',
    nameColor: '#c9e88a',
  },
  3: {
    name: "Kypy'y",
    title: 'Irmã',
    skin: 'kypyy',
    role: 'boss',
    hp: 14,
    speed: 54,
    damage: 2,
    meleeRange: 42,
    throwRange: 138,
    chargeRange: 205,
    attackCooldown: 1,
    chargeCooldown: 2.6,
    scale: 1,
    aura: '#ff7a3c',
    rim: '#ffe0a0',
    nameColor: '#ffb36b',
  },
  4: {
    name: 'Kybykuera',
    title: 'Irmãos',
    skin: 'kybykuera',
    role: 'boss',
    hp: 15,
    speed: 58,
    damage: 2,
    meleeRange: 44,
    throwRange: 146,
    chargeRange: 215,
    attackCooldown: 0.95,
    chargeCooldown: 2.4,
    scale: 1,
    aura: '#5c7cff',
    rim: '#a8d8ff',
    nameColor: '#9fd0ff',
  },
  5: {
    name: 'Kybykuera',
    title: 'Irmãos',
    skin: 'kybykuera',
    role: 'boss',
    hp: 18,
    speed: 60,
    damage: 2,
    meleeRange: 46,
    throwRange: 152,
    chargeRange: 225,
    attackCooldown: 0.9,
    chargeCooldown: 2.2,
    scale: 1,
    aura: '#5c7cff',
    rim: '#a8d8ff',
    nameColor: '#9fd0ff',
  },
}

// O chefão do capítulo 5: mais alto, mais resistente e com a coroa de brasa.
const GUARDIAO: BossConfig = {
  name: 'Kybykuera',
  title: 'Irmãos',
  skin: 'guardiao',
  role: 'guardiao',
  hp: 24,
  speed: 54,
  damage: 2,
  meleeRange: 52,
  throwRange: 164,
  chargeRange: 235,
  attackCooldown: 0.82,
  chargeCooldown: 2,
  scale: 1.08,
  aura: '#ffb347',
  rim: '#ffe08a',
  nameColor: '#ffd166',
}

// O mesmo chefe do capítulo 3 é reutilizado em todos os capítulos; o que muda
// é a configuração (nome, paleta e agressividade). O guardião é o chefão.
export function bossConfigFor(chapterIndex: number, kind: EnemyKind): BossConfig | null {
  if (kind === 'guardiao') return GUARDIAO
  if (kind !== 'capitao') return null
  return CHAPTER_BOSSES[Math.max(1, Math.min(5, chapterIndex + 1))] ?? null
}
