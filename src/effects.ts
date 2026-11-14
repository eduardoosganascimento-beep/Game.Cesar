import type { Rect } from './engine'

export type BurstKind =
  | 'dust'
  | 'spark'
  | 'leaf'
  | 'splash'
  | 'hit'
  | 'death'
  | 'blade'
  | 'bullet'
  | 'spear'
  | 'ooze'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  gravity: number
  drift: number
}

type FloatingText = {
  x: number
  y: number
  text: string
  color: string
  life: number
  max: number
}

const PALETTES: Record<BurstKind, string[]> = {
  dust: ['#c9b38a', '#a8916a', '#e0cfa8', '#8d7a59'],
  spark: ['#ffd166', '#fff3c4', '#ff9f43', '#ffe9a8'],
  leaf: ['#7fb069', '#4f7a45', '#a8c686', '#638f55'],
  splash: ['#8fd4e2', '#c8f0f6', '#3d7f92', '#6bb5c6'],
  hit: ['#ff8b73', '#ffd7c2', '#d9534f', '#fff1dd'],
  death: ['#d7a05a', '#a4402f', '#4f3b2a', '#ffd166'],
  // Cada arma deixa um rastro de pixels próprio.
  blade: ['#fff1dd', '#ffd7c2', '#e35d4f', '#ff8b73'],
  bullet: ['#c4473a', '#ff9f43', '#7d2820', '#ffd166'],
  spear: ['#e8c48a', '#8a5a2a', '#ffd166', '#b97d24'],
  // Pingo doentio: o que escorre dos zumbis.
  ooze: ['#8ec96a', '#6fa04a', '#cbe58f', '#4f7a45'],
}

export class Effects {
  private particles: Particle[] = []
  private texts: FloatingText[] = []
  shake = 0

  burst(x: number, y: number, kind: BurstKind, count = 8, spread = 55): void {
    const palette = PALETTES[kind]
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * spread
      const life = 0.25 + Math.random() * (kind === 'spark' ? 0.55 : 0.4)
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (kind === 'dust' ? 10 : 28),
        life,
        max: life,
        size: kind === 'spark' ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3),
        color: palette[Math.floor(Math.random() * palette.length)],
        gravity: kind === 'splash' || kind === 'dust' ? 240 : 120,
        drift: (Math.random() - 0.5) * 14,
      })
    }
  }

  trail(x: number, y: number, kind: BurstKind = 'dust'): void {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: -8 - Math.random() * 18,
      vy: -4 - Math.random() * 10,
      life: 0.22,
      max: 0.22,
      size: 1 + Math.floor(Math.random() * 2),
      color: PALETTES[kind][Math.floor(Math.random() * PALETTES[kind].length)],
      gravity: -8,
      drift: 0,
    })
  }

  text(x: number, y: number, text: string, color = '#ffd166'): void {
    this.texts.push({ x, y, text, color, life: 0.9, max: 0.9 })
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount)
  }

  clear(): void {
    this.particles.length = 0
    this.texts.length = 0
    this.shake = 0
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 26)

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i]
      particle.life -= dt
      if (particle.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }
      particle.vy += particle.gravity * dt
      particle.x += (particle.vx + particle.drift) * dt
      particle.y += particle.vy * dt
    }

    for (let i = this.texts.length - 1; i >= 0; i -= 1) {
      const text = this.texts[i]
      text.life -= dt
      text.y -= 14 * dt
      if (text.life <= 0) this.texts.splice(i, 1)
    }
  }

  render(ctx: CanvasRenderingContext2D, camera: Rect): void {
    for (const particle of this.particles) {
      const alpha = Math.min(1, particle.life / particle.max)
      ctx.globalAlpha = alpha
      ctx.fillStyle = particle.color
      ctx.fillRect(
        Math.round(particle.x - camera.x),
        Math.round(particle.y - camera.y),
        particle.size,
        particle.size,
      )
    }

    ctx.textAlign = 'center'
    ctx.font = 'bold 7px "Courier New", monospace'
    for (const text of this.texts) {
      const alpha = Math.min(1, text.life / text.max)
      const x = Math.round(text.x - camera.x)
      const y = Math.round(text.y - camera.y)
      ctx.globalAlpha = alpha
      ctx.fillStyle = '#1a110a'
      ctx.fillText(text.text, x + 1, y + 1)
      ctx.fillStyle = text.color
      ctx.fillText(text.text, x, y)
    }
    ctx.textAlign = 'left'
    ctx.globalAlpha = 1
  }
}
