// Level data — mapas maiores, mais detalhes, sem cabanas.
// Cada nível tem mais cols/rows, mais tiles de fundo e campo de visão aumentado.

import { TILE, type Rect } from './engine'

export enum Tile {
  Empty = 0,
  Solid = 1,
  Platform = 2,
  Water = 3,
  Spike = 4,
  Background = 5, // folhagem de fundo: enfeite, não bloqueia
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
  | 'zumbi'

const CHARS: Record<string, Tile> = {
  '.': Tile.Empty,
  '#': Tile.Solid,
  '-': Tile.Platform,
  '~': Tile.Water,
  '^': Tile.Spike,
  '+': Tile.Background, // fundo decorativo
}

export type EntityKind = 'enemy' | 'checkpoint' | 'memory'

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
  // Quando true, o capítulo acontece à noite: fundo de luar, luar e
  // vagalumes no lugar dos raios de sol.
  night?: boolean
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
