import { VIEW_H, VIEW_W } from './engine'
import { publicAssetUrl } from './sprites'

// Fundo: só a arte enviada pelo jogador + vagalumes. Sem folhas, raios ou
// névoa criados pelo código.
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
  image.addEventListener('load', () => {
    entry.ready = true
  })
  image.src = source
  void image.decode().catch(() => {
    entry.ready = false
  })
  return entry
}

function paintFallback(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  gradient.addColorStop(0, '#08131b')
  gradient.addColorStop(0.55, '#132820')
  gradient.addColorStop(1, '#0b1a15')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
}

// Vagalumes: pontos de luz que continuam no céu.
const FIREFLIES = Array.from({ length: 24 }, (_, i) => ({
  x: (i * 67 + 23) % VIEW_W,
  y: 30 + ((i * 41) % 100),
  phase: i * 1.13,
}))

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  time: number,
  night = false,
): void {
  const entry = night ? images.night : images.day
  paintFallback(ctx)
  if (!entry.ready) return
  const image = entry.image
  ctx.drawImage(image, 0, Math.round(-18 - cameraY * 0.15), image.naturalWidth, image.naturalHeight)

  // Vagalumes piscando devagar.
  for (const fly of FIREFLIES) {
    const x = (fly.x - cameraX * 0.12 + VIEW_W) % VIEW_W
    const y = fly.y + Math.sin(time * 0.8 + fly.phase) * 6
    const glow = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 2 + fly.phase))
    ctx.globalAlpha = glow * 0.25
    ctx.fillStyle = '#ffe9a8'
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4)
    ctx.globalAlpha = glow
    ctx.fillStyle = '#fff6d0'
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
  }
  ctx.globalAlpha = 1
}
