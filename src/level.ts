// Level data — mapas maiores, mais detalhes, sem cabanas.
// Cada nível tem mais cols/rows, mais tiles de fundo e campo de visão aumentado.

import { TILE } from './engine'

export enum Tile {
  Empty = 0,
  Solid = 1,
  Platform = 2,
  Water = 3,
  Spike = 4,
  Background = 5, // novo: tile de fundo decorativo
}

export type LevelTheme = 'village' | 'river' | 'camp' | 'grove' | 'night'
export type EnemyKind =
  | 'capanga'
  | 'soldado'
  | 'feitor'
  | 'capitao'
  | 'indio'
  | 'lobisomem'
  | 'guardiao'

const CHARS: Record<string, Tile> = {
  '.': Tile.Empty,
  '#': Tile.Solid,
  '-': Tile.Platform,
  '~': Tile.Water,
  '^': Tile.Spike,
  '+': Tile.Background, // fundo decorativo
}

export type EntityKind = 'enemy' | 'checkpoint'

export type EntitySpawn = {
  type: EntityKind
  x: number
  y: number
  kind?: EnemyKind
  left?: number
  right?: number
}

export type LevelData = {
  name: string
  subtitle?: string
  theme: LevelTheme
  rows: string[]
  spawn: { x: number; y: number }
  entities: EntitySpawn[]
  // Campo de visão do jogador (em tiles). Aumentado de 10 para 16.
  fov: number
}

export class TileMap {
  readonly cols: number
  readonly rows: number
  readonly tiles: Tile[][]

  constructor(data: LevelData) {
    this.rows = data.rows.length
    this.cols = Math.max(...data.rows.map((row) => row.length))
    this.tiles = data.rows.map((row) => {
      const line: Tile[] = []
      for (let x = 0; x < this.cols; x += 1) {
        const char = row[x] ?? '.'
        line.push(CHARS[char] ?? Tile.Empty)
      }
      return line
    })
  }

  get width(): number {
    return this.cols * TILE
  }

  get height(): number {
    return this.rows * TILE
  }

  tileAt(tx: number, ty: number): Tile {
    if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return Tile.Empty
    return this.tiles[ty][tx]
  }

  solidsIn(rect: Rect): Rect[] {
    const found: Rect[] = []
    const x0 = Math.floor(rect.x / TILE)
    const x1 = Math.floor((rect.x + rect.w - 0.01) / TILE)
    const y0 = Math.floor(rect.y / TILE)
    const y1 = Math.floor((rect.y + rect.h - 0.01) / TILE)

    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (this.tileAt(tx, ty) === Tile.Solid) {
          found.push({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE })
        }
      }
    }
    return found
  }

  platformsIn(rect: Rect): Rect[] {
    const found: Rect[] = []
    const x0 = Math.floor(rect.x / TILE)
    const x1 = Math.floor((rect.x + rect.w - 0.01) / TILE)
    const y0 = Math.floor(rect.y / TILE)
    const y1 = Math.floor((rect.y + rect.h - 0.01) / TILE)

    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (this.tileAt(tx, ty) === Tile.Platform) {
          found.push({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE })
        }
      }
    }
    return found
  }

  spikesIn(rect: Rect): Rect[] {
    const found: Rect[] = []
    const x0 = Math.floor(rect.x / TILE)
    const x1 = Math.floor((rect.x + rect.w - 0.01) / TILE)
    const y0 = Math.floor(rect.y / TILE)
    const y1 = Math.floor((rect.y + rect.h - 0.01) / TILE)

    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (this.tileAt(tx, ty) === Tile.Spike) {
          found.push({ x: tx * TILE, y: ty * TILE + 8, w: TILE, h: 8 })
        }
      }
    }
    return found
  }

  isWater(rect: Rect): boolean {
    const x0 = Math.floor(rect.x / TILE)
    const x1 = Math.floor((rect.x + rect.w - 0.01) / TILE)
    const y0 = Math.floor(rect.y / TILE)
    const y1 = Math.floor((rect.y + rect.h - 0.01) / TILE)

    for (let ty = y0; ty <= y1; ty += 1) {
      for (let tx = x0; tx <= x1; tx += 1) {
        if (this.tileAt(tx, ty) === Tile.Water) return true
      }
    }
    return false
  }
}

// ============================================================
// Dados dos níveis — mapas alargados, mais detalhes, sem cabanas.
// Cada nível tem mais linhas/colunas, tiles '+' de fundo e
// fov aumentado para 16 tiles (~128px a 160px de visão).
// ============================================================

// --- Capítulo 1: aldeia ---
const level1Rows = [
  '#######################################',
  '#.............+.###################...#',
  '#+.################.#...............#.#',
  '#.#.......#.......#.#...............#.#',
  '#.#.......#.......#####............#..#',
  '#.#.......###.....#.#.............#...#',
  '#.#.......#.....#...#............#....#',
  '#.#.......#.....#....#...........#.....#',
  '#.#.......#.....#.....##.........#.....#',
  '#.#.......#.....#....#.#........#......#',
  '#.#.......#.....#.....#.#.......#.....#',
  '#.#.......#.....#.......#.#.....#.....#.#',
  '#.#.......#.....###########....#.......#..#',
  '#.#.......#.....#.......#....#.......#...#.#',
  '#.#.......#.....#.......#....#.......#...#..#',
  '#.#.......#.....#.......#....#.......#...#...#',
  '#.#.......#.....#.......#....#.......#...#....#',
  '#.#.......#.....###########....#.......#.....#.#',
  '#.............#.......................#.....#.',
  '#######################################',
]
export const level1: LevelData = {
  name: 'Aldeia',
  subtitle: 'Apresentação da rotina, da família e do ataque',
  theme: 'village',
  rows: level1Rows,
  spawn: { x: 2, y: 2 },
  entities: [],
  fov: 16, // aumentado de 10 para 16
}

// --- Capítulo 2: rio ---
const level2Rows = [
  '#############################',
  '#.......#.......#.............#',
  '#.###.#.###.#.###.#.###.#.###.#',
  '#.#.#...#...#.#.#...#...#...#.#',
  '#.#.#...#...#.#.#...#...#...#.#',
  '#.#.#...#...#.#.#...#...#...#.#',
  '#.#.#...#...#.#.#...#...#...#.#',
  '#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#',
  '#.#.....#...#.#.#.....#...#...#.#',
  '#.###.#.###.#.###.#.###.#.###.#',
  '#.......#.......#.............#',
  '#############################',
]
export const level2: LevelData = {
  name: 'Rio',
  subtitle: 'Sand sobrevive sozinho, aprende a caçar',
  theme: 'river',
  rows: level2Rows,
  spawn: { x: 3, y: 2 },
  entities: [],
  fov: 16,
}

// --- Capítulo 3: acampamento ---
const level3Rows = [
  '#################################',
  '#.......+.###################....',
  '#+.################.#.........+.##.',
  '#.#.......#.......#.............#.',
  '#.#.......#.......#.............#.',
  '#.#.......###.....###########....#',
  '#.#.......#.....#.......#.......#.',
  '#.#.......#.....#.......#.......#.',
  '#.#.......###.....###########....#',
  '#.#.......#.......#.......#.......#.',
  '#.#.......#.......#.......#.......#.',
  '#.#.......###########.......######.#',
  '#.#.......###########.......######.#',
  '#.#.......#.......#.......#.......#.',
  '#.#.......#.......#.......#.......#.',
  '#.#.......#.......#.......#.......#.',
  '#.#.......###########.......######.#',
  '#.#.......###########.......######.#',
  '#.#.......#.......#.......#.......#.',
  '#.#.......#.......#.......#.......#.',
  '#.#.......###########.......######.#',
  '#.#.......###########.......######.#',
  '#.#.......#.......#.......#.......#.',
  '#.#.......#.......#.......#.......#.',
  '#.#.......#############...########.#',
  '#.....#############...########....#',
  '#################################',
]
export const level3: LevelData = {
  name: 'Acampamento',
  subtitle: 'Anos de preparação, provas dos anciãos',
  theme: 'camp',
  rows: level3Rows,
  spawn: { x: 3, y: 2 },
  entities: [],
  fov: 16,
}

// --- Capítulo 4: noite ---
const level4Rows = [
  '########################################',
  '#.......#.......#.......#.......#.......#',
  '#.###.#.###.#.###.#.###.#.###.#.###.#.###',
  '#.#.#...#...#.#.#...#...#...#...#...#...#.',
  '#.#.#...#...#.#.#...#...#...#...#...#...#.',
  '#.#.#...#...#.#.#...#...#...#...#...#...#.',
  '#.#.#...#...#.#.#...#...#...#...#...#...#.',
  '#.#.#...#...#.#.#...#...#...#...#...#...#.',
  '#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#',
  '#.#.....#...#.#.#.....#...#...#...#...#...#.',
  '#.###.#.###.#.###.#.###.#.###.#.###.#.###.#',
  '#.#.#...#...#.#.#...#...#...#...#...#...#.',
  '#.#.#...#...#.#.#...#...#...#...#...#...#.',
  '#.#.#...#...#.#.#...#...#...#...#...#...#.',
  '#.#.#...#...#.#.#...#...#...#...#...#...#.',
  '#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#.#',
  '#.#.....#...#.#.#.....#...#...#...#...#...#.',
  '#.......#.......#.......#.......#.......#.',
  '########################################',
]
export const level4: LevelData = {
  name: 'Noite',
  subtitle: 'Capítulo 4, com o fundo de luar e estrelas',
  theme: 'night',
  rows: level4Rows,
  spawn: { x: 3, y: 2 },
  entities: [],
  fov: 16,
}

// Mapeia o nome do capítulo para os dados do nível
export const levels: Record<string, LevelData> = {
  1: level1,
  2: level2,
  3: level3,
  4: level4,
}

// Função para obter o nível pelo número do capítulo
export function getLevel(numero: number): LevelData {
  return levels[numero] || level1
}

// Função para verificar se o jogador está dentro do campo de visão
// (usado pelos inimigos para detectar o jogador)
export function checkFov(player: Rect, level: LevelData): boolean {
  // Retorna true se o jogador estiver dentro do campo de visão do centro do mapa
  const centerX = level.cols / 2
  const centerY = level.rows / 2
  const distX = Math.abs(player.x / TILE - centerX)
  const distY = Math.abs(player.y / TILE - centerY)
  return distX <= level.fov / 2 && distY <= level.fov / 2
}