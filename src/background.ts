import { VIEW_H, VIEW_W } from './engine'
import { publicAssetUrl } from './sprites'

// Fundo: arte enviada pelo jogador + vagalumes. A imagem é desenhada com um
// offset que alinha a grama da arte ao topo do chão do jogo (y = 9 * TILE).
const sources = {
  'forest-kenney': publicAssetUrl('assets/background/forest-kenney.png'),
  'forest-day': publicAssetUrl('assets/background/forest-day.png'),
  'forest-night': publicAssetUrl('assets/background/forest-night.png'),
  'forest-cave': publicAssetUrl('assets/background/forest-cave.png'),
}

const images = {
  'forest-kenney': buildImage(sources['forest-kenney']),
  'forest-day': buildImage(sources['forest-day']),
  'forest-night': buildImage(sources['forest-night']),
  'forest-cave': buildImage(sources['forest-cave']),
}

function buildImage(source: string): { image: HTMLImageElement; ready: boolean } {
  const image = new Image()
  const entry = { image, ready: false }
  image.addEventListener('load', () => { entry.ready = true })
  image.src = source
  void image.decode().catch(() => { entry.ready = false })
  return entry
}

// Vagalumes: pontos de luz que piscam devagar sobre a floresta.
const FIREFLIES = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 73 + 19) % VIEW_W,
  y: 24 + ((i * 47) % 104),
  phase: i * 1.17,
}))

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  time: number,
  scene: 'forest-kenney' | 'forest-day' | 'forest-night' | 'forest-cave' = 'forest-kenney',
  _night = false,
): void {
  // Base escura cobre qualquer borda.
  ctx.fillStyle = _night ? '#0a1024' : '#13241a'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  const entry = images[scene] ?? images['forest-kenney']
  if (entry.ready) {
    const image = entry.image
    const w = image.naturalWidth
    const h = image.naturalHeight
    // Imagem 320x180 exata: desenha FIXA (sem parallax vertical) para a
    // vegetação do fundo continuar alinhada ao chão quando Sand pula.
    ctx.drawImage(image, 0, 0, w, h)
  }

  // Vagalumes com brilho suave.
  for (const fly of FIREFLIES) {
    const x = (fly.x - cameraX * 0.12 + VIEW_W) % VIEW_W
    const y = fly.y + Math.sin(time * 0.8 + fly.phase) * 6
    const glow = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 2 + fly.phase))
    ctx.globalAlpha = glow * 0.28
    ctx.fillStyle = '#ffe9a8'
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4)
    ctx.globalAlpha = glow
    ctx.fillStyle = '#fff6d0'
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
  }
  ctx.globalAlpha = 1

  // Vinheta leve dá profundidade sem sujar a arte.
  const v = ctx.createRadialGradient(VIEW_W/2, VIEW_H/2, VIEW_H*0.4, VIEW_W/2, VIEW_H/2, VIEW_H*0.95)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, _night ? 'rgba(0,0,20,0.16)' : 'rgba(10,5,0,0.12)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  void VIEW_H
}
