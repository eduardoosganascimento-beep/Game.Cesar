// Cenário: apenas o chão, desenhado para combinar com a arte de fundo da
// floresta. Copas, cabanas, fogueiras, pedras e plataformas foram removidos.
import { TILE, VIEW_H, VIEW_W } from './engine'
import { Tile, type LevelTheme, type TileMap } from './level'

type Palette = {
  soilA: string
  soilB: string
  soilEdge: string
  grassA: string
  grassB: string
  grassLight: string
}

const PALETTES: Record<LevelTheme, Palette> = {
  village: {
    soilA: '#2c3b27', soilB: '#32442c', soilEdge: '#151e14',
    grassA: '#4f7a45', grassB: '#6aa35c', grassLight: '#8cc46f',
  },
  river: {
    soilA: '#273a33', soilB: '#2d443a', soilEdge: '#122019',
    grassA: '#3f7a5c', grassB: '#5aa377', grassLight: '#83c99b',
  },
  camp: {
    soilA: '#3a3026', soilB: '#44382b', soilEdge: '#1e1812',
    grassA: '#6a5a3c', grassB: '#857348', grassLight: '#a8915e',
  },
  grove: {
    soilA: '#252f35', soilB: '#2c3840', soilEdge: '#11191c',
    grassA: '#3e6151', grassB: '#527a62', grassLight: '#79a37e',
  },
  night: {
    soilA: '#1d2634', soilB: '#232e3d', soilEdge: '#0c121b',
    grassA: '#2f4a53', grassB: '#3e6069', grassLight: '#5b8590',
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
  _time: number,
  theme: LevelTheme,
  _goalLocked: boolean,
): void {
  const palette = PALETTES[theme]
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

      // Corpo de terra.
      ctx.fillStyle = noise % 2 === 0 ? palette.soilA : palette.soilB
      ctx.fillRect(dx, dy, TILE, TILE)

      // Textura sutil de terra.
      if (noise % 5 === 0) {
        ctx.fillStyle = 'rgba(18, 26, 16, 0.3)'
        ctx.fillRect(dx + 3, dy + 8, 4, 2)
      }
      if (noise % 7 === 0) {
        ctx.fillStyle = 'rgba(122, 103, 72, 0.3)'
        ctx.fillRect(dx + 10, dy + 5, 2, 2)
      }

      // Bordas laterais mais escuras dão volume ao bloco.
      if (map.tileAt(tx - 1, ty) !== Tile.Solid) {
        ctx.fillStyle = palette.soilEdge
        ctx.fillRect(dx, dy, 2, TILE)
      }
      if (map.tileAt(tx + 1, ty) !== Tile.Solid) {
        ctx.fillStyle = 'rgba(12, 18, 11, 0.45)'
        ctx.fillRect(dx + TILE - 1, dy, 1, TILE)
      }

      // Grama no topo: faixa verde que liga o chão à imagem da floresta.
      if (isTop) {
        ctx.fillStyle = palette.grassA
        ctx.fillRect(dx, dy, TILE, 4)
        ctx.fillStyle = palette.grassB
        ctx.fillRect(dx, dy + 1, TILE, 2)
        // Pontinhos de grama clara e algumas folhas pendentes.
        for (let i = 0; i < 4; i += 1) {
          const gx = dx + 2 + ((noise + i * 5) % 12)
          const gh = 2 + ((noise + i) % 3)
          ctx.fillStyle = i % 2 === 0 ? palette.grassLight : palette.grassA
          ctx.fillRect(gx, dy - gh, 1, gh + 1)
        }
      }
    }
  }
}
