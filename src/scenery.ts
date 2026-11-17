// Chão que conecta com a grama da arte de fundo. Estilo pixel art limpo,
// com terra em camadas, grama em tufos e raízes — sem elementos extras.
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
    grassA: '#4f7a45', grassB: '#6aa35c', grassLight: '#9ad47f', grassDark: '#385330',
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

  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (map.tileAt(tx, ty) !== Tile.Solid) continue
      const dx = tx * TILE - cameraX
      const dy = ty * TILE - cameraY
      const isTop = map.tileAt(tx, ty - 1) !== Tile.Solid
      const noise = Math.floor(hash(tx * 0.73 + ty * 3.17) * 100)

      // Terra com profundidade.
      ctx.fillStyle = noise % 2 === 0 ? p.soilA : p.soilB
      ctx.fillRect(dx, dy, TILE, TILE)
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      ctx.fillRect(dx, dy + TILE / 2, TILE, TILE / 2)

      if (noise % 5 === 0) {
        ctx.fillStyle = 'rgba(18,26,16,0.3)'
        ctx.fillRect(dx + 3, dy + 9, 4, 2)
      }
      if (noise % 7 === 0) {
        ctx.fillStyle = 'rgba(122,103,72,0.32)'
        ctx.fillRect(dx + 11, dy + 6, 2, 2)
      }
      if (map.tileAt(tx - 1, ty) !== Tile.Solid) {
        ctx.fillStyle = p.soilEdge
        ctx.fillRect(dx, dy, 2, TILE)
      }
      if (map.tileAt(tx + 1, ty) !== Tile.Solid) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)'
        ctx.fillRect(dx + TILE - 1, dy, 1, TILE)
      }

      // Grama no topo: faixa contínua + lâminas que balançam.
      if (isTop) {
        ctx.fillStyle = p.grassDark
        ctx.fillRect(dx, dy, TILE, 6)
        ctx.fillStyle = p.grassA
        ctx.fillRect(dx, dy, TILE, 4)
        ctx.fillStyle = p.grassB
        ctx.fillRect(dx, dy + 1, TILE, 2)
        for (let i = 0; i < 5; i += 1) {
          const gx = dx + 1 + ((noise + i * 3) % (TILE - 2))
          const gh = 2 + Math.floor(hash(tx * 3 + i * 5) * 4)
          const sway = Math.sin(time * 1.4 + tx * 0.6 + i) * 0.7
          ctx.fillStyle = i % 2 === 0 ? p.grassLight : p.grassB
          ctx.fillRect(Math.round(gx + sway), dy - gh, 1, gh + 1)
        }
      }
    }
  }
}
