export const VIEW_W = 320
export const VIEW_H = 180
export const TILE = 16
export const GRAVITY = 900
export const MAX_FALL = 440

export type Rect = { x: number; y: number; w: number; h: number }

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export class Camera {
  x = 0
  y = 0

  snapTo(target: Rect, worldW: number, worldH: number): void {
    this.x = clamp(target.x + target.w / 2 - VIEW_W / 2, 0, Math.max(0, worldW - VIEW_W))
    this.y = clamp(target.y + target.h / 2 - VIEW_H / 2, 0, Math.max(0, worldH - VIEW_H))
  }

  follow(target: Rect, worldW: number, worldH: number, smooth = 0.12): void {
    const tx = clamp(target.x + target.w / 2 - VIEW_W / 2, 0, Math.max(0, worldW - VIEW_W))
    const ty = clamp(target.y + target.h / 2 - VIEW_H / 2, 0, Math.max(0, worldH - VIEW_H))
    this.x += (tx - this.x) * smooth
    this.y += (ty - this.y) * smooth
  }

  get px(): number {
    return Math.round(this.x)
  }

  get py(): number {
    return Math.round(this.y)
  }
}

export class Loop {
  private raf = 0
  private last = 0
  private acc = 0
  private readonly step = 1 / 60

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: () => void,
    private readonly maxSteps = 5,
  ) {}

  start(): void {
    this.last = performance.now()
    const frame = (now: number): void => {
      const delta = Math.min((now - this.last) / 1000, 0.25)
      this.last = now
      this.acc += delta

      let steps = 0
      while (this.acc >= this.step && steps < this.maxSteps) {
        this.update(this.step)
        this.acc -= this.step
        steps += 1
      }
      if (steps === this.maxSteps) this.acc = 0

      this.render()
      this.raf = requestAnimationFrame(frame)
    }
    this.raf = requestAnimationFrame(frame)
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
  }
}
