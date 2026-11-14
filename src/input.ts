const BLOCKED = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])

export class Input {
  private readonly down = new Set<string>()
  private readonly once = new Set<string>()

  constructor(target: Window = window) {
    target.addEventListener('keydown', (event) => {
      if (BLOCKED.has(event.code)) event.preventDefault()
      if (!this.down.has(event.code)) this.once.add(event.code)
      this.down.add(event.code)
    })

    target.addEventListener('keyup', (event) => {
      this.down.delete(event.code)
    })

    target.addEventListener('blur', () => {
      this.down.clear()
      this.once.clear()
    })
  }

  isDown(...codes: string[]): boolean {
    return codes.some((code) => this.down.has(code))
  }

  pressed(...codes: string[]): boolean {
    return codes.some((code) => this.once.has(code))
  }

  endFrame(): void {
    this.once.clear()
  }

  clear(): void {
    this.down.clear()
    this.once.clear()
  }

  get left(): boolean {
    return this.isDown('ArrowLeft', 'KeyA')
  }

  get right(): boolean {
    return this.isDown('ArrowRight', 'KeyD')
  }

  get jumpHeld(): boolean {
    return this.isDown('Space', 'ArrowUp', 'KeyW')
  }

  get jumpPressed(): boolean {
    return this.pressed('Space', 'ArrowUp', 'KeyW')
  }

  get attackPressed(): boolean {
    return this.pressed('KeyJ', 'KeyZ')
  }

  get dashPressed(): boolean {
    return this.pressed('ShiftLeft', 'ShiftRight', 'KeyK')
  }

  get throwPressed(): boolean {
    return this.pressed('KeyL', 'KeyX')
  }

  get parryPressed(): boolean {
    return this.pressed('KeyF')
  }

  get pausePressed(): boolean {
    return this.pressed('Escape')
  }

  get restartPressed(): boolean {
    return this.pressed('KeyR')
  }
}
