// Enemy AI — capangas, colonos, indígenas, lobisomens e guardiões
// Melhorado: IA mais fluida, colisão corrigida, índio sem "preto",
// animações de morte e ataque alinhadas ao jogador.
// O dash do indígena foi removido - o controle de dash agora só está no player.ts.

import {
  COLONIST_CLIPS,
  ColonistAnimator,
  IndioAnimator,
  WolfAnimator,
  ZombieAnimator,
  type EnemyClipName,
} from './animator'
import { GRAVITY, MAX_FALL, TILE, overlaps, type Rect } from './engine'
import { Tile, type EnemyKind, type EntitySpawn, type TileMap } from './level'

type Stats = {
  w: number
  h: number
  hp: number
  speed: number
  chase: number
  melee: boolean
  ranged: boolean
  cooldown: number
  visualScale: number
  label: string
  // Alcance máximo (em tiles) para o ataque à distância do inimigo.
  // O aguaceiro só atira nessa janela: longe o suficiente para dar abertura,
  // perto o suficiente para o disparo fazer sentido.
  rangedRange?: number
}

const STATS: Record<EnemyKind, Stats> = {
  capanga: {
    w: 13,
    h: 26,
    hp: 1,
    speed: 27,
    chase: 62,
    melee: true,
    ranged: false,
    cooldown: 1.7,
    visualScale: 1,
    label: 'Capanga',
  },
  soldado: {
    w: 15,
    h: 27,
    hp: 2,
    speed: 29,
    chase: 118,
    melee: true,
    ranged: true,
    rangedRange: 60,
    cooldown: 1.6,
    visualScale: 1,
    label: 'Soldado',
  },
  feitor: {
    w: 16,
    h: 28,
    hp: 4,
    speed: 33,
    chase: 104,
    melee: true,
    ranged: false,
    cooldown: 1.35,
    visualScale: 1,
    label: 'Feitor',
  },
  capitao: {
    w: 18,
    h: 30,
    hp: 8,
    speed: 31,
    chase: 130,
    melee: true,
    ranged: true,
    rangedRange: 80,
    cooldown: 1.1,
    visualScale: 1,
    label: 'Capitão',
  },
  indio: {
    w: 15,
    h: 28,
    hp: 3,
    speed: 30,
    chase: 100,
    melee: true,
    ranged: true,
    rangedRange: 64,
    cooldown: 1.5,
    visualScale: 1,
    label: 'Indio',
  },
  lobisomem: {
    w: 24,
    h: 30,
    hp: 12,
    speed: 42,
    chase: 155,
    melee: true,
    ranged: true,
    rangedRange: 92,
    cooldown: 1.0,
    visualScale: 1,
    label: 'Kennedy',
  },
  guardiao: {
    w: 17,
    h: 30,
    hp: 9,
    speed: 36,
    chase: 140,
    melee: true,
    ranged: true,
    rangedRange: 74,
    cooldown: 1.15,
    visualScale: 1,
    label: 'Guardião',
  },
  // Zumbi: lento, resistente o bastante para levar dois golpes e sempre
  // avança. A mordida é tratada à parte no main: encostar mata Sand.
  zumbi: {
    w: 16,
    h: 30,
    hp: 2,
    speed: 22,
    chase: 150,
    melee: true,
    ranged: false,
    cooldown: 0.9,
    visualScale: 1,
    label: 'Zumbi',
  },
}

type AttackKind = 'shoot' | 'slash'

const SHOOT_FIRE_AT = 0.12
const SLASH_HIT_AT = 0.18
const HURT_TIME = 0.24
const DEATH_TIME = 0.72

function clipDuration(kind: AttackKind): number {
  const clip = COLONIST_CLIPS[kind]
  return clip.frames.length / clip.fps
}

// ============================================================
// CLASSE INimigo
// ============================================================
export class Enemy {
  kind: EnemyKind
  label: string
  animator: ColonistAnimator | IndioAnimator | WolfAnimator | ZombieAnimator

  x: number
  y: number
  w: number
  h: number
  vx: number
  vy = 0
  hp: number
  maxHp: number
  alive = true
  facing = 1
  hurt = 0
  invuln = 0
  onGround = false
  justShot = false
  justStruck = false

  private stats: Stats
  public speed: number
  private readonly left: number
  private readonly right: number
  private readonly spawnX: number
  private readonly spawnY: number
  private readonly levelFactor: number
  private speedScale = 1
  private attackKind: AttackKind | null = null
  private attackElapsed = 0
  private attackCooldown = 0
  private fired = false
  private struck = false
  private deathTimer = 0

  constructor(spawn: EntitySpawn, tileSize: number, level: number = 1) {
    this.kind = spawn.kind ?? 'capanga'
    // Rede de segurança: um tipo novo no JSON nunca deve derrubar a fase.
    this.stats = STATS[this.kind] ?? STATS.capanga
    this.kind = (Object.keys(STATS) as EnemyKind[]).includes(this.kind) ? this.kind : 'capanga'
    this.label = this.stats.label
    this.animator =
      this.kind === 'indio'
        ? new IndioAnimator()
        : this.kind === 'lobisomem'
          ? new WolfAnimator()
          : this.kind === 'zumbi'
            ? new ZombieAnimator()
            : new ColonistAnimator()
    this.w = this.stats.w
    this.h = this.stats.h
    this.hp = this.stats.hp
    this.maxHp = this.stats.hp
    this.x = spawn.x * tileSize
    this.y = spawn.y * tileSize + tileSize - this.h
    this.spawnX = this.x
    this.spawnY = this.y
    this.left = (spawn.left ?? spawn.x - 3) * tileSize
    this.right = (spawn.right ?? spawn.x + 4) * tileSize
    // Velocidade proporcional ao nível: inimigos dos capítulos seguintes
    // perseguem um pouco mais rápido. A dificuldade entra depois, via
    // setSpeedScale, sem multiplicar o nível duas vezes.
    this.levelFactor = 1 + Math.max(0, level - 1) * 0.06
    this.speed = this.stats.speed * this.levelFactor
    this.vx = this.speed
    this.facing = 1
  }

  // Aplicado no início da fase (dificuldade escolhida no menu).
  setSpeedScale(scale: number): void {
    this.speedScale = scale
    this.speed = this.stats.speed * this.levelFactor * this.speedScale
    this.vx = Math.sign(this.vx || 1) * this.speed
  }

  get rect(): Rect {
    return { x: this.x, y: this.y, w: this.w, h: this.h }
  }

  get isBoss(): boolean {
    return this.kind === 'capitao' || this.kind === 'lobisomem' || this.kind === 'guardiao'
  }

  get isZombie(): boolean {
    return this.kind === 'zumbi'
  }

  // Um zumbi que encosta em um colono armado o infecta: o colono vira
  // zumbi na hora, com a mesma posição e os pés no chão.
  convertToZombie(): boolean {
    if (!this.alive || this.isZombie) return false
    const feet = this.y + this.h
    this.kind = 'zumbi'
    this.stats = STATS.zumbi
    this.label = this.stats.label
    this.animator = new ZombieAnimator()
    this.w = this.stats.w
    this.h = this.stats.h
    this.y = feet - this.h
    this.hp = this.stats.hp
    this.maxHp = this.stats.hp
    this.speed = this.stats.speed * this.levelFactor * this.speedScale
    this.vx = 0
    this.vy = 0
    this.attackKind = null
    this.attackElapsed = 0
    this.attackCooldown = 0.45
    this.hurt = 0
    this.invuln = 0.6
    this.animator.reset()
    return true
  }

  get visualScale(): number {
    return this.stats.visualScale
  }

  get visible(): boolean {
    return this.alive || this.deathTimer > 0
  }

  // 0 → acabou de morrer; 1 → animação de queda terminou.
  get deathProgress(): number {
    if (this.alive) return 0
    return 1 - Math.max(0, Math.min(1, this.deathTimer / DEATH_TIME))
  }

  get up(): boolean {
    return this.alive
  }

  get attackBox(): Rect {
    const reach = this.isBoss ? 34 : this.kind === 'feitor' ? 30 : 25
    return {
      x: this.facing > 0 ? this.x + this.w - 2 : this.x - reach + 2,
      y: this.y + 2,
      w: reach,
      h: Math.max(14, this.h - 4),
    }
  }

  get shotOrigin(): { x: number; y: number } {
    return {
      x: this.x + this.w / 2 + this.facing * (this.isBoss ? 11 : 8),
      y: this.y + this.h * 0.42,
    }
  }

  get isAttacking(): boolean {
    return this.attackKind !== null
  }

  get attackDamage(): number {
    // Chefes e feitores encaram com mais força; capangas e colonos, menos.
    return this.isBoss || this.kind === 'feitor' ? 2 : 1
  }

  reset(): void {
    this.x = this.spawnX
    this.y = this.spawnY
    this.vx = this.speed
    this.vy = 0
    this.hp = this.maxHp
    this.alive = true
    this.facing = 1
    this.hurt = 0
    this.invuln = 0
    this.attackKind = null
    this.attackElapsed = 0
    this.attackCooldown = 0
    this.fired = false
    this.struck = false
    this.deathTimer = 0
    this.animator.reset()
  }

  update(dt: number, map: TileMap, player?: Rect): void {
    this.justShot = false
    this.justStruck = false
    this.hurt = Math.max(0, this.hurt - dt)
    this.invuln = Math.max(0, this.invuln - dt)

    if (!this.alive) {
      this.deathTimer = Math.max(0, this.deathTimer - dt)
      this.animator.update(dt)
      return
    }

    this.animator.update(dt)
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)

    if (this.attackKind) {
      this.updateAttack(dt)
      this.vx = 0
    } else if (this.hurt <= 0) {
      this.think(player)
    } else {
      this.vx = 0
    }

    this.moveAndCollide(dt, map)
    this.updateAnimation()
  }

  damage(amount: number, fromX: number): boolean {
    if (!this.alive || this.invuln > 0) return false

    this.hp = Math.max(0, this.hp - amount)
    this.invuln = 0.3
    this.hurt = HURT_TIME
    this.attackKind = null
    this.attackElapsed = 0
    this.vx = 0

    if (this.hp <= 0) {
      this.alive = false
      this.deathTimer = DEATH_TIME
      this.animator.play('death')
      return true
    }

    const push = fromX < this.x + this.w / 2 ? 1 : -1
    this.facing = fromX < this.x + this.w / 2 ? 1 : -1
    this.x = Math.max(this.left, Math.min(this.right - this.w, this.x + push * 2))
    this.animator.play('hurt')
    return false
  }

  touches(rect: Rect): boolean {
    return this.alive && overlaps(this.rect, rect)
  }

  // ============================================================
  // PENSAMENTO DO INIMIGO (IA)
  // ============================================================
  private think(player?: Rect): void {
    this.facing = this.vx >= 0 ? 1 : -1

    if (player) {
      const playerCenterX = player.x + player.w / 2
      const enemyCenterX = this.x + this.w / 2
      const distance = playerCenterX - enemyCenterX
      const vertical = Math.abs(player.y + player.h / 2 - (this.y + this.h / 2))
      const inSight = vertical < 48 && Math.abs(distance) < this.stats.chase

      if (inSight) {
        this.facing = distance >= 0 ? 1 : -1

        if (this.attackCooldown <= 0 && this.canAttack(distance)) {
          const useShoot =
            this.stats.ranged && Math.abs(distance) > (this.stats.rangedRange ?? this.stats.chase + 10) * 0.6
          this.startAttack(useShoot ? 'shoot' : 'slash', distance)
          return
        }

        // Distância de parada: o inimigo só persegue até a distância de
        // abertura; chefes param mais longe e atacam com mais mão.
        const stopDistance = this.isBoss ? 30 : 22
        if (Math.abs(distance) > stopDistance) {
          this.vx = Math.sign(distance) * this.speed
        } else {
          this.vx = 0
        }
      } else {
        this.patrol()
      }
    } else {
      this.patrol()
    }
  }

  private patrol(): void {
    // O inimigo patrola dentro dos limites definidos no spawn.
    // Se chegar na borda, inverte a direção suavemente.
    // Nota: o dash foi removido do indígena, então o vx vem apenas do patrol.
    if (this.x <= this.left + 1) this.vx = Math.abs(this.speed)
    if (this.x + this.w >= this.right - 1) this.vx = -Math.abs(this.speed)
    this.facing = this.vx >= 0 ? 1 : -1
  }

  private canAttack(distance: number): boolean {
    const range = Math.abs(distance)
    if (this.stats.ranged) {
      const maxRange = this.stats.rangedRange ?? this.stats.chase + 10
      // Aguaceiro: atira quando o alvo está a uma distância útil — longe o
      // suficiente para dar abertura, perto o suficiente para o disparo pegar.
      return range > 24 && range < maxRange
    }
    if (this.stats.melee) {
      const meleeRange = this.isBoss ? 42 : this.kind === 'feitor' ? 30 : 34
      return range > 0 && range < meleeRange
    }
    return false
  }

  private startAttack(kind: AttackKind, distance: number): void {
    this.attackKind = kind
    this.attackElapsed = 0
    this.fired = false
    this.struck = false
    this.vx = 0
    this.facing = distance >= 0 ? 1 : -1
    this.animator.play(kind)
  }

  private updateAttack(dt: number): void {
    if (!this.attackKind) return
    this.attackElapsed += dt

    if (!this.fired && this.attackKind === 'shoot' && this.attackElapsed >= SHOOT_FIRE_AT) {
      this.fired = true
      this.justShot = true
    }

    if (!this.struck && this.attackKind === 'slash' && this.attackElapsed >= SLASH_HIT_AT) {
      this.struck = true
      this.justStruck = true
    }

    if (this.attackElapsed >= this.attackDuration(this.attackKind) + 0.04) {
      this.attackKind = null
      this.fired = false
      this.struck = false
      this.attackCooldown = this.stats.cooldown
    }
  }

  private attackDuration(kind: AttackKind): number {
    if (this.isZombie) return kind === 'slash' ? 6 / 11 : 0.35
    return clipDuration(kind)
  }

  // ============================================================
  // ATUALIZAÇÃO DE ANIMAÇÃO
  // ============================================================
  private updateAnimation(): void {
    // Se estiver attacking ou com hurt, não muda de estado (fica no clip atual).
    if (this.attackKind || this.hurt > 0) return

    // Estado baseado na velocidade horizontal.
    // |vx| > 4 → andando; otherwise → quieto.
    const state: EnemyClipName = Math.abs(this.vx) > 4 ? 'walk' : 'idle'
    this.animator.play(state)
  }

  // ============================================================
  // COLISÃO E MOVIMENTO
  // ============================================================
  private moveAndCollide(dt: number, map: TileMap): void {
    // Movimento horizontal primeiro
    this.x += this.vx * dt

    for (const solid of map.solidsIn(this.rect)) {
      if (this.vx > 0) {
        this.x = solid.x - this.w
        this.vx = -Math.abs(this.speed)
      } else if (this.vx < 0) {
        this.x = solid.x + solid.w
        this.vx = Math.abs(this.speed)
      }
      this.facing = this.vx >= 0 ? 1 : -1
    }

    // Limites do patrol (não sai da área designada)
    if (this.x < this.left) {
      this.x = this.left
      this.vx = Math.abs(this.vx)
    }
    if (this.x + this.w > this.right) {
      this.x = this.right - this.w
      this.vx = -Math.abs(this.vx)
    }

    // Gravidade e movimento vertical
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL)
    this.y += this.vy * dt

    for (const solid of map.solidsIn(this.rect)) {
      if (this.vy > 0) {
        this.y = solid.y - this.h
        this.vy = 0
        this.onGround = true
      } else if (this.vy < 0) {
        this.y = solid.y + solid.h
      }
    }

    // Se cair fora do mapa, reinicia (como morte suave)
    if (this.y > map.height + 80) {
      this.reset()
      return
    }

    // A borda de plataforma segura o colono mesmo quando ele está perseguindo.
    if (this.onGround && this.vx !== 0) {
      const aheadX = this.vx > 0 ? this.x + this.w + 2 : this.x - 2
      const tile = map.tileAt(Math.floor(aheadX / TILE), Math.floor((this.y + this.h + 3) / TILE))
      if (tile !== Tile.Solid && tile !== Tile.Platform) {
        this.vx = -this.vx
        this.facing = this.vx >= 0 ? 1 : -1
      }
    }
  }
}