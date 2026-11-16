import { VIEW_H, VIEW_W } from './engine'
import { publicAssetUrl } from './sprites'

// Fundo: apenas a arte que o jogador mandou desenhar. Sem duplicatas,
// nuvens, folhas, neblina ou qualquer cenário criado no código.
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

// Escala a arte para cobrir a tela inteira (mode "cover") e leva um pequeno
// deslocamento proporcional ao movimento do player para o parallax.
function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, cameraX: number, night: boolean): void {
  void night
  const w = image.naturalWidth || VIEW_W
  const h = image.naturalHeight || VIEW_H
  const scale = Math.max(VIEW_W / w, VIEW_H / h)
  const drawW = w * scale
  const drawH = h * scale
  const ox = Math.max(0, Math.min(drawW - VIEW_W, cameraX * 0.05))

  ctx.drawImage(image, ox, 0, drawW, drawH)
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  time: number,
  night = false,
): void {
  void cameraX
  void cameraY
  void time
  const entry = night ? images.night : images.day
  const image = entry.image
  const ready = entry.ready
  paintFallback(ctx)

  if (!ready) return

  drawCover(ctx, image, cameraX, night)

  const grade = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  if (night) {
    grade.addColorStop(0, 'rgba(6, 10, 30, 0.42)')
    grade.addColorStop(0.45, 'rgba(10, 16, 38, 0.2)')
    grade.addColorStop(0.8, 'rgba(12, 20, 34, 0.08)')
    grade.addColorStop(1, 'rgba(4, 8, 20, 0.46)')
  } else {
    grade.addColorStop(0, 'rgba(4, 11, 18, 0.36)')
    grade.addColorStop(0.42, 'rgba(5, 17, 20, 0.18)')
    grade.addColorStop(0.78, 'rgba(8, 24, 19, 0.05)')
    grade.addColorStop(1, 'rgba(3, 10, 10, 0.4)')
  }
  ctx.fillStyle = grade
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
}
