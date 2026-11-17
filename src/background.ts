import { VIEW_H, VIEW_W } from './engine'
import { publicAssetUrl } from './sprites'

// Fundo: arte enviada pelo jogador + vagalumes. A imagem é desenhada com um
// offset que alinha a grama da arte ao topo do chão do jogo (y = 9 * TILE).
const sources = {
  day: publicAssetUrl('assets/background/forest.png'),
  night: publicAssetUrl('assets/background/night.jpg'),
}

const images = {
  day: buildImage(sources.day),
  night: buildImage(sources.night),
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
  cameraY: number,
  time: number,
  night = false,
): void {
  // Base escura cobre qualquer borda.
  ctx.fillStyle = night ? '#0a1024' : '#13241a'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  const entry = night ? images.night : images.day
  if (entry.ready) {
    const image = entry.image
    const w = image.naturalWidth
    const h = image.naturalHeight
    // Offset -6 alinha a grama da arte (y≈150) ao chão do jogo (y=144).
    // Parallax vertical mínimo para não criar vãos.
    const y = Math.round(-6 - cameraY * 0.08)
    ctx.drawImage(image, 0, y, w, h)
    // Se a imagem for mais estreita que a tela, repete espelhada.
    if (w < VIEW_W) {
      ctx.save()
      ctx.translate(w, y)
      ctx.scale(-1, 1)
      ctx.drawImage(image, 0, 0, w, h)
      ctx.restore()
    }
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
  const v = ctx.createRadialGradient(VIEW_W/2, VIEW_H/2, VIEW_H*0.3, VIEW_W/2, VIEW_H/2, VIEW_H*0.85)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, night ? 'rgba(0,0,20,0.28)' : 'rgba(0,10,5,0.22)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  void VIEW_H
}
