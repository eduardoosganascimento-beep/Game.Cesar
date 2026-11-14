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

function topSolidRow(map: TileMap, tx: number): number {
  if (tx < 0 || tx >= map.cols) return -1
  for (let ty = 0; ty < map.rows; ty += 1) {
    if (map.tileAt(tx, ty) === Tile.Solid) return ty
  }
  return -1
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
  paintProps(ctx, theme, cameraX, cameraY, time)
  paintWater(ctx, map, cameraX, cameraY, time, palette, theme)
  paintSolids(ctx, map, cameraX, cameraY, palette)
  paintSpikes(ctx, map, cameraX, cameraY, palette)
  paintPlatforms(ctx, map, cameraX, cameraY, palette)
  paintForeground(ctx, map, cameraX, cameraY, palette)
  paintGoal(ctx, goalX, goalBaseY, cameraX, cameraY, time, theme, goalLocked)
}

// ---------- construÃƒÂ§ÃƒÂµes ----------

function paintHut(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  time: number,
  variant: number,
): void {
  if (!inView(x)) return

  const width = 58 + (variant % 3) * 4
  const wallTop = baseY - 30
  const peak = baseY - 50 - (variant % 2) * 5

  const glow = ctx.createRadialGradient(x + width / 2, wallTop + 15, 1, x + width / 2, wallTop + 15, 44)
  glow.addColorStop(0, 'rgba(255, 190, 92, 0.16)')
  glow.addColorStop(1, 'rgba(255, 190, 92, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(x - 30, wallTop - 30, width + 60, 80)

  ctx.fillStyle = variant % 2 === 0 ? '#3a2b1d' : '#33261a'
  ctx.fillRect(x, wallTop, width, baseY - wallTop)
  ctx.fillStyle = '#4a3623'
  for (let i = 4; i < width; i += 9) ctx.fillRect(x + i, wallTop + 2, 1, baseY - wallTop - 4)
  ctx.fillStyle = '#251a11'
  ctx.fillRect(x, wallTop, width, 3)
  ctx.fillRect(x + width - 2, wallTop, 2, baseY - wallTop)

  const roofColor = variant % 2 === 0 ? '#6b4a2d' : '#624326'
  const roofLight = variant % 2 === 0 ? '#8a6439' : '#7d5932'
  ctx.fillStyle = roofColor
  ctx.beginPath()
  ctx.moveTo(x - 8, wallTop + 2)
  ctx.lineTo(x + width / 2, peak)
  ctx.lineTo(x + width + 8, wallTop + 2)
  ctx.lineTo(x + width + 3, wallTop + 7)
  ctx.lineTo(x + width / 2, peak + 9)
  ctx.lineTo(x - 3, wallTop + 7)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = roofLight
  for (let i = 0; i < 8; i += 1) {
    const y = peak + 5 + i * 3
    const half = (y - peak) * 1.4
    if (y > wallTop) break
    ctx.fillRect(Math.round(x + width / 2 - half), y, Math.max(2, Math.round(half * 0.4)), 1)
  }

  ctx.fillStyle = '#3a2616'
  ctx.fillRect(x + width / 2 - 6, baseY - 14, 12, 14)
  ctx.fillStyle = '#0d0906'
  ctx.fillRect(x + width / 2 - 4, baseY - 12, 8, 12)

  // Lanternim e degrau de pedra na porta.
  const lampX = Math.round(x + width / 2 + 9)
  const lampY = baseY - 30
  ctx.fillStyle = '#241708'
  ctx.fillRect(lampX, lampY, 1, 5)
  ctx.fillStyle = '#7d5a2a'
  ctx.fillRect(lampX - 3, lampY + 4, 7, 6)
  ctx.fillStyle = '#ffcf7a'
  ctx.fillRect(lampX - 2, lampY + 5, 5, 4)
  ctx.fillStyle = '#fff3c4'
  ctx.fillRect(lampX - 1, lampY + 6, 3, 2)
  const lampGlow = ctx.createRadialGradient(lampX, lampY + 7, 1, lampX, lampY + 7, 40)
  const lampFlicker = 0.75 + Math.sin(time * 6.3 + variant) * 0.18
  lampGlow.addColorStop(0, `rgba(255, 196, 110, ${(0.2 * lampFlicker).toFixed(3)})`)
  lampGlow.addColorStop(1, 'rgba(255, 196, 110, 0)')
  ctx.fillStyle = lampGlow
  ctx.fillRect(lampX - 40, lampY - 33, 80, 80)

  ctx.fillStyle = '#3c3a33'
  ctx.fillRect(Math.round(x + width / 2 - 10), baseY - 3, 20, 3)
  ctx.fillStyle = '#55524a'
  ctx.fillRect(Math.round(x + width / 2 - 10), baseY - 3, 20, 1)
  ctx.fillStyle = '#3a5732'
  ctx.fillRect(Math.round(x + width / 2 - 11), baseY - 1, 4, 2)
  ctx.fillRect(Math.round(x + width / 2 + 8), baseY - 1, 4, 2)

  const flicker = 0.7 + Math.sin(time * 2.4 + variant * 2.1) * 0.12 + Math.sin(time * 7.3 + variant) * 0.05
  ctx.globalAlpha = flicker
  ctx.fillStyle = '#ffb85c'
  ctx.fillRect(x + 9, wallTop + 11, 10, 8)
  ctx.fillStyle = '#fff0b8'
  ctx.fillRect(x + 11, wallTop + 13, 3, 3)
  ctx.globalAlpha = 1
  ctx.fillStyle = '#2a1b0f'
  ctx.fillRect(x + 9, wallTop + 18, 10, 1)
  ctx.fillRect(x + 13, wallTop + 11, 1, 8)

  ctx.fillStyle = '#2b1a0d'
  ctx.fillRect(x + 1, wallTop + 2, 2, baseY - wallTop)
  ctx.fillRect(x + width - 3, wallTop + 2, 2, baseY - wallTop)

  ctx.fillStyle = '#3a5732'
  ctx.fillRect(x - 2, wallTop + 1, 10, 2)
  ctx.fillRect(x + width - 9, wallTop, 8, 2)
  ctx.fillStyle = '#6aa35c'
  ctx.fillRect(x + 1, wallTop - 1, 2, 2)
  ctx.fillRect(x + width - 6, wallTop - 2, 2, 2)
}

function paintCampfire(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  time: number,
): void {
  if (!inView(x)) return

  const glow = ctx.createRadialGradient(x, baseY - 8, 2, x, baseY - 8, 34)
  glow.addColorStop(0, 'rgba(255, 168, 68, 0.24)')
  glow.addColorStop(1, 'rgba(255, 168, 68, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(x - 36, baseY - 44, 72, 56)

  ctx.fillStyle = '#4a3422'
  ctx.fillRect(x - 8, baseY - 3, 16, 3)
  ctx.fillStyle = '#6b4a2d'
  ctx.fillRect(x - 6, baseY - 4, 12, 2)

  const flicker = Math.sin(time * 8 + x) * 1.5
  ctx.fillStyle = '#d9534f'
  ctx.beginPath()
  ctx.moveTo(x - 4, baseY - 5)
  ctx.lineTo(x + flicker, baseY - 17 - Math.sin(time * 6) * 2)
  ctx.lineTo(x + 5, baseY - 5)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#ffb84d'
  ctx.beginPath()
  ctx.moveTo(x - 2, baseY - 5)
  ctx.lineTo(x + 1 + flicker * 0.5, baseY - 12)
  ctx.lineTo(x + 3, baseY - 5)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#fff0b8'
  ctx.fillRect(x, baseY - 8, 1, 3)

  for (let i = 0; i < 3; i += 1) {
    const rise = (time * 9 + i * 7) % 26
    ctx.globalAlpha = Math.max(0, 0.2 - rise / 130)
    ctx.fillStyle = '#b9c0b2'
    ctx.fillRect(Math.round(x - 1 + Math.sin(time + i) * 3), Math.round(baseY - 18 - rise), 1, 1)
  }
  ctx.globalAlpha = 1
}

function paintTent(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  time: number,
  variant: number,
): void {
  if (!inView(x)) return
  const width = 46 + (variant % 2) * 8
  const height = 30 + (variant % 3) * 3
  const peakX = x + width / 2
  const peakY = baseY - height

  const glow = ctx.createRadialGradient(peakX, baseY - 6, 1, peakX, baseY - 6, 38)
  glow.addColorStop(0, 'rgba(255, 176, 92, 0.14)')
  glow.addColorStop(1, 'rgba(255, 176, 92, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(x - 30, peakY - 12, width + 60, height + 24)

  ctx.fillStyle = variant % 2 === 0 ? '#4a3a28' : '#3f3122'
  ctx.beginPath()
  ctx.moveTo(x, baseY - 1)
  ctx.lineTo(peakX, peakY)
  ctx.lineTo(x + width, baseY - 1)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.beginPath()
  ctx.moveTo(peakX, peakY + 2)
  ctx.lineTo(x + width * 0.72, baseY - 1)
  ctx.lineTo(x + width * 0.55, baseY - 1)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#1b130c'
  ctx.beginPath()
  ctx.moveTo(peakX - 6, baseY - 1)
  ctx.lineTo(peakX, peakY + 12)
  ctx.lineTo(peakX + 6, baseY - 1)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#ffb05c'
  const flicker = 0.55 + Math.sin(time * 4.8 + variant) * 0.2
  ctx.globalAlpha = flicker
  ctx.fillRect(peakX - 3, baseY - 5, 2, 3)
  ctx.globalAlpha = 1

  ctx.fillStyle = '#2b2118'
  ctx.fillRect(peakX - 1, peakY - 10, 2, 11)
  ctx.fillStyle = variant % 2 === 0 ? '#8e342b' : '#a84832'
  const flap = Math.sin(time * 2.1 + variant) * 1.5
  ctx.fillRect(peakX + 1, peakY - 9, 9, 4)
  ctx.fillRect(peakX + 9 + flap, peakY - 8, 3, 3)
  ctx.fillStyle = '#d8c9a2'
  ctx.fillRect(peakX + 3, peakY - 8, 2, 2)
}

function paintWatchtower(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  time: number,
): void {
  if (!inView(x)) return
  const width = 30
  const top = baseY - 54

  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
  ctx.fillRect(x - 4, baseY - 3, width + 8, 3)

  ctx.fillStyle = '#332216'
  ctx.fillRect(x + 2, top + 10, 3, 41)
  ctx.fillRect(x + width - 5, top + 10, 3, 41)
  ctx.fillStyle = '#5e432b'
  ctx.fillRect(x + 3, top + 10, 1, 41)
  ctx.fillRect(x + width - 4, top + 10, 1, 41)

  for (let i = 0; i < 4; i += 1) {
    const y = top + 18 + i * 8
    ctx.fillStyle = '#3f2d1d'
    ctx.fillRect(x + 4, y, width - 8, 2)
  }

  ctx.fillStyle = '#2b2118'
  ctx.fillRect(x - 3, top, width + 6, 12)
  ctx.fillStyle = '#6b4a2d'
  ctx.fillRect(x - 2, top, width + 4, 3)
  ctx.fillStyle = '#3f2d1d'
  ctx.fillRect(x + 1, top + 4, width - 2, 5)

  ctx.fillStyle = '#8e342b'
  const sway = Math.sin(time * 2.2) * 1.5
  ctx.fillRect(x + width - 2, top - 12, 2, 13)
  ctx.fillRect(x + width, top - 12, 8 + sway, 5)
  ctx.fillStyle = '#d8c9a2'
  ctx.fillRect(x + width + 2, top - 11, 2, 2)

  const flicker = 0.6 + Math.sin(time * 6) * 0.2
  ctx.globalAlpha = flicker
  ctx.fillStyle = '#ffb05c'
  ctx.fillRect(x + width / 2 - 2, top + 5, 4, 4)
  ctx.globalAlpha = 1
}

function paintPalisade(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  variant: number,
): void {
  if (!inView(x)) return
  for (let i = 0; i < 7; i += 1) {
    const px = x + i * 7
    const height = 22 + Math.floor(hash(variant * 7 + i) * 9)
    ctx.fillStyle = i % 2 === 0 ? '#3a2a1b' : '#332418'
    ctx.fillRect(px, baseY - height, 5, height)
    ctx.fillStyle = '#5e432b'
    ctx.fillRect(px + 1, baseY - height + 2, 1, height - 3)
    ctx.fillStyle = '#241810'
    ctx.beginPath()
    ctx.moveTo(px, baseY - height)
    ctx.lineTo(px + 2, baseY - height - 4)
    ctx.lineTo(px + 5, baseY - height)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = '#2b2118'
  ctx.fillRect(x - 2, baseY - 18, 53, 2)
}

function paintReeds(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  time: number,
  variant: number,
): void {
  if (!inView(x)) return
  const count = 5 + (variant % 4)
  for (let i = 0; i < count; i += 1) {
    const bx = x + Math.floor(hash(variant * 3.1 + i) * 18)
    const height = 8 + Math.floor(hash(variant * 1.7 + i * 4.3) * 14)
    const sway = Math.sin(time * 1.2 + variant + i) * 1.4
    ctx.fillStyle = i % 3 === 0 ? '#3f7a5c' : '#5aa377'
    ctx.fillRect(Math.round(bx + sway * 0.4), baseY - height, 1, height)
    if (i % 4 === 0) {
      ctx.fillStyle = '#8a6a3e'
      ctx.fillRect(Math.round(bx + sway), baseY - height - 3, 2, 4)
      ctx.fillStyle = '#b08c55'
      ctx.fillRect(Math.round(bx + sway), baseY - height - 3, 1, 1)
    }
  }
  ctx.fillStyle = '#2e5a43'
  ctx.fillRect(x - 1, baseY - 1, 22, 2)
}

function paintRock(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  variant: number,
): void {
  if (!inView(x)) return
  const w = 12 + (variant % 4) * 4
  const h = 6 + (variant % 3) * 3
  ctx.fillStyle = '#3f4a43'
  ctx.beginPath()
  ctx.moveTo(x, baseY)
  ctx.lineTo(x + 2, baseY - h)
  ctx.lineTo(x + w - 3, baseY - h - 2)
  ctx.lineTo(x + w, baseY)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#59665a'
  ctx.fillRect(x + 3, baseY - h, Math.max(2, w - 7), 1)
  ctx.fillStyle = '#527a62'
  ctx.fillRect(x + 2, baseY - h + 1, 3, 1)
  ctx.fillRect(x + w - 6, baseY - h, 2, 1)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.fillRect(x + 1, baseY - 2, w - 2, 2)
}

function paintCanoe(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  time: number,
): void {
  if (!inView(x)) return
  const bob = Math.sin(time * 1.3) * 1
  const y = baseY - 8 + bob
  ctx.fillStyle = '#2b2118'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(x + 24, y + 12, x + 48, y)
  ctx.lineTo(x + 44, y - 4)
  ctx.quadraticCurveTo(x + 24, y + 4, x + 4, y - 4)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#7b6040'
  ctx.fillRect(x + 7, y - 5, 34, 2)
  ctx.fillStyle = '#4b3b2a'
  ctx.fillRect(x + 20, y - 5, 2, 10)
  ctx.fillStyle = '#d9c7a0'
  ctx.fillRect(x + 12, y - 7, 2, 2)
  ctx.fillRect(x + 16, y - 8, 2, 2)
  const glow = 0.55 + Math.sin(time * 2.6) * 0.2
  ctx.globalAlpha = glow
  ctx.fillStyle = '#ffd166'
  ctx.fillRect(x + 34, y - 11, 3, 4)
  ctx.globalAlpha = 1
  ctx.fillStyle = '#ffedb0'
  ctx.fillRect(x + 35, y - 10, 1, 2)
}

function paintStoneArch(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  time: number,
  variant: number,
): void {
  if (!inView(x)) return
  const width = 54
  const height = 40 + (variant % 2) * 8
  ctx.fillStyle = '#39443f'
  ctx.fillRect(x, baseY - height, 9, height)
  ctx.fillRect(x + width - 9, baseY - height, 9, height)
  ctx.fillStyle = '#4e5a52'
  ctx.fillRect(x + 1, baseY - height + 2, 2, height - 3)
  ctx.fillRect(x + width - 8, baseY - height + 2, 2, height - 3)
  ctx.fillStyle = '#2c3531'
  ctx.fillRect(x - 5, baseY - height - 7, width + 10, 9)
  ctx.fillStyle = '#43504a'
  ctx.fillRect(x - 3, baseY - height - 6, width + 6, 2)
  ctx.fillStyle = '#527a62'
  ctx.fillRect(x + 2, baseY - height + 8, 5, 2)
  ctx.fillRect(x + width - 11, baseY - height + 18, 6, 2)
  ctx.fillRect(x - 2, baseY - height - 5, 8, 2)

  const pulse = 0.45 + Math.sin(time * 1.7 + variant) * 0.25
  ctx.globalAlpha = pulse
  ctx.fillStyle = '#c9b6ff'
  ctx.fillRect(x + 3, baseY - height + 22, 2, 4)
  ctx.fillRect(x + width - 7, baseY - height + 12, 2, 4)
  ctx.fillRect(x + width / 2 - 2, baseY - height - 6, 3, 2)
  ctx.globalAlpha = 1
}

function paintRuneStone(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  time: number,
  variant: number,
): void {
  if (!inView(x)) return
  ctx.fillStyle = '#2c3531'
  ctx.fillRect(x, baseY - 22, 10, 22)
  ctx.fillStyle = '#3f4a43'
  ctx.fillRect(x + 1, baseY - 21, 3, 20)
  ctx.fillStyle = '#527a62'
  ctx.fillRect(x + 1, baseY - 20, 2, 2)
  const pulse = 0.45 + Math.sin(time * 2 + variant) * 0.28
  ctx.globalAlpha = pulse
  ctx.fillStyle = '#c9b6ff'
  ctx.fillRect(x + 4, baseY - 17, 3, 1)
  ctx.fillRect(x + 5, baseY - 16, 1, 4)
  ctx.fillRect(x + 3, baseY - 11, 5, 1)
  ctx.globalAlpha = 1
}

function paintSpirit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  variant: number,
): void {
  if (!inView(x)) return
  const bob = Math.sin(time * 1.4 + variant) * 5
  const pulse = 0.4 + Math.sin(time * 2.2 + variant) * 0.3
  ctx.globalAlpha = pulse * 0.24
  ctx.fillStyle = '#c9b6ff'
  ctx.fillRect(x - 4, y + bob - 4, 8, 8)
  ctx.globalAlpha = pulse
  ctx.fillStyle = '#e8e0ff'
  ctx.fillRect(x, y + bob, 2, 2)
  ctx.globalAlpha = 1
}

function paintProps(
  ctx: CanvasRenderingContext2D,
  theme: LevelTheme,
  cameraX: number,
  cameraY: number,
  time: number,
): void {
  const baseY = 9 * TILE - cameraY

  if (theme === 'village') {
    paintHut(ctx, -18 - cameraX, baseY, time, 0)
    paintCampfire(ctx, 116 - cameraX, baseY, time)
  } else if (theme === 'river') {
    const reeds = [26, 138, 214, 306, 430, 516, 640, 728, 842, 946, 1080, 1196, 1308, 1424, 1536, 1662, 1774, 1886]
    reeds.forEach((x, index) => paintReeds(ctx, x - cameraX, baseY, time, index + 1))
    const rocks = [96, 250, 382, 566, 690, 804, 1010, 1140, 1268, 1402, 1524, 1668, 1790, 1904]
    rocks.forEach((x, index) => paintRock(ctx, x - cameraX, baseY, index + 2))
    paintCanoe(ctx, 330 - cameraX, baseY, time)
    paintCanoe(ctx, 922 - cameraX, baseY, time)
    paintCanoe(ctx, 1348 - cameraX, baseY, time)
    paintCanoe(ctx, 1812 - cameraX, baseY, time)
  } else if (theme === 'camp') {
    paintTent(ctx, 54 - cameraX, baseY, time, 1)
    paintTent(ctx, 526 - cameraX, baseY, time, 3)
    paintTent(ctx, 972 - cameraX, baseY, time, 5)
    paintTent(ctx, 1240 - cameraX, baseY, time, 2)
    paintTent(ctx, 1680 - cameraX, baseY, time, 4)
    paintWatchtower(ctx, 214 - cameraX, baseY, time)
    paintWatchtower(ctx, 884 - cameraX, baseY, time)
    paintWatchtower(ctx, 1460 - cameraX, baseY, time)
    paintPalisade(ctx, 120 - cameraX, baseY, 1)
    paintPalisade(ctx, 620 - cameraX, baseY, 2)
    paintPalisade(ctx, 820 - cameraX, baseY, 3)
    paintPalisade(ctx, 1160 - cameraX, baseY, 1)
    paintPalisade(ctx, 1820 - cameraX, baseY, 2)
    paintCampfire(ctx, 168 - cameraX, baseY, time)
    paintCampfire(ctx, 690 - cameraX, baseY, time)
    paintCampfire(ctx, 1382 - cameraX, baseY, time)
    paintCampfire(ctx, 1960 - cameraX, baseY, time)
  } else {
    // Bosque e noite compartilham os mesmos marcos de pedra.
    paintStoneArch(ctx, 150 - cameraX, baseY, time, 1)
    paintStoneArch(ctx, 552 - cameraX, baseY, time, 2)
    paintStoneArch(ctx, 916 - cameraX, baseY, time, 3)
    paintStoneArch(ctx, 1268 - cameraX, baseY, time, 1)
    paintStoneArch(ctx, 1724 - cameraX, baseY, time, 2)
    paintStoneArch(ctx, 2104 - cameraX, baseY, time, 3)
    paintRuneStone(ctx, 326 - cameraX, baseY, time, 1)
    paintRuneStone(ctx, 704 - cameraX, baseY, time, 2)
    paintRuneStone(ctx, 1032 - cameraX, baseY, time, 3)
    paintRuneStone(ctx, 1466 - cameraX, baseY, time, 1)
    paintRuneStone(ctx, 1888 - cameraX, baseY, time, 2)
    paintRock(ctx, 90 - cameraX, baseY, 4)
    paintRock(ctx, 468 - cameraX, baseY, 5)
    paintRock(ctx, 840 - cameraX, baseY, 6)
    paintRock(ctx, 1180 - cameraX, baseY, 4)
    paintRock(ctx, 1620 - cameraX, baseY, 5)
    paintRock(ctx, 2020 - cameraX, baseY, 6)
    paintSpirit(ctx, 240 - cameraX, baseY - 52, time, 1)
    paintSpirit(ctx, 608 - cameraX, baseY - 40, time, 2)
    paintSpirit(ctx, 986 - cameraX, baseY - 58, time, 3)
    paintSpirit(ctx, 1342 - cameraX, baseY - 46, time, 1)
    paintSpirit(ctx, 1790 - cameraX, baseY - 54, time, 2)
  }

  // cipÃƒÂ³s pendurados na copa
  const vines = theme === 'camp' ? [92, 386, 674, 1012] : [64, 236, 392, 476, 660, 886, 1080]
  for (const vineX of vines) {
    const x = vineX - cameraX
    if (!inView(x)) continue
    const length = 22 + Math.floor(hash(vineX) * 38)
    ctx.fillStyle = theme === 'camp' ? '#3b3324' : '#27432a'
    for (let y = 0; y < length; y += 1) {
      const sway = Math.sin(time * 0.55 + y * 0.12 + vineX) * 1.4
      ctx.fillRect(Math.round(x + sway), y, 1, 1)
    }
    for (let i = 0; i < 3; i += 1) {
      const ly = 8 + i * 11
      const sway = Math.sin(time * 0.55 + ly * 0.12 + vineX) * 1.4
      ctx.fillStyle = i % 2 === 0 ? '#3f663c' : '#315233'
      ctx.fillRect(Math.round(x + sway) - 1, ly, 3, 1)
      ctx.fillRect(Math.round(x + sway) + 1, ly + 1, 1, 2)
    }
  }
}

// ---------- ÃƒÂ¡gua e chÃƒÂ£o ----------

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

function paintForeground(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  cameraX: number,
  cameraY: number,
  palette: Palette,
): void {
  const x0 = Math.floor(cameraX / TILE) - 1
  const x1 = Math.ceil((cameraX + VIEW_W) / TILE) + 1

  for (let tx = x0; tx <= x1; tx += 1) {
    const topRow = topSolidRow(map, tx)
    if (topRow < 0) continue
    if (map.tileAt(tx, topRow - 1) !== Tile.Empty) continue
    const inWater =
      map.tileAt(tx - 1, topRow) === Tile.Water || map.tileAt(tx + 1, topRow) === Tile.Water
    if (inWater) continue

    const baseX = tx * TILE - cameraX
    const groundY = topRow * TILE - cameraY
    const roll = hash(tx * 9.7)

    for (let i = 0; i < 3; i += 1) {
      const bx = baseX + Math.floor(hash(tx * 3.1 + i) * 14)
      const bh = 2 + Math.floor(hash(tx * 1.7 + i * 4.3) * 4)
      ctx.fillStyle = i % 2 === 0 ? palette.grassLight : palette.grassB
      ctx.fillRect(bx, groundY - bh, 1, bh)
      ctx.fillRect(bx + 1, groundY - Math.max(1, bh - 1), 1, Math.max(1, bh - 1))
    }

    if (roll > 0.82) {
      const fx = baseX + 4 + Math.floor(hash(tx * 2.9) * 8)
      ctx.fillStyle = palette.grassDark
      ctx.fillRect(fx, groundY - 5, 1, 5)
      ctx.fillStyle = roll > 0.92 ? '#f4e3a1' : '#d98a9a'
      ctx.fillRect(fx - 1, groundY - 7, 3, 2)
      ctx.fillStyle = '#fff6d0'
      ctx.fillRect(fx, groundY - 7, 1, 1)
    } else if (roll < 0.13) {
      const rx = baseX + 3 + Math.floor(hash(tx * 6.1) * 9)
      ctx.fillStyle = '#606b5c'
      ctx.fillRect(rx, groundY - 3, 4, 3)
      ctx.fillStyle = '#7d8975'
      ctx.fillRect(rx + 1, groundY - 3, 2, 1)
    } else if (roll > 0.34 && roll < 0.42) {
      const mx = baseX + 5 + Math.floor(hash(tx * 4.7) * 7)
      ctx.fillStyle = '#d8c9a2'
      ctx.fillRect(mx, groundY - 3, 1, 3)
      ctx.fillStyle = '#b6483d'
      ctx.fillRect(mx - 1, groundY - 5, 3, 2)
      ctx.fillStyle = '#ffe9c2'
      ctx.fillRect(mx, groundY - 5, 1, 1)
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
