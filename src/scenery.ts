// Cenário: chão detalhado, desenhado para combinar com a arte da floresta.
// Camadas de terra, grama em tufos, raízes e transição suave no topo.
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
}

const PALETTES: Record<LevelTheme, Palette> = {
  village: {
    soilA: '#2c3b27', soilB: '#32442c', soilEdge: '#151e14',
    grassA: '#4f7a45', grassB: '#6aa35c', grassLight: '#9ad47f', grassDark: '#3a5732',
  },
  river: {
    soilA: '#273a33', soilB: '#2d443a', soilEdge: '#122019',
    grassA: '#3f7a5c', grassB: '#5aa377', grassLight: '#9ad9ac', grassDark: '#2e5a43',
  },
  camp: {
    soilA: '#3a3026', soilB: '#44382b', soilEdge: '#1e1812',
    grassA: '#6a5a3c', grassB: '#857348', grassLight: '#c2a870', grassDark: '#4a3d2a',
  },
  grove: {
    soilA: '#252f35', soilB: '#2c3840', soilEdge: '#11191c',
    grassA: '#3e6151', grassB: '#527a62', grassLight: '#8fb894', grassDark: '#2b4238',
  },
  night: {
    soilA: '#1d2634', soilB: '#232e3d', soilEdge: '#0c121b',
    grassA: '#2f4a53', grassB: '#3e6069', grassLight: '#6f9aa6', grassDark: '#1f3038',
  },
}

function hash(value: number): number {
  const x = Math.sin(value * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function drawScenery(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  cameraX: number,
  cameraY: number,
  _goalX: number,
  _goalBaseY: number,
  time: number,
  theme: LevelTheme,
  _goalLocked: boolean,
): void {
  const p = PALETTES[theme]
  const x0 = Math.floor(cameraX / TILE)
  const x1 = Math.ceil((cameraX + VIEW_W) / TILE)
  const y0 = Math.floor(cameraY / TILE)
  const y1 = Math.ceil((cameraY + VIEW_H) / TILE)

  // 1) Corpo de terra com textura e volume.
  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (map.tileAt(tx, ty) !== Tile.Solid) continue
      const dx = tx * TILE - cameraX
      const dy = ty * TILE - cameraY
      const noise = Math.floor(hash(tx * 0.73 + ty * 3.17) * 100)

      ctx.fillStyle = noise % 2 === 0 ? p.soilA : p.soilB
      ctx.fillRect(dx, dy, TILE, TILE)

      // Terra mais escura na metade inferior (profundidade).
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
      ctx.fillRect(dx, dy + TILE / 2, TILE, TILE / 2)

      // Grãos de solo e raízes.
      if (noise % 5 === 0) {
        ctx.fillStyle = 'rgba(18, 26, 16, 0.35)'
        ctx.fillRect(dx + 3, dy + 8, 4, 2)
        ctx.fillRect(dx + 10, dy + 12, 2, 1)
      }
      if (noise % 7 === 0) {
        ctx.fillStyle = 'rgba(122, 103, 72, 0.4)'
        ctx.fillRect(dx + 11, dy + 5, 2, 2)
      }
      if (noise % 6 === 1) {
        ctx.fillStyle = 'rgba(104, 112, 92, 0.35)'
        ctx.fillRect(dx + 4, dy + 10, 2, 2)
      }

      // Bordas laterais dão volume ao bloco.
      if (map.tileAt(tx - 1, ty) !== Tile.Solid) {
        ctx.fillStyle = p.soilEdge
        ctx.fillRect(dx, dy, 2, TILE)
      }
      if (map.tileAt(tx + 1, ty) !== Tile.Solid) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
        ctx.fillRect(dx + TILE - 1, dy, 1, TILE)
      }
    }
  }

  // 2) Grama no topo, desenhada por cima da terra (faixa contínua + tufos).
  for (let tx = x0; tx <= x1; tx += 1) {
    let topY = -1
    for (let ty = y0; ty <= y1; ty += 1) {
      if (map.tileAt(tx, ty) === Tile.Solid) { topY = ty; break }
    }
    if (topY < 0) continue
    const dx = tx * TILE - cameraX
    const dy = topY * TILE - cameraY

    // Faixa base de grama.
    ctx.fillStyle = p.grassDark
    ctx.fillRect(dx, dy, TILE, 5)
    ctx.fillStyle = p.grassA
    ctx.fillRect(dx, dy, TILE, 3)
    ctx.fillStyle = p.grassB
    ctx.fillRect(dx, dy + 1, TILE, 1)

    // Tufos: lâminas finas que crescem acima da faixa.
    const n = hash(tx * 1.7) 
    for (let i = 0; i < 4; i += 1) {
      const gx = dx + 1 + ((Math.floor(n * 97) + i * 4) % (TILE - 2))
      const gh = 2 + Math.floor(hash(tx * 3 + i * 7) * 4)
      const sway = Math.sin(time * 1.2 + tx * 0.5 + i) * 0.6
      ctx.fillStyle = i % 2 === 0 ? p.grassLight : p.grassB
      ctx.fillRect(Math.round(gx + sway), dy - gh, 1, gh + 1)
      if (i === 1 || i === 3) {
        ctx.fillStyle = p.grassLight
        ctx.fillRect(Math.round(gx + sway), dy - gh - 1, 1, 1)
      }
    }
  }
}
