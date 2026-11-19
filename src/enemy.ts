// Enemy AI — capangas, colonos, indígenas, lobisomens e guardiões
// Melhorado: IA mais fluida, colisão corrigida, índio sem "preto",
// animações de morte e ataque alinhadas ao jogador.
// O dash do indígena foi removido - o controle de dash agora só está no player.ts.

import {
  BOSS_COLONIST_CLIPS,
  BOSS_GUARDIAO_CLIPS,
  BossAnimator,
  ColonistAnimator,
  IndioAnimator,
  WolfAnimator,
  ZombieAnimator,
  type EnemyClipName,
} from './animator'
import { GRAVITY, MAX_FALL, TILE, overlaps, type Rect } from './engine'
import { Tile, type EnemyKind, type EntitySpawn, type TileMap } from './level'
import { getBossFrame, type BossSkin } from './sprites'

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

// Configuração de um chefe. O mesmo corpo (capitão) recebe valores e uma
// paleta diferentes por capítulo; o guardião tem a sua própria configuração.
export type BossConfig = {
  name: string
  title: string
  skin: BossSkin
  role: 'boss' | 'guardiao'
  hp: number
  speed: number
  damage: number
  meleeRange: number
  throwRange: number
  chargeRange: number
  attackCooldown: number
  chargeCooldown: number
  scale: number
  aura: string
  rim: string
  nameColor: string
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
    label: 'Mercenário',
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
  // Animação revista: 32 quadros recortados de uma folha 8×4,
  // com contorno esverdeado e anchors centralizados (18,52) para pisada firme.
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
type BossAction = 'slash' | 'throw' | 'charge'

const HURT_TIME = 0.24
const BOSS_HURT_TIME = 0.18
const DEATH_TIME = 0.72
const BOSS_ACCEL = 760
const BOSS_STOP_ACCEL = 1500
const BOSS_CHARGE_WINDUP = 0.24
const BOSS_CHARGE_DASH = 0.36
// Janela em que o golpe do chefe ameaça de verdade (para o parry).
const THREAT_BEFORE = 0.06
const THREAT_AFTER = 0.09

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
  stunTimer = 0
  guardTimer = 0
  counterWindow = 0
  justCharged = false
  justChargeHit = false

  private bossConfig: BossConfig | null = null
  private bossAction: BossAction | null = null
  private bossActionTime = 0
  private bossActionDuration = 0
  private bossHitAt = 0
  private bossChargeDir = 1
  private bossChargeStarted = false
  private bossChargeCanHit = false
  private bossChargeCooldown = 0
  private bossJumpCooldown = 0

  stun(seconds: number): void {
    this.stunTimer = Math.max(this.stunTimer, seconds)
    this.vx = 0
    this.attackKind = null
    this.attackElapsed = 0
    this.cancelBossAction()
    this.animator.setTimeScale(1)
    this.animator.play('hurt')
  }

  // O índio levanta o machado para defender. Se um golpe chegar durante a
  // janela, ele desvia (sem dano) e abre uma janela de contra-ataque.
  startGuard(): void {
    if (this.kind !== 'indio' || !this.alive || this.stunTimer > 0 || this.guardTimer > 0) return
    this.guardTimer = 0.42
    this.counterWindow = 0.3
    this.vx = 0
    this.attackKind = null
    this.animator.play('guard')
  }

  get isGuarding(): boolean {
    return this.kind === 'indio' && this.alive && this.guardTimer > 0
  }

  // Retorna true se o golpe foi desviado.
  blockedByGuard(): boolean {
    if (!this.isGuarding) return false
    this.guardTimer = 0
    this.counterWindow = 0.55
    this.animator.play('guard')
    return true
  }

  private stats: Stats
  public speed: number
  private readonly left: number
  private readonly right: number
  private readonly spawnX: number
  private readonly spawnY: number
  private readonly levelFactor: number
  private speedScale = 1
  private healthScale = 1
  private attackKind: AttackKind | null = null
  private attackElapsed = 0
  private jumpCooldown = 0
  private attackCooldown = 0
  private fired = false
  private struck = false
  private deathTimer = 0
  private deathDuration = DEATH_TIME

  constructor(spawn: EntitySpawn, tileSize: number, level: number = 1) {
    this.kind = spawn.kind ?? 'capanga'
    // Rede de segurança: um tipo novo no JSON nunca deve derrubar a fase.
    this.stats = STATS[this.kind] ?? STATS.capanga
    this.kind = (Object.keys(STATS) as EnemyKind[]).includes(this.kind) ? this.kind : 'capanga'
    this.label = this.stats.label
    this.animator =
      this.kind === 'indio' || this.kind === 'guardiao'
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

  // Dificuldades mais duras dão mais fôlego aos inimigos (e chefes).
  setHealthScale(scale: number): void {
    this.healthScale = scale
    this.maxHp = Math.max(1, Math.round(this.stats.hp * scale))
    this.hp = this.maxHp
  }

  // Transforma o capitão/guardião em um chefe com nome, paleta e ritmo
  // próprios. Chamado logo depois do construtor, antes dos escalonamentos
  // de velocidade/vida da dificuldade.
  configureBoss(config: BossConfig): void {
    this.bossConfig = config
    this.label = config.name
    this.stats = {
      ...this.stats,
      hp: config.hp,
      speed: config.speed,
      cooldown: config.attackCooldown,
      visualScale: config.scale,
      label: config.name,
      chase: Math.max(this.stats.chase, config.chargeRange + 24),
      rangedRange: config.throwRange,
    }
    this.maxHp = config.hp
    this.hp = config.hp
    this.speed = config.speed * this.levelFactor
    this.vx = 0
    this.animator = new BossAnimator(
      config.role === 'guardiao' ? BOSS_GUARDIAO_CLIPS : BOSS_COLONIST_CLIPS,
      (name) => getBossFrame(config.skin, name),
    )
    this.animator.reset()
    this.bossAction = null
    this.bossActionTime = 0
    this.bossChargeCanHit = false
    this.bossChargeCooldown = 0
    this.bossJumpCooldown = 0
    this.attackCooldown = 0.5
  }

  get bossName(): string {
    return this.bossConfig?.name ?? this.label
  }

  get bossTitle(): string {
    return this.bossConfig?.title ?? ''
  }

  get bossSkin(): BossSkin | null {
    return this.bossConfig?.skin ?? null
  }

  get bossAura(): string {
    return this.bossConfig?.aura ?? '#c4473a'
  }

  get bossRim(): string {
    return this.bossConfig?.rim ?? '#ffd166'
  }

  get bossNameColor(): string {
    return this.bossConfig?.nameColor ?? '#ffd166'
  }

  get isFinalBoss(): boolean {
    return this.bossConfig?.role === 'guardiao'
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
    this.hp = Math.max(1, Math.round(this.stats.hp * this.healthScale))
    this.maxHp = this.hp
    this.speed = this.stats.speed * this.levelFactor * this.speedScale
    this.vx = 0
    this.vy = 0
    this.jumpCooldown = 0
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
    return 1 - Math.max(0, Math.min(1, this.deathTimer / this.deathDuration))
  }

  get up(): boolean {
    return this.alive
  }

  get attackBox(): Rect {
    // O golpe só tem caixa enquanto o ataque está ativo. Fora disso, o
    // inimigo não causa dano só por existir (isso quebrava o parry).
    if (this.bossAction === 'charge') {
      if (!this.bossChargeCanHit) return { x: 0, y: 0, w: 0, h: 0 }
      return { x: this.x - 2, y: this.y, w: this.w + 4, h: this.h }
    }
    if (!this.attackKind) return { x: 0, y: 0, w: 0, h: 0 }
    const reach = this.isBoss ? 38 : this.kind === 'feitor' ? 30 : this.isZombie ? 22 : 25
    return {
      x: this.facing > 0 ? this.x + this.w - 2 : this.x - reach + 2,
      y: this.y + this.h * 0.25,
      w: reach,
      h: Math.max(12, this.h * 0.5),
    }
  }

  // A ameaça real para o parry: o corpo do chefe durante a investida ou a
  // janela de impacto do golpe. Ficar encostado no chefe não conta.
  get threatActive(): boolean {
    if (this.bossAction === 'charge') return this.bossChargeCanHit
    if (this.attackKind === 'slash') {
      const hit = this.attackHitAt
      return (
        this.attackElapsed >= hit - THREAT_BEFORE &&
        this.attackElapsed <= hit + THREAT_AFTER
      )
    }
    return false
  }

  get threatBox(): Rect {
    return this.attackBox
  }

  get isCharging(): boolean {
    return this.bossAction === 'charge' && this.bossChargeCanHit
  }

  get chargeCanHit(): boolean {
    return this.isCharging
  }

  consumeChargeHit(): void {
    if (!this.bossChargeCanHit) return
    this.bossChargeCanHit = false
    this.justChargeHit = true
  }

  // Chamado quando o jogador defende. O chefe resiste mais que um capanga.
  parried(perfect: boolean): void {
    const stun = this.isBoss
      ? perfect
        ? 0.72
        : 0.28
      : perfect
        ? 1.1
        : 0.42
    this.stun(stun)
    this.cancelBossAction()
    this.attackCooldown = Math.max(this.attackCooldown, this.isBoss ? 0.55 : 0.4)
    this.bossChargeCooldown = Math.max(this.bossChargeCooldown, 0.6)
    this.invuln = 0.16
  }

  get shotOrigin(): { x: number; y: number } {
    return {
      x: this.x + this.w / 2 + this.facing * (this.isBoss ? 11 : 8),
      y: this.y + this.h * 0.42,
    }
  }

  get isAttacking(): boolean {
    return this.attackKind !== null || this.bossAction === 'charge'
  }

  get attackDamage(): number {
    // Chefes e feitores encaram com mais força; capangas e colonos, menos.
    return this.bossConfig?.damage ?? (this.isBoss || this.kind === 'feitor' ? 2 : 1)
  }

  // Quadro de impacto do golpe, calculado pelo clipe do animador atual.
  private get attackHitAt(): number {
    if (this.bossAction) return this.bossHitAt
    if (this.isZombie) return 0.24
    return this.animator.duration('slash') * 0.55
  }

  private get shootFireAt(): number {
    if (this.isZombie) return 0.28
    return this.animator.duration('shoot') * 0.55
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
    this.stunTimer = 0
    this.guardTimer = 0
    this.counterWindow = 0
    this.justCharged = false
    this.justChargeHit = false
    this.bossAction = null
    this.bossActionTime = 0
    this.bossActionDuration = 0
    this.bossHitAt = 0
    this.bossChargeStarted = false
    this.bossChargeCanHit = false
    this.bossChargeCooldown = 0
    this.bossJumpCooldown = 0
    this.animator.reset()
  }

  update(dt: number, map: TileMap, player?: Rect): void {
    this.justShot = false
    this.justStruck = false
    this.justCharged = false
    this.justChargeHit = false
    this.hurt = Math.max(0, this.hurt - dt)
    this.invuln = Math.max(0, this.invuln - dt)
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt)
    this.stunTimer = Math.max(0, this.stunTimer - dt)
    this.guardTimer = Math.max(0, this.guardTimer - dt)
    this.counterWindow = Math.max(0, this.counterWindow - dt)
    this.bossChargeCooldown = Math.max(0, this.bossChargeCooldown - dt)
    this.bossJumpCooldown = Math.max(0, this.bossJumpCooldown - dt)

    if (!this.alive) {
      this.deathTimer = Math.max(0, this.deathTimer - dt)
      this.animator.update(dt)
      return
    }

    this.animator.update(dt)
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)

    if (this.bossConfig) {
      this.updateBoss(dt, map, player)
    } else if (this.stunTimer > 0) {
      this.vx = 0
    } else if (this.guardTimer > 0) {
      this.vx = 0
    } else if (this.counterWindow > 0 && this.kind === 'indio' && player) {
      // Janela de contra-ataque após defender (sem som/luz piscando).
      const dx = player.x + player.w / 2 - (this.x + this.w / 2)
      this.guardTimer = 0
      this.counterWindow = 0
      this.startAttack('slash', dx)
    } else if (this.attackKind) {
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
    this.hurt = this.isBoss ? BOSS_HURT_TIME : HURT_TIME
    this.attackKind = null
    this.attackElapsed = 0
    this.cancelBossAction()
    this.vx = 0

    if (this.hp <= 0) {
      this.alive = false
      this.deathDuration = this.isZombie ? 0.95 : this.isBoss ? 1.05 : 0.9
      this.deathTimer = this.deathDuration
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

        // Se o alvo está numa plataforma, o inimigo salta para alcançá-lo,
        // com intervalo para não ficar quicando no mesmo lugar.
        if (
          this.onGround &&
          this.jumpCooldown <= 0 &&
          player.y + player.h < this.y - 12 &&
          Math.abs(distance) < 60
        ) {
          this.vy = -300
          this.onGround = false
          this.jumpCooldown = 0.7
        }
      } else {
        this.patrol()
      }
    } else {
      this.patrol()
    }
  }

  private patrol(): void {
    // Zumbis não respeitam a área de patrulha: eles vagueiam pela margem
    // até encontrar uma parede, um rio ou outra presa. É assim que um
    // zumbi chega sozinho até um colono armado e o infecta.
    if (this.isZombie) {
      this.facing = this.vx >= 0 ? 1 : -1
      return
    }
    // Os demais inimigos patrulham dentro dos limites definidos no spawn.
    // Se chegar na borda, inverte a direção suavemente.
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

    if (!this.fired && this.attackKind === 'shoot' && this.attackElapsed >= this.shootFireAt) {
      this.fired = true
      this.justShot = true
    }

    if (!this.struck && this.attackKind === 'slash' && this.attackElapsed >= this.attackHitAt) {
      this.struck = true
      this.justStruck = true
    }

    if (this.attackElapsed >= this.attackDuration(this.attackKind) + 0.03) {
      this.attackKind = null
      this.fired = false
      this.struck = false
      this.attackCooldown = this.stats.cooldown
    }
  }

  private attackDuration(kind: AttackKind): number {
    if (this.isZombie) return kind === 'slash' ? 6 / 11 : 0.35
    return this.animator.duration(kind)
  }

  // ============================================================
  // CÉREBRO DOS CHEFES
  // ============================================================
  // Eles correm de verdade (aceleram, freiam e param na borda), atacam no
  // mesmo compasso do jogador (golpe curto, arremesso e investida) e nunca
  // ficam presos no último quadro de uma animação.
  private updateBoss(dt: number, map: TileMap, player?: Rect): void {
    const cfg = this.bossConfig
    if (!cfg) {
      this.think(player)
      return
    }

    if (this.stunTimer > 0 || this.hurt > 0) {
      this.vx = 0
      return
    }

    if (this.bossAction) {
      this.updateBossAction(dt)
      return
    }

    if (!player) {
      this.patrol()
      return
    }

    const playerCenterX = player.x + player.w / 2
    const enemyCenterX = this.x + this.w / 2
    const dx = playerCenterX - enemyCenterX
    const adx = Math.abs(dx)
    const dy = player.y + player.h / 2 - (this.y + this.h / 2)
    const dir = dx >= 0 ? 1 : -1
    this.facing = dir

    const arenaLeft = this.left + 4
    const arenaRight = this.right - 4
    const playerInside =
      playerCenterX >= arenaLeft - 20 && playerCenterX <= arenaRight + 20

    // Decisão de ataque: perto, golpe; média, arremesso ou investida; longe,
    // investida. A escolha alterna para o chefe não repetir o mesmo padrão.
    if (this.attackCooldown <= 0 && Math.abs(dy) < 58 && playerInside) {
      if (adx <= cfg.meleeRange) {
        this.startBossAction('slash', dx)
        return
      }
      if (adx <= cfg.throwRange) {
        if (
          this.bossChargeCooldown <= 0 &&
          adx > cfg.meleeRange + 26 &&
          Math.random() < 0.34
        ) {
          this.startBossAction('charge', dx)
        } else {
          this.startBossAction('throw', dx)
        }
        return
      }
      if (adx <= cfg.chargeRange && this.bossChargeCooldown <= 0) {
        this.startBossAction('charge', dx)
        return
      }
    }

    // Alvo em plataforma: salta para alcançar.
    if (
      this.onGround &&
      this.bossJumpCooldown <= 0 &&
      player.y + player.h < this.y - 14 &&
      adx < 78
    ) {
      this.vy = -340
      this.onGround = false
      this.bossJumpCooldown = 1.15
    }

    const stopDistance = Math.max(14, (this.w + player.w) / 2 + 3)

    if (!playerInside) {
      const edge = playerCenterX < arenaLeft ? arenaLeft : arenaRight - this.w
      const d = edge - this.x
      this.accelerate(Math.abs(d) > 4 ? Math.sign(d) * this.speed * 0.6 : 0, dt)
      return
    }

    if (adx > stopDistance) {
      if (this.onGround && this.hasWallAhead(map, dir)) {
        if (player.y + player.h < this.y - 8 && this.bossJumpCooldown <= 0) {
          this.vy = -340
          this.onGround = false
          this.bossJumpCooldown = 1
        } else {
          this.accelerate(0, dt)
          if (this.attackCooldown <= 0 && adx <= cfg.throwRange * 1.15) {
            this.startBossAction('throw', dx)
          }
        }
        return
      }
      if (this.onGround && !this.hasGroundAhead(map, dir)) {
        // Não se joga de uma plataforma: para na borda e arremessa.
        this.accelerate(0, dt)
        if (this.attackCooldown <= 0 && adx <= cfg.throwRange * 1.15) {
          this.startBossAction('throw', dx)
        }
        return
      }
      this.accelerate(dir * this.speed, dt)
    } else {
      this.accelerate(0, dt)
    }
  }

  private startBossAction(kind: BossAction, dx: number): void {
    this.bossAction = kind
    this.bossActionTime = 0
    this.facing = dx >= 0 ? 1 : -1
    this.vx = 0
    this.fired = false
    this.struck = false
    this.bossChargeStarted = false
    this.bossChargeCanHit = false
    this.animator.setTimeScale(1)

    if (kind === 'slash') {
      this.bossActionDuration = this.animator.duration('slash')
      this.bossHitAt = this.bossActionDuration * 0.55
      this.attackKind = 'slash'
      this.attackElapsed = 0
      this.animator.play('slash')
      return
    }

    if (kind === 'throw') {
      this.bossActionDuration = this.animator.duration('shoot')
      this.bossHitAt = this.bossActionDuration * 0.58
      this.attackKind = 'shoot'
      this.attackElapsed = 0
      this.animator.play('shoot')
      return
    }

    // Investida: um breve agachamento (telegraph) e então o corpo dispara.
    this.bossActionDuration = BOSS_CHARGE_WINDUP + BOSS_CHARGE_DASH
    this.bossHitAt = BOSS_CHARGE_WINDUP
    this.bossChargeDir = this.facing
    this.attackKind = null
    this.attackElapsed = 0
    this.animator.play('idle')
    this.animator.setTimeScale(0.7)
  }

  private updateBossAction(dt: number): void {
    const action = this.bossAction
    if (!action) return
    this.bossActionTime += dt

    if (action === 'slash') {
      this.attackElapsed = this.bossActionTime
      this.vx = this.bossActionTime < 0.12 ? this.facing * 95 : 0
      if (!this.struck && this.bossActionTime >= this.bossHitAt) {
        this.struck = true
        this.justStruck = true
      }
      if (this.bossActionTime >= this.bossActionDuration) this.endBossAction(false)
      return
    }

    if (action === 'throw') {
      this.attackElapsed = this.bossActionTime
      this.vx = 0
      if (!this.fired && this.bossActionTime >= this.bossHitAt) {
        this.fired = true
        this.justShot = true
      }
      if (this.bossActionTime >= this.bossActionDuration) this.endBossAction(false)
      return
    }

    if (this.bossActionTime < BOSS_CHARGE_WINDUP) {
      this.vx = 0
      if (this.animator.state !== 'idle') this.animator.play('idle')
      this.animator.setTimeScale(0.7)
      return
    }

    if (this.bossActionTime < BOSS_CHARGE_WINDUP + BOSS_CHARGE_DASH) {
      if (!this.bossChargeStarted) {
        this.bossChargeStarted = true
        this.bossChargeCanHit = true
        this.justCharged = true
        this.animator.play('walk')
        this.animator.setTimeScale(1.7)
      }
      this.vx = this.bossChargeDir * Math.max(170, this.speed * 3.1)
      return
    }

    this.vx = 0
    this.bossChargeCanHit = false
    this.endBossAction(true)
  }

  private endBossAction(wasCharge: boolean): void {
    const cfg = this.bossConfig
    this.bossAction = null
    this.bossActionTime = 0
    this.attackKind = null
    this.attackElapsed = 0
    this.fired = false
    this.struck = false
    this.bossChargeCanHit = false
    this.bossChargeStarted = false
    this.vx = 0
    this.animator.setTimeScale(1)
    if (!cfg) return
    this.attackCooldown = cfg.attackCooldown * (0.9 + Math.random() * 0.35)
    if (wasCharge) {
      this.bossChargeCooldown = cfg.chargeCooldown * (0.9 + Math.random() * 0.25)
    }
  }

  private cancelBossAction(): void {
    this.bossAction = null
    this.bossActionTime = 0
    this.bossChargeCanHit = false
    this.bossChargeStarted = false
    this.attackKind = null
    this.attackElapsed = 0
    this.fired = false
    this.struck = false
    this.vx = 0
    this.animator.setTimeScale(1)
  }

  private accelerate(target: number, dt: number): void {
    const rate =
      Math.abs(target) < Math.abs(this.vx) ? BOSS_STOP_ACCEL : BOSS_ACCEL
    if (this.vx < target) this.vx = Math.min(target, this.vx + rate * dt)
    else if (this.vx > target) this.vx = Math.max(target, this.vx - rate * dt)
  }

  private hasGroundAhead(map: TileMap, dir: number): boolean {
    const aheadX = dir > 0 ? this.x + this.w + 4 : this.x - 4
    const footY = this.y + this.h + 4
    const tile = map.tileAt(Math.floor(aheadX / TILE), Math.floor(footY / TILE))
    return tile === Tile.Solid || tile === Tile.Platform
  }

  private hasWallAhead(map: TileMap, dir: number): boolean {
    const aheadX = dir > 0 ? this.x + this.w + 2 : this.x - 2
    const midY = this.y + this.h * 0.5
    const tile = map.tileAt(Math.floor(aheadX / TILE), Math.floor(midY / TILE))
    return tile === Tile.Solid
  }

  // ============================================================
  // ATUALIZAÇÃO DE ANIMAÇÃO
  // ============================================================
  private updateAnimation(): void {
    // Se estiver attacking, hurt ou atordoado, não muda de estado (fica no
    // clip atual). O atordoamento não pode sumir no quadro seguinte.
    if (this.attackKind || this.hurt > 0 || this.stunTimer > 0) return

    // Estado baseado na velocidade horizontal.
    // |vx| > 4 → andando; otherwise → quieto.
    const state: EnemyClipName = Math.abs(this.vx) > 4 ? 'walk' : 'idle'
    this.animator.play(state)

    // A passada acompanha a velocidade real: quem corre, corre com os pés.
    if (state === 'walk') {
      const ratio = Math.min(1, Math.abs(this.vx) / Math.max(1, this.speed))
      this.animator.setTimeScale(0.72 + ratio * 0.55)
    } else {
      this.animator.setTimeScale(1)
    }
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

    // Limites do patrol (não sai da área designada). Zumbis vagueiam
    // livremente: é o que permite que eles encontrem novos colonos.
    if (!this.isZombie) {
      if (this.x < this.left) {
        this.x = this.left
        this.vx = Math.abs(this.vx)
      }
      if (this.x + this.w > this.right) {
        this.x = this.right - this.w
        this.vx = -Math.abs(this.vx)
      }
    }

    // Gravidade e movimento vertical.
    const previousBottom = this.y + this.h
    this.onGround = false
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

    // Plataformas de um lado só: o inimigo pisa quando vem de cima e atravessa
    // quando salta de baixo, igual ao jogador.
    if (this.vy >= 0) {
      for (const platform of map.platformsIn(this.rect)) {
        if (previousBottom <= platform.y + 0.5 && this.y + this.h >= platform.y) {
          this.y = platform.y - this.h
          this.vy = 0
          this.onGround = true
        }
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