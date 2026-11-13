// Player physics with smooth running, jump, and death
// Física aprimorada: corrida fluida dentro e fora do mapa,
// pulo with cut, e controles responsivos.

import { GRAVITY, MAX_FALL, TILE, clamp, type Rect } from './engine'
import type { Input } from './input'
import type { TileMap } from './level'

export const MAX_HP = 3

// --- Tempos das animações (em segundos), baseados na folha de sprites:
// - golpe: 5 quadros a 18 fps (0,278 s);
// - arremesso: 4 quadros a 13 fps (0,308 s).
// - quadro 4 do arremesso é o primeiro sem a lança na mão, então é nele que
// o projétil nasce. Assim a animação e a mecânica contam a mesma história.
// - morte: 5 quadros a 7 fps (0,714 s).
export const ATTACK_TIME = 0.3
export const ATTACK_HIT_START = 0.07
export const ATTACK_HIT_END = 0.2
export const THROW_TIME = 0.34
export const THROW_RELEASE_AT = 3 / 13
export const THROW_COOLDOWN = 0.95
export const DEATH_TIME = 0.72
export const HURT_TIME = 0.34

// --- Parâmetros de movimento (ajustados para corrida fluida e sem bug)
// RUN_SPEED: velocidade máxima de corrida (px/segundo)
// ACCEL: aceleração ao apertar a direção
// FRICTION: desaceleração ao soltar a direção - valor maior = parada mais rápida, sensação de "piso"
// O FRICTION foi ajustado para o personagem parar mais curto, mas sem travão agressivo.
// DASH: movimento rápido por tempo limitado.
export const RUN_SPEED = 110   // antes 104 → levemente mais responsivo, mas dentro de limite seguro
export const ACCEL = 950       // antes 900 → aceleração um pouco mais rápida, mas controlada
export const FRICTION = 1250   // antes 1180 → parada mais curta, sensação de "piso", mas não agressiva
export const JUMP_SPEED = -310 // antes -305 → pulo um pouco mais alto, mas dentro do salto esperado
export const JUMP_CUT = -100   // antes -95 → corte de pulo um pouco mais forte
export const COYOTE_TIME = 0.12
export const BUFFER_TIME = 0.14
export const DASH_TIME = 0.16
export const DASH_SPEED = 300  // antes 280 → dash um pouco mais rápido, mas já estava no player original
export const DASH_COOLDOWN = 0.6

export class Player {
  x: number
  y: number
  w = 12
  h = 26
  vx = 0
  vy = 0
  hp = MAX_HP
  facing = 1
  onGround = false
  attack = 0
  throw = 0
  throwCooldown = 0
  hurt = 0
  invuln = 0
  dash = 0
  dashCooldown = 0
  justJumped = false
  justDashed = false
  justAttacked = false
  justThrew = false
  justLanded = false
  justSkidded = false
  landingSpeed = 0

  private coyote = 0
  private buffer = 0
  private airDashUsed = false
  private throwReleased = false
  private attackElapsed = 0
  private throwElapsed = 0
  private skidCooldown = 0
  private map: TileMap
  private spawnX: number
  private spawnY: number

  constructor(map: TileMap, spawn: { x: number; y: number }) {
    this.map = map
    this.spawnX = spawn.x * TILE
    this.spawnY = spawn.y * TILE + TILE - this.h
    this.x = this.spawnX
    this.y = this.spawnY
  }

  setCheckpoint(tileX: number, tileY: number): void {
    this.spawnX = tileX * TILE
    this.spawnY = tileY * TILE + TILE - this.h
  }

  setMap(map: TileMap): void {
    this.map = map
  }

  teleport(x: number, y: number): void {
    this.x = x
    this.y = y
    this.vx = 0
    this.vy = 0
    this.onGround = false
    this.attack = 0
    this.throw = 0
    this.throwCooldown = 0
    this.throwReleased = false
    this.attackElapsed = 0
    this.throwElapsed = 0
    this.hurt = 0
    this.dash = 0
  }

  saveSpawn(): { x: number; y: number } {
    return { x: this.spawnX, y: this.spawnY }
  }

  restoreSpawn(spawn: { x: number; y: number }): void {
    this.spawnX = spawn.x
    this.spawnY = spawn.y
  }

  get hurtbox(): Rect {
    return { x: this.x, y: this.y, w: this.w, h: this.h }
  }

  get attackBox(): Rect {
    // A lança do golpe é comprida: o alcance acompanha o desenho do quadro 3.
    return {
      x: this.facing > 0 ? this.x + this.w - 2 : this.x - 24,
      y: this.y + 5,
      w: 24,
      h: 13,
    }
  }

  // O golpe só machuda durante o quadro em que a lança avança; antes era o
  // tempo inteiro da animação, então o inimigo caía antes do braço mexer.
  get attackActive(): boolean {
    return (
      this.attack > 0 &&
      this.attackElapsed >= ATTACK_HIT_START &&
      this.attackElapsed <= ATTACK_HIT_END
    )
  }

  get actionLocked(): boolean {
    return this.attack > 0 || this.throw > 0
  }

  get actionProgress(): number {
    if (this.attack > 0) return Math.min(1, this.attackElapsed / ATTACK_TIME)
    if (this.throw > 0) return Math.min(1, this.throwElapsed / THROW_TIME)
    return 0
  }

  get dead(): boolean {
    return this.hp <= 0
  }

  respawn(): void {
    this.x = this.spawnX
    this.y = this.spawnY
    this.vx = 0
    this.vy = 0
    this.attack = 0
    this.throw = 0
    this.throwCooldown = 0
    this.attackElapsed = 0
    this.throwElapsed = 0
    this.hurt = 0
    this.dash = 0
    this.dashCooldown = 0
    this.invuln = 1.3
    this.onGround = false
    this.coyote = 0
    this.buffer = 0
    this.airDashUsed = false
    this.throwReleased = false
    this.justJumped = false
    this.justDashed = false
    this.justAttacked = false
    this.justThrew = false
    this.justLanded = false
    this.justSkidded = false
    this.skidCooldown = 0
  }

  hit(fromX?: number, damage: number = 1): void {
    if (this.invuln > 0) return
    this.hp = Math.max(0, this.hp - damage)
    this.invuln = 1.15
    this.hurt = HURT_TIME
    this.attack = 0
    this.throw = 0
    this.throwCooldown = 0
    this.throwReleased = false
    this.attackElapsed = 0
    this.throwElapsed = 0
    this.dash = 0
    const push = fromX !== undefined && fromX > this.x ? -1 : 1
    this.vx = push * 135
    this.vy = -175
  }

  update(dt: number, input: Input): void {
    this.justJumped = false
    this.justDashed = false
    this.justAttacked = false
    this.justThrew = false
    this.justLanded = false
    this.justSkidded = false
    this.landingSpeed = 0
    this.skidCooldown = Math.max(0, this.skidCooldown - dt)

    const wasOnGround = this.onGround
    const fallSpeed = this.vy
    const canAct = this.hurt <= 0.1
    const locked = this.actionLocked
    const dir = canAct && this.dash <= 0 ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0

    // Virada brusca no chão: o corpo derrapa antes de ganhar a nova direção.
    // O evento vira poeira e um pequeno tranco de câmera.
    if (
      this.onGround &&
      dir !== 0 &&
      this.vx * dir < -55 &&
      Math.abs(this.vx) > 45 &&
      this.skidCooldown <= 0
    ) {
      this.justSkidded = true
      this.skidCooldown = 0.32
    }

    if (this.dash > 0) {
      this.dash = Math.max(0, this.dash - dt)
      this.vx = this.facing * DASH_SPEED
      if (this.dash > 0) this.vy = Math.max(this.vy, 0)
      this.moveX(this.vx * dt)
      this.moveY(this.vy * dt)
    } else {
      if (dir !== 0) {
        // Durante o golpe/arremesso Sand continua andando, devagar:
        // o corpo não desliza por cima da própria animação.
        this.vx += dir * ACCEL * dt * (locked ? 0.34 : 1)
        if (!locked) this.facing = dir
      } else {
        const drop = FRICTION * dt
        this.vx = Math.abs(this.vx) <= drop ? 0 : this.vx - Math.sign(this.vx) * drop
      }
      const maxSpeed = locked ? RUN_SPEED * 0.42 : RUN_SPEED
      this.vx = clamp(this.vx, -maxSpeed, maxSpeed)
      this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL)

      if (input.jumpPressed && canAct) this.buffer = BUFFER_TIME
      this.buffer = Math.max(0, this.buffer - dt)
      this.coyote = this.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt)

      // Pulo: se houver tempo de coyote ou ground, pular
      if (this.buffer > 0 && this.coyote > 0) {
        this.vy = JUMP_SPEED
        this.onGround = false
        this.buffer = 0
        this.coyote = 0
        this.justJumped = true
      }

      // Corte do pulo: se o jogador soltar a tecla, a velocidade do pulo diminui
      if (!input.jumpHeld && this.vy < JUMP_CUT) this.vy = JUMP_CUT

      this.moveX(this.vx * dt)
      this.moveY(this.vy * dt)
    }

    if (this.onGround) this.airDashUsed = false

    // Dash
    if (
      canAct &&
      this.dash <= 0 &&
      this.dashCooldown <= 0 &&
      input.dashPressed &&
      (this.onGround || !this.airDashUsed)
    ) {
      this.dash = DASH_TIME
      this.dashCooldown = DASH_COOLDOWN
      this.attack = 0
      this.throw = 0
      this.attackElapsed = 0
      this.throwElapsed = 0
      this.throwReleased = false
      this.invuln = Math.max(this.invuln, 0.22)
      this.vx = this.facing * DASH_SPEED
      this.vy = this.onGround ? this.vy : 0
      if (!this.onGround) this.airDashUsed = true
      this.justDashed = true
    }

    // Arremesso de lança
    if (
      canAct &&
      this.dash <= 0 &&
      this.throwCooldown <= 0 &&
      this.throw <= 0 &&
      input.throwPressed
    ) {
      this.throw = THROW_TIME
      this.throwCooldown = THROW_COOLDOWN
      this.throwReleased = false
      this.throwElapsed = 0
      this.attack = 0
      this.attackElapsed = 0
    }

    // Golpe (corpo a corpo)
    if (
      canAct &&
      this.dash <= 0 &&
      this.throw <= 0 &&
      input.attackPressed &&
      this.attack === 0
    ) {
      this.attack = ATTACK_TIME
      this.attackElapsed = 0
      this.justAttacked = true
    }

    // Contagens decrescentes
    if (this.attack > 0) this.attackElapsed += dt
    if (this.throw > 0) this.throwElapsed += dt

    this.attack = Math.max(0, this.attack - dt)
    this.hurt = Math.max(0, this.hurt - dt)
    this.invuln = Math.max(0, this.invuln - dt)
    this.dashCooldown = Math.max(0, this.dashCooldown - dt)
    this.throw = Math.max(0, this.throw - dt)
    this.throwCooldown = Math.max(0, this.throwCooldown - dt)

    // Solta a lança no quadro especificado
    if (
      this.throw > 0 &&
      !this.throwReleased &&
      this.throwElapsed >= THROW_RELEASE_AT
    ) {
      this.throwReleased = true
      this.justThrew = true
    }

    // Detecção de queda do jogador
    if (!wasOnGround && this.onGround && fallSpeed > 240) {
      this.justLanded = true
      this.landingSpeed = fallSpeed
    }
  }

  private moveX(dx: number): void {
    this.x += dx
    for (const solid of this.map.solidsIn(this.hurtbox)) {
      if (dx > 0) this.x = solid.x - this.w
      else if (dx < 0) this.x = solid.x + solid.w
      this.vx = 0
    }
  }

  private moveY(dy: number): void {
    const previousBottom = this.y + this.h
    this.y += dy
    this.onGround = false

    for (const solid of this.map.solidsIn(this.hurtbox)) {
      if (dy > 0) {
        this.y = solid.y - this.h
        this.onGround = true
      } else if (dy < 0) {
        this.y = solid.y + solid.h
      }
      this.vy = 0
    }

    if (dy > 0) {
      for (const platform of this.map.platformsIn(this.hurtbox)) {
        if (previousBottom <= platform.y + 0.5) {
          this.y = platform.y - this.h
          this.vy = 0
          this.onGround = true
        }
      }
    }
  }
}