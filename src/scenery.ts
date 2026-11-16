import { TILE, VIEW_H, VIEW_W } from './engine'
import { Tile, type LevelTheme, type TileMap } from './level'

type Palette = {
  soilA: string
  soilB: string
  soilEdge: string
  grassA: string
  grassB: string
  grassLight: string
  grassDark: string
  wood: string
  woodTop: string
  woodDark: string
  waterDeep: string
  waterMid: string
  waterLight: string
  foam: string
}

const PALETTES: Record<LevelTheme, Palette> = {
  village: {
    soilA: '#2c3b27',
    soilB: '#32442c',
    soilEdge: '#151e14',
    grassA: '#4f7a45',
    grassB: '#6aa35c',
    grassLight: '#8cc46f',
    grassDark: '#3a5732',
    wood: '#5a3f26',
    woodTop: '#8a6439',
    woodDark: '#3a2818',
    waterDeep: '#0b2830',
    waterMid: '#164650',
    waterLight: '#2f7b88',
    foam: '#a8dbe0',
  },
  river: {
    soilA: '#273a33',
    soilB: '#2d443a',
    soilEdge: '#122019',
    grassA: '#3f7a5c',
    grassB: '#5aa377',
    grassLight: '#83c99b',
    grassDark: '#2e5a43',
    wood: '#4b3b2a',
    woodTop: '#7b6040',
    woodDark: '#2b2118',
    waterDeep: '#06242e',
    waterMid: '#0d3d49',
    waterLight: '#2c8a97',
    foam: '#b9ebef',
  },
  camp: {
    soilA: '#3a3026',
    soilB: '#44382b',
    soilEdge: '#1e1812',
    grassA: '#6a5a3c',
    grassB: '#857348',
    grassLight: '#a8915e',
    grassDark: '#4a3d2a',
    wood: '#5e432b',
    woodTop: '#8d663c',
    woodDark: '#332216',
    waterDeep: '#2a2320',
    waterMid: '#3c3027',
    waterLight: '#6b5a3f',
    foam: '#b8a987',
  },
  grove: {
    soilA: '#252f35',
    soilB: '#2c3840',
    soilEdge: '#11191c',
    grassA: '#3e6151',
    grassB: '#527a62',
    grassLight: '#79a37e',
    grassDark: '#2b4238',
    wood: '#43362c',
    woodTop: '#6d5841',
    woodDark: '#251e18',
    waterDeep: '#101a2c',
    waterMid: '#1b2c44',
    waterLight: '#46679a',
    foam: '#b9d6ee',
  },
  night: {
    soilA: '#1d2634',
    soilB: '#232e3d',
    soilEdge: '#0c121b',
    grassA: '#2f4a53',
    grassB: '#3e6069',
    grassLight: '#5b8590',
    grassDark: '#1f3038',
    wood: '#3a2f27',
    woodTop: '#5b4a3b',
    woodDark: '#201a15',
    waterDeep: '#0a1226',
    waterMid: '#132444',
    waterLight: '#3a5b93',
    foam: '#c6dcff',
  },
}

const THEME_ACCENT: Record<LevelTheme, { glow: string; cloth: string; light: string }> = {
  village: { glow: 'rgba(255, 196, 92, 0.24)', cloth: '#a84832', light: '#ffd166' },
  river: { glow: 'rgba(92, 214, 220, 0.2)', cloth: '#2f7b88', light: '#9be8ec' },
  camp: { glow: 'rgba(255, 134, 64, 0.24)', cloth: '#8e342b', light: '#ffb05c' },
  grove: { glow: 'rgba(167, 138, 255, 0.24)', cloth: '#5e4a9e', light: '#c9b6ff' },
  night: { glow: 'rgba(126, 176, 255, 0.22)', cloth: '#2f4a7a', light: '#bcd6ff' },
}

function hash(value: number): number {
  const x = Math.sin(value * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function inView(x: number, pad = 80): boolean {
  return x > -pad && x < VIEW_W + pad
}

export function drawScenery(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  cameraX: number,
  cameraY: number,
  goalX: number,
  goalBaseY: number,
  time: number,
  theme: LevelTheme,
  goalLocked: boolean,
): void {
  const palette = PALETTES[theme]
  paintWater(ctx, map, cameraX, cameraY, time, palette, theme)
  paintSolids(ctx, map, cameraX, cameraY, palette)
  paintSpikes(ctx, map, cameraX, cameraY, palette)
  paintPlatforms(ctx, map, cameraX, cameraY, palette)
  paintGoal(ctx, goalX, goalBaseY, cameraX, cameraY, time, theme, goalLocked)
}

function paintWater(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  cameraX: number,
  cameraY: number,
  time: number,
  palette: Palette,
  theme: LevelTheme,
): void {
  const x0 = Math.floor(cameraX / TILE)
  const x1 = Math.ceil((cameraX + VIEW_W) / TILE)
  const y0 = Math.floor(cameraY / TILE)
  const y1 = Math.ceil((cameraY + VIEW_H) / TILE)

  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (map.tileAt(tx, ty) !== Tile.Water) continue
      const dx = tx * TILE - cameraX
      const dy = ty * TILE - cameraY
      const isSurface = map.tileAt(tx, ty - 1) !== Tile.Water

      const gradient = ctx.createLinearGradient(0, dy, 0, dy + TILE)
      gradient.addColorStop(0, palette.waterMid)
      gradient.addColorStop(0.55, palette.waterMid)
      gradient.addColorStop(1, palette.waterDeep)
      ctx.fillStyle = gradient
      ctx.fillRect(dx, dy, TILE, TILE)

      if (isSurface) {
        const wave = Math.sin(time * 2.2 + tx * 0.55) * 1.4
        ctx.fillStyle = palette.waterDeep
        ctx.fillRect(dx, dy, TILE, 3)
        ctx.fillStyle = palette.waterLight
        ctx.fillRect(dx, dy + 2 + wave, TILE, 1)
        ctx.fillStyle = palette.foam
        ctx.fillRect(dx + 3, dy + 2 + wave, 5, 1)
        ctx.fillRect(dx + 10, dy + 3 - wave, 4, 1)

        if (theme === 'river' && hash(tx * 7.3 + ty * 3.1) > 0.82) {
          const padX = dx + 3 + Math.floor(hash(tx * 2.7) * 8)
          ctx.fillStyle = '#3f7a5c'
          ctx.fillRect(padX, dy + 7, 4, 2)
          ctx.fillRect(padX + 1, dy + 6, 2, 1)
          ctx.fillStyle = '#a8c686'
          ctx.fillRect(padX + 1, dy + 6, 1, 1)
          if (hash(tx * 9.1) > 0.6) {
            ctx.fillStyle = '#e8b6c6'
            ctx.fillRect(padX + 3, dy + 5, 2, 2)
          }
        }
      }

      ctx.globalAlpha = 0.26
      ctx.fillStyle = palette.waterLight
      const shimmer = Math.sin(time * 1.6 + tx * 0.8 + ty) * 2
      ctx.fillRect(dx + 3, dy + 8 + shimmer, 5, 1)
      ctx.fillRect(dx + 10, dy + 12 - shimmer, 4, 1)
      ctx.globalAlpha = 1

      if (map.tileAt(tx - 1, ty) === Tile.Solid) {
        ctx.fillStyle = 'rgba(200, 240, 240, 0.32)'
        ctx.fillRect(dx, dy, 1, TILE)
      }
      if (map.tileAt(tx + 1, ty) === Tile.Solid) {
        ctx.fillStyle = 'rgba(200, 240, 240, 0.24)'
        ctx.fillRect(dx + TILE - 1, dy, 1, TILE)
      }
    }
  }
}

function paintSpikes(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  cameraX: number,
  cameraY: number,
  palette: Palette,
): void {
  const x0 = Math.floor(cameraX / TILE)
  const x1 = Math.ceil((cameraX + VIEW_W) / TILE)
  const y0 = Math.floor(cameraY / TILE)
  const y1 = Math.ceil((cameraY + VIEW_H) / TILE)

  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (map.tileAt(tx, ty) !== Tile.Spike) continue
      const dx = tx * TILE - cameraX
      const dy = ty * TILE - cameraY

      ctx.fillStyle = palette.woodDark
      ctx.fillRect(dx, dy + 12, TILE, 4)
      ctx.fillStyle = '#5e432b'
      ctx.fillRect(dx, dy + 12, TILE, 1)

      const stakes = 4
      for (let i = 0; i < stakes; i += 1) {
        const sx = dx + 1 + i * 4
        ctx.fillStyle = i % 2 === 0 ? '#8a6439' : '#6b4a2d'
        ctx.beginPath()
        ctx.moveTo(sx, dy + 13)
        ctx.lineTo(sx + 2, dy + 3)
        ctx.lineTo(sx + 4, dy + 13)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#e8dcc0'
        ctx.fillRect(sx + 2, dy + 4, 1, 3)
        ctx.fillStyle = 'rgba(142, 52, 43, 0.55)'
        ctx.fillRect(sx + 1, dy + 8, 1, 2)
      }
    }
  }
}

function paintSolids(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  cameraX: number,
  cameraY: number,
  palette: Palette,
): void {
  const x0 = Math.floor(cameraX / TILE)
  const x1 = Math.ceil((cameraX + VIEW_W) / TILE)
  const y0 = Math.floor(cameraY / TILE)
  const y1 = Math.ceil((cameraY + VIEW_H) / TILE)

  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (map.tileAt(tx, ty) !== Tile.Solid) continue
      const dx = tx * TILE - cameraX
      const dy = ty * TILE - cameraY
      const isTop = map.tileAt(tx, ty - 1) !== Tile.Solid
      const noise = Math.floor(hash(tx * 0.73 + ty * 3.17) * 100)
      const inWater =
        map.tileAt(tx - 1, ty) === Tile.Water ||
        map.tileAt(tx + 1, ty) === Tile.Water ||
        map.tileAt(tx, ty + 1) === Tile.Water

      ctx.fillStyle = noise % 2 === 0 ? palette.soilA : palette.soilB
      ctx.fillRect(dx, dy, TILE, TILE)

      ctx.fillStyle = 'rgba(18, 26, 16, 0.35)'
      if (noise % 5 === 0) {
        ctx.fillRect(dx + 3, dy + 7, 4, 2)
        ctx.fillRect(dx + 9, dy + 12, 3, 1)
      }
      if (noise % 7 === 0) {
        ctx.fillStyle = 'rgba(122, 103, 72, 0.35)'
        ctx.fillRect(dx + 10, dy + 4, 2, 2)
      }

      if (noise % 4 === 0) {
        ctx.fillStyle = 'rgba(92, 71, 46, 0.55)'
        const rx = dx + 3 + (noise % 9)
        ctx.fillRect(rx, dy + 6, 1, 6)
        ctx.fillRect(rx - 2, dy + 9, 2, 1)
        ctx.fillRect(rx + 1, dy + 11, 2, 1)
      }
      if (noise % 6 === 1) {
        ctx.fillStyle = 'rgba(104, 112, 92, 0.42)'
        ctx.fillRect(dx + 4, dy + 10, 2, 2)
        ctx.fillStyle = 'rgba(140, 148, 124, 0.26)'
        ctx.fillRect(dx + 4, dy + 10, 1, 1)
      }
      if (noise % 9 === 2) {
        ctx.fillStyle = 'rgba(79, 122, 69, 0.24)'
        ctx.fillRect(dx + 2, dy + 7, 5, 2)
        ctx.fillRect(dx + 9, dy + 8, 3, 1)
      }

      if (map.tileAt(tx - 1, ty) !== Tile.Solid) {
        ctx.fillStyle = palette.soilEdge
        ctx.fillRect(dx, dy, 2, TILE)
      }
      if (map.tileAt(tx + 1, ty) !== Tile.Solid) {
        ctx.fillStyle = 'rgba(12, 18, 11, 0.55)'
        ctx.fillRect(dx + TILE - 1, dy, 1, TILE)
      }

      if (isTop && inWater) {
        ctx.fillStyle = '#4a5046'
        ctx.fillRect(dx, dy, TILE, 6)
        ctx.fillStyle = '#67705f'
        ctx.fillRect(dx, dy, TILE, 2)
        ctx.fillStyle = '#a8dbe0'
        ctx.fillRect(dx, dy + 6, TILE, 1)
      } else if (isTop) {
        ctx.fillStyle = palette.grassDark
        ctx.fillRect(dx, dy + 5, TILE, 2)
        ctx.fillStyle = noise % 3 === 0 ? palette.grassA : palette.grassB
        ctx.fillRect(dx, dy, TILE, 5)
        ctx.fillStyle = palette.grassLight
        ctx.fillRect(dx, dy, TILE, 2)
        ctx.fillStyle = 'rgba(20, 37, 18, 0.35)'
        if (noise % 4 === 0) ctx.fillRect(dx + 4, dy + 3, 3, 1)
        if (noise % 6 === 0) ctx.fillRect(dx + 11, dy + 2, 2, 1)

        const tufts = 1 + (noise % 3)
        for (let i = 0; i < tufts; i += 1) {
          const bx = dx + 2 + Math.floor(hash(tx * 5.3 + i * 7.1) * 12)
          const bh = 1 + Math.floor(hash(tx * 2.1 + i) * 3)
          ctx.fillStyle = i % 2 === 0 ? palette.grassLight : palette.grassB
          ctx.fillRect(bx, dy - bh, 1, bh)
          if (i === 0) ctx.fillRect(bx + 1, dy - Math.max(1, bh - 1), 1, Math.max(1, bh - 1))
        }
      }
    }
  }
}

function paintPlatforms(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  cameraX: number,
  cameraY: number,
  palette: Palette,
): void {
  const x0 = Math.floor(cameraX / TILE)
  const x1 = Math.ceil((cameraX + VIEW_W) / TILE)
  const y0 = Math.floor(cameraY / TILE)
  const y1 = Math.ceil((cameraY + VIEW_H) / TILE)

  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (map.tileAt(tx, ty) !== Tile.Platform) continue
      const dx = tx * TILE - cameraX
      const dy = ty * TILE - cameraY
      const left = map.tileAt(tx - 1, ty) === Tile.Platform
      const right = map.tileAt(tx + 1, ty) === Tile.Platform
      const noise = Math.floor(hash(tx * 4.13 + ty) * 100)

      ctx.fillStyle = palette.woodDark
      ctx.fillRect(dx, dy + 2, TILE, 4)
      ctx.fillStyle = palette.wood
      ctx.fillRect(dx, dy + 1, TILE, 3)
      ctx.fillStyle = palette.woodTop
      ctx.fillRect(dx, dy, TILE, 2)
      ctx.fillStyle = '#6f4c2d'
      if (noise % 3 === 0) ctx.fillRect(dx + 4, dy + 2, 4, 1)
      ctx.fillStyle = palette.woodDark
      ctx.fillRect(dx + 7, dy, 1, 5)

      ctx.fillStyle = palette.grassDark
      ctx.fillRect(dx, dy - 1, TILE, 1)
      ctx.fillStyle = palette.grassB
      if (noise % 2 === 0) ctx.fillRect(dx + 2, dy - 1, 4, 1)

      if (!left) {
        ctx.fillStyle = palette.woodDark
        ctx.fillRect(dx, dy, 2, 6)
      }
      if (!right) {
        ctx.fillStyle = palette.woodDark
        ctx.fillRect(dx + TILE - 2, dy, 2, 6)
      }

      if (noise % 4 === 0) {
        const vineLength = 3 + (noise % 6)
        ctx.fillStyle = palette.grassDark
        ctx.fillRect(dx + 3, dy + 6, 1, vineLength)
        ctx.fillStyle = palette.grassB
        ctx.fillRect(dx + 2, dy + 7 + vineLength - 2, 2, 1)
      }
    }
  }
}

function paintGoal(
  ctx: CanvasRenderingContext2D,
  goalX: number,
  goalBaseY: number,
  cameraX: number,
  cameraY: number,
  time: number,
  theme: LevelTheme,
  locked: boolean,
): void {
  const x = Math.round(goalX + TILE / 2 - cameraX)
  const y = Math.round(goalBaseY - cameraY)
  if (!inView(x, 90)) return

  const accent = THEME_ACCENT[theme]
  const glowColor = locked ? 'rgba(190, 52, 42, 0.28)' : accent.glow
  const glow = ctx.createRadialGradient(x, y - 30, 2, x, y - 30, 46)
  glow.addColorStop(0, glowColor)
  glow.addColorStop(0.55, glowColor.replace(/[\d.]+\)$/, '0.08)'))
  glow.addColorStop(1, glowColor.replace(/[\d.]+\)$/, '0)'))
  ctx.fillStyle = glow
  ctx.fillRect(x - 50, y - 78, 100, 96)

  // plataforma de pedra
  ctx.fillStyle = '#4a5046'
  ctx.fillRect(x - 16, y - 4, 32, 4)
  ctx.fillStyle = '#67705f'
  ctx.fillRect(x - 13, y - 5, 26, 2)
  ctx.fillStyle = '#343a32'
  ctx.fillRect(x - 10, y - 1, 20, 1)

  // postes laterais
  ctx.fillStyle = '#3b2817'
  ctx.fillRect(x - 16, y - 40, 3, 36)
  ctx.fillRect(x + 13, y - 34, 3, 30)
  ctx.fillStyle = '#6b4a2d'
  ctx.fillRect(x - 15, y - 39, 1, 34)

  const cloths = [
    { px: x - 14, len: 14, color: accent.cloth },
    { px: x + 15, len: 10, color: locked ? '#8e342b' : '#d9822b' },
  ]
  for (const cloth of cloths) {
    const sway = Math.sin(time * 1.8 + cloth.px) * 1.5
    ctx.fillStyle = cloth.color
    for (let i = 0; i < cloth.len; i += 1) {
      ctx.fillRect(Math.round(cloth.px + sway * (i / cloth.len)), y - 34 + i, 2, 1)
    }
  }

  // tronco esculpido
  ctx.fillStyle = '#4a3220'
  ctx.fillRect(x - 6, y - 44, 12, 44)
  ctx.fillStyle = '#6b4a2d'
  ctx.fillRect(x - 5, y - 43, 3, 42)
  ctx.fillStyle = '#332314'
  ctx.fillRect(x + 2, y - 43, 2, 42)

  ctx.fillStyle = '#8a6439'
  ctx.fillRect(x - 6, y - 36, 12, 2)
  ctx.fillRect(x - 6, y - 22, 12, 2)
  ctx.fillStyle = '#2a1b0f'
  ctx.fillRect(x - 4, y - 31, 8, 6)
  ctx.fillRect(x - 3, y - 27, 6, 2)

  const pulse = 0.65 + Math.sin(time * 2.5) * 0.25
  ctx.globalAlpha = pulse
  ctx.fillStyle = locked ? '#ff6b5c' : accent.light
  ctx.fillRect(x - 4, y - 30, 2, 2)
  ctx.fillRect(x + 2, y - 30, 2, 2)
  ctx.globalAlpha = 1

  ctx.fillStyle = '#1a110a'
  ctx.fillRect(x - 3, y - 25, 6, 2)

  ctx.fillStyle = '#a84832'
  ctx.fillRect(x - 8, y - 44, 3, 7)
  ctx.fillRect(x + 5, y - 44, 3, 7)
  ctx.fillStyle = '#d9822b'
  ctx.fillRect(x - 10, y - 47, 2, 5)
  ctx.fillRect(x + 8, y - 47, 2, 5)
  ctx.fillStyle = '#e8c17a'
  ctx.fillRect(x - 7, y - 47, 2, 4)
  ctx.fillRect(x + 6, y - 47, 2, 4)

  for (let i = 0; i < 4; i += 1) {
    const phase = (time * 0.5 + i * 0.25) % 1
    const py = y - 20 - phase * 34
    const px = x + Math.sin(time * 1.4 + i * 2.2) * (5 + phase * 8)
    ctx.globalAlpha = Math.max(0, 0.8 - phase)
    ctx.fillStyle = locked ? '#ff6b5c' : accent.light
    ctx.fillRect(Math.round(px), Math.round(py), 1, 1)
  }
  ctx.globalAlpha = 1

  if (locked) {
    ctx.globalAlpha = 0.16 + Math.sin(time * 3) * 0.05
    ctx.fillStyle = '#c4473a'
    ctx.fillRect(x - 18, y - 58, 36, 58)
    ctx.globalAlpha = 0.55
    ctx.strokeStyle = '#ff8b73'
    ctx.lineWidth = 1
    for (let i = 0; i < 3; i += 1) {
      const offset = Math.sin(time * 1.6 + i * 2) * 2
      ctx.beginPath()
      ctx.moveTo(x - 18 + i * 6 + offset, y - 58)
      ctx.lineTo(x - 14 + i * 6 - offset, y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}
