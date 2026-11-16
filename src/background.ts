import { VIEW_H, VIEW_W } from './engine'
import { publicAssetUrl } from './sprites'

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

const BACKGROUND_Y = -18
const GROUND_Y = 142

function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

const random = seeded(20261110)
const fireflies = Array.from({ length: 20 }, () => ({
  x: random() * 380,
  y: 48 + random() * 92,
  phase: random() * Math.PI * 2,
  speed: 0.45 + random() * 0.5,
  drift: 5 + random() * 9,
}))
const leaves = Array.from({ length: 14 }, () => ({
  x: random() * VIEW_W,
  y: random() * GROUND_Y,
  phase: random() * Math.PI * 2,
  speed: 0.25 + random() * 0.4,
}))

function paintFallback(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  gradient.addColorStop(0, '#08131b')
  gradient.addColorStop(0.55, '#132820')
  gradient.addColorStop(1, '#0b1a15')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  time: number,
  night = false,
): void {
  const entry = night ? images.night : images.day
  const image = entry.image
  const ready = entry.ready
  paintFallback(ctx)

  if (ready) {
    const w = image.naturalWidth
    const h = image.naturalHeight
    const parallax = cameraX * 0.16
    const period = w * 2
    const loops = Math.floor(parallax / period)
    const shift = parallax - loops * period
    const baseY = Math.round(BACKGROUND_Y - cameraY * 0.15)

    for (let n = -2; n <= 3; n += 1) {
      const index = loops * 2 + n
      const x = Math.round(n * w - shift)
      if ((index & 1) === 0) {
        ctx.drawImage(image, x, baseY, w, h)
      } else {
        ctx.save()
        ctx.translate(x + w, baseY)
        ctx.scale(-1, 1)
        ctx.drawImage(image, 0, 0, w, h)
        ctx.restore()
      }
    }

    // Graduação de cor: noite quente e úmida, mantendo as árvores legíveis.
    const grade = ctx.createLinearGradient(0, 0, 0, VIEW_H)
    if (night) {
      grade.addColorStop(0, 'rgba(6, 10, 30, 0.5)')
      grade.addColorStop(0.45, 'rgba(10, 16, 38, 0.22)')
      grade.addColorStop(0.8, 'rgba(12, 20, 34, 0.08)')
      grade.addColorStop(1, 'rgba(4, 8, 20, 0.5)')
    } else {
      grade.addColorStop(0, 'rgba(4, 11, 18, 0.58)')
      grade.addColorStop(0.42, 'rgba(5, 17, 20, 0.22)')
      grade.addColorStop(0.78, 'rgba(8, 24, 19, 0.04)')
      grade.addColorStop(1, 'rgba(3, 10, 10, 0.5)')
    }
    ctx.fillStyle = grade
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    // Névoa baixa entre as árvores.
    const fog = ctx.createLinearGradient(0, 84, 0, GROUND_Y)
    fog.addColorStop(0, 'rgba(98, 150, 132, 0)')
    fog.addColorStop(0.62, 'rgba(94, 148, 128, 0.1)')
    fog.addColorStop(1, 'rgba(122, 175, 142, 0.16)')
    ctx.fillStyle = fog
    ctx.fillRect(0, 84, VIEW_W, GROUND_Y - 84)
  }

  // Raios de luz atravessando a copa (só de dia).
  if (!night) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 3; i += 1) {
      const sway = Math.sin(time * 0.08 + i * 1.7) * 12
      const x = 34 + i * 108 + sway
      const beam = ctx.createLinearGradient(x, 0, x + 76, 150)
      beam.addColorStop(0, 'rgba(214, 241, 172, 0.09)')
      beam.addColorStop(1, 'rgba(214, 241, 172, 0)')
      ctx.fillStyle = beam
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + 20, 0)
      ctx.lineTo(x + 104, 148)
      ctx.lineTo(x + 58, 148)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  // Folhas flutuando devagar.
  for (const leaf of leaves) {
    const x = (leaf.x - time * 5 * leaf.speed + Math.sin(time * 0.7 + leaf.phase) * 10) % VIEW_W
    const y = leaf.y + Math.sin(time * leaf.speed + leaf.phase) * 7 + 4
    ctx.globalAlpha = 0.28
    ctx.fillStyle = '#a8c686'
    ctx.fillRect(Math.round((x + VIEW_W) % VIEW_W), Math.round(y), 1, 2)
  }
  ctx.globalAlpha = 1

  // Vagalumes.
  for (const fly of fireflies) {
    const x =
      (((fly.x - cameraX * 0.28 + Math.sin(time * 0.6 + fly.phase) * fly.drift) % 380) + 380) % 380
    const y = fly.y + Math.sin(time * fly.speed + fly.phase) * 6
    if (x > VIEW_W + 8) continue
    const glow = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * 2.2 + fly.phase))
    ctx.globalAlpha = glow * 0.2
    ctx.fillStyle = '#ffe9a8'
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4)
    ctx.globalAlpha = glow
    ctx.fillStyle = '#fff6d0'
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
  }
  ctx.globalAlpha = 1
}
