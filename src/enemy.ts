// Enemy AI — capangas, colonos, indígenas, lobisomens e guardiões
// Melhorado: IA mais fluida, colisão corrigida, índio sem "preto",
// animações de morte e ataque alinhadas ao jogador.
// O dash do indígena foi removido - o controle de dash agora só está no player.ts.

import {
  COLONIST_CLIPS,
  ColonistAnimator,
  IndioAnimator,
  UrsaAnimator,
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

  // Urso: boss do Capítulo 1. Sprite bem maior que Sand (1.15x) e hitbox
  // larga (34x52), mantendo os pés alinhados ao chão para golpes justos.
  ursa: {
    w: 34,
    h: 52,
    hp: 22,
    speed: 26,
    chase: 210,
    melee: true,
    ranged: false,
    cooldown: 1.55,
    visualScale: 1.15,
    label: 'Urso',
  },
}

type AttackKind = 'shoot' | 'slash' | 'slam' | 'charge'

const SHOOT_FIRE_AT = 0.12
const SLASH_HIT_AT = 0.18
const HURT_TIME = 0.24
const DEATH_TIME = 0.72

// O machado do urso toca o chão no quinto quadro do clipe de ataque.
// A investida tem um aviso longo antes de acelerar, para o jogador ler a
// ameaça e pular ou correr para o lado.
const URSA_SLAM_IMPACT = 0.42
const URSA_SLAM_DURATION = 0.82
const URSA_CHARGE_WINDUP = 0.55
const URSA_CHARGE_ACTIVE = 0.56
const URSA_CHARGE_DURATION = 1.34
const URSA_CHARGE_SPEED = 168
// Recuperação do machado: depois do impacto o urso fica aberto por um instante.
const URSA_SLAM_RECOVERY = 0.32
// O machado do urso toca o chão na horizontal do swing.
const URSA_SLAM_REACH = 64
const URSA_SLAM_BOX_H = 48

function clipDuration(kind: AttackKind): number {
  const clip = COLONIST_CLIPS[kind as 'shoot' | 'slash']
  return clip.frames.length / clip.fps
}

// ============================================================
// CLASSE INimigo
// ============================================================
export class Enemy {
  kind: EnemyKind
  label: string
  animator:
    | ColonistAnimator
    | IndioAnimator
    | WolfAnimator
    | ZombieAnimator
    | UrsaAnimator

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
  justSlammed = false
  justCharged = false
  justCrashed = false

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
  private stunTimer = 0
  private deathTimer = 0
  private deathDuration = DEATH_TIME

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
            : this.kind === 'ursa'
              ? new UrsaAnimator()
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
    return (
      this.kind === 'capitao' ||
      this.kind === 'lobisomem' ||
      this.kind === 'guardiao' ||
      this.kind === 'ursa'
    )
  }

  get isZombie(): boolean {
    return this.kind === 'zumbi'
  }

  get isUrsa(): boolean {
    return this.kind === 'ursa'
  }

  // Abaixo da metade da vida o urso entra em fúria: anda mais rápido,
  // ataca mais vezes e a aura vermelha denuncia o novo estado.
  get isEnraged(): boolean {
    return this.isUrsa && this.alive && this.hp <= Math.ceil(this.maxHp / 2)
  }

  get isCharging(): boolean {
    return (
      this.attackKind === 'charge' &&
      this.attackElapsed >= URSA_CHARGE_WINDUP &&
      this.attackElapsed < URSA_CHARGE_WINDUP + URSA_CHARGE_ACTIVE
    )
  }

  get isStunned(): boolean {
    return this.stunTimer > 0
  }

  get attackMode(): 'slam' | 'charge' | null {
    return this.attackKind === 'slam' || this.attackKind === 'charge'
      ? this.attackKind
      : null
  }

  // 0 → acabou de começar o aviso; 1 → golpe/ investida prestes a sair.
  get telegraph(): number {
    if (!this.isUrsa || !this.attackKind) return 0
    if (this.attackKind === 'slam') {
      return Math.min(1, this.attackElapsed / URSA_SLAM_IMPACT)
    }
    if (this.attackKind === 'charge') {
      if (this.attackElapsed < URSA_CHARGE_WINDUP) {
        return Math.min(1, this.attackElapsed / URSA_CHARGE_WINDUP)
      }
      return this.isCharging ? 1 : 0
    }
    return 0
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
    this.stunTimer = 0
    this.deathTimer = 0
    this.deathDuration = DEATH_TIME
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
    // O urso golpeia com o machado à frente dos pés: a caixa fica baixa e
    // larga, acompanhando o arco do quadro de impacto.
    if (this.isUrsa) {
      if (this.attackKind === 'slam') {
        const reach = URSA_SLAM_REACH
        return {
          x: this.facing > 0 ? this.x + this.w - 18 : this.x - reach + 18,
          y: this.y + this.h - URSA_SLAM_BOX_H,
          w: reach,
          h: URSA_SLAM_BOX_H,
        }
      }
      return { x: this.x + 4, y: this.y + 8, w: this.w - 8, h: this.h - 8 }
    }

    const reach =
      this.kind === 'feitor'
        ? 28
        : this.kind === 'capitao'
          ? 30
          : this.kind === 'lobisomem'
            ? 26
            : this.kind === 'guardiao'
              ? 28
              : this.kind === 'soldado' || this.kind === 'indio'
                ? 24
                : 22
    // A janela vertical acompanha o corpo do inimigo. Antes a caixa ia do
    // topo aos pés, então um golpe no ar ainda acertava quem estava abaixo.
    return {
      x: this.facing > 0 ? this.x + this.w - 2 : this.x - reach + 2,
      y: this.y + this.h * 0.3,
      w: reach,
      h: Math.max(12, this.h * 0.52),
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

  // Encostar no urso machuca menos que levar o machado: o dano grande fica
  // reservado para o golpe telegrafado.
  get contactDamage(): number {
    if (this.isUrsa) return 1
    return this.attackDamage
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
    this.stunTimer = 0
    this.deathTimer = 0
    this.deathDuration = DEATH_TIME
    this.justShot = false
    this.justStruck = false
    this.justSlammed = false
    this.justCharged = false
    this.justCrashed = false
    this.animator.reset()
  }

  update(dt: number, map: TileMap, player?: Rect): void {
    this.justShot = false
    this.justStruck = false
    this.justSlammed = false
    this.justCharged = false
    this.justCrashed = false
    this.hurt = Math.max(0, this.hurt - dt)
    this.invuln = Math.max(0, this.invuln - dt)
    this.stunTimer = Math.max(0, this.stunTimer - dt)

    if (!this.alive) {
      this.deathTimer = Math.max(0, this.deathTimer - dt)
      this.animator.update(dt)
      return
    }

    this.animator.update(dt)
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)

    if (this.stunTimer > 0) {
      // Depois de bater na parede na investida, o urso fica atordoado e vira
      // uma janela de dano para o jogador.
      this.vx = 0
      this.updateAnimation()
      this.moveAndCollide(dt, map)
      return
    }

    if (this.attackKind) {
      this.updateAttack(dt)
      if (!this.isCharging) this.vx = 0
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
    this.invuln = this.isUrsa ? 0.22 : 0.3
    this.hurt = this.isUrsa ? 0.12 : HURT_TIME
    // O urso é pesado: o golpe não interrompe a investida nem o machado.
    // Os outros inimigos perdem o ataque quando são atingidos.
    if (!this.isUrsa || this.hp <= 0) {
      this.attackKind = null
      this.attackElapsed = 0
    }
    this.vx = 0

    if (this.hp <= 0) {
      this.alive = false
      this.deathDuration = this.isUrsa ? 1.8 : this.isBoss ? 1.05 : DEATH_TIME
      this.deathTimer = this.deathDuration
      this.animator.play('death')
      return true
    }

    const push = fromX < this.x + this.w / 2 ? 1 : -1
    this.facing = fromX < this.x + this.w / 2 ? 1 : -1
    this.x = Math.max(
      this.left,
      Math.min(this.right - this.w, this.x + push * (this.isUrsa ? 1 : 2)),
    )
    if (!this.isUrsa || !this.attackKind) this.animator.play('hurt')
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

    if (this.isUrsa) {
      this.thinkUrsa(player)
      return
    }

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

  // O urso tem duas ferramentas: o golpe de machado quando o alvo está perto
  // e a investida quando está no meio da arena. A escolha é sempre precedida
  // por um aviso visual (telegraph), para não haver dano "do nada".
  private thinkUrsa(player?: Rect): void {
    if (!player) {
      this.patrol()
      return
    }

    const playerCenterX = player.x + player.w / 2
    const enemyCenterX = this.x + this.w / 2
    const distance = playerCenterX - enemyCenterX
    const vertical = Math.abs(player.y + player.h / 2 - (this.y + this.h / 2))
    const inSight = vertical < 64 && Math.abs(distance) < this.stats.chase

    if (!inSight) {
      this.patrol()
      return
    }

    this.facing = distance >= 0 ? 1 : -1
    const range = Math.abs(distance)

    if (this.attackCooldown <= 0) {
      if (range <= 62) {
        this.startAttack('slam', distance)
        return
      }
      if (range <= 190) {
        this.startAttack('charge', distance)
        return
      }
    }

    const stopDistance = 34
    if (range > stopDistance) {
      this.vx = Math.sign(distance) * this.speed * (this.isEnraged ? 1.3 : 1)
    } else {
      this.vx = 0
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
      if (range > 24 && range < maxRange) return true
    }
    if (this.stats.melee) {
      const meleeRange = this.isBoss ? 42 : this.kind === 'feitor' ? 30 : 34
      // Soldados e capitães também golpeiam de perto; antes o return do
      // bloco ranged impedia qualquer ataque corpo a corpo.
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

    if (this.isUrsa) {
      // A investida usa o ciclo de caminhada em ritmo acelerado; o golpe de
      // machado usa o clipe de ataque completo.
      this.animator.play(kind === 'slam' ? 'attack' : 'walk')
      this.animator.setTimeScale(kind === 'slam' ? 1 : 0.55)
      return
    }

    this.animator.play(kind as 'shoot' | 'slash')
  }

  private updateAttack(dt: number): void {
    if (!this.attackKind) return
    this.attackElapsed += dt

    if (this.isUrsa) {
      this.updateUrsaAttack()
      return
    }

    if (!this.fired && this.attackKind === 'shoot' && this.attackElapsed >= SHOOT_FIRE_AT) {
      this.fired = true
      this.justShot = true
    }

    if (!this.struck && this.attackKind === 'slash' && this.attackElapsed >= SLASH_HIT_AT) {
      this.struck = true
      this.justStruck = true
    }

    if (this.attackElapsed >= this.attackDuration(this.attackKind) + 0.04) {
      this.finishAttack()
    }
  }

  private updateUrsaAttack(): void {
    if (this.attackKind === 'slam') {
      if (!this.struck && this.attackElapsed >= URSA_SLAM_IMPACT) {
        this.struck = true
        this.justStruck = true
        this.justSlammed = true
      }
      if (this.attackElapsed >= URSA_SLAM_DURATION) {
        const kind = this.attackKind
        this.finishAttack()
        // Janela de recuperação: o machado pesa e o urso fica vulnerável.
        if (kind === 'slam' && this.alive) {
          this.stunTimer = URSA_SLAM_RECOVERY
        }
      }
      return
    }

    if (this.attackKind !== 'charge') return

    if (!this.fired && this.attackElapsed >= URSA_CHARGE_WINDUP) {
      this.fired = true
      this.justCharged = true
    }

    if (this.isCharging) {
      this.vx = this.facing * URSA_CHARGE_SPEED * (this.isEnraged ? 1.28 : 1)
      this.animator.setTimeScale(1.6)
    } else if (this.attackElapsed >= URSA_CHARGE_WINDUP + URSA_CHARGE_ACTIVE) {
      this.vx = 0
      this.animator.setTimeScale(1)
    }

    if (this.attackElapsed >= URSA_CHARGE_DURATION) this.finishAttack()
  }

  private finishAttack(): void {
    this.attackKind = null
    this.attackElapsed = 0
    this.fired = false
    this.struck = false
    this.attackCooldown =
      this.isUrsa && this.isEnraged ? 1.05 : this.stats.cooldown
    this.animator.setTimeScale(1)
  }

  private crashCharge(): void {
    if (!this.isCharging) return
    this.attackKind = null
    this.attackElapsed = 0
    this.fired = false
    this.struck = false
    this.vx = 0
    this.stunTimer = 1.05
    this.attackCooldown = 1.25
    this.justCrashed = true
    this.animator.play('hurt')
    this.animator.setTimeScale(1)
  }

  private attackDuration(kind: AttackKind): number {
    if (this.isZombie) return kind === 'slash' ? 6 / 11 : 0.35
    return clipDuration(kind as 'shoot' | 'slash')
  }

  // ============================================================
  // ATUALIZAÇÃO DE ANIMAÇÃO
  // ============================================================
  private updateAnimation(): void {
    // Atordoado: mantém o quadro de dano até a tontura passar.
    if (this.stunTimer > 0) return
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
      if (this.isCharging) {
        // Investida contra parede: o urso para, fica atordoado e perde o
        // ataque. É a punição por errar a carga.
        this.x = this.vx > 0 ? solid.x - this.w : solid.x + solid.w
        this.crashCharge()
        break
      }
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
        if (this.isCharging) this.crashCharge()
        else this.vx = Math.abs(this.vx)
      }
      if (this.x + this.w > this.right) {
        this.x = this.right - this.w
        if (this.isCharging) this.crashCharge()
        else this.vx = -Math.abs(this.vx)
      }
    }

    // Gravidade e movimento vertical. onGround é recalculado a cada quadro:
    // sem isso o inimigo continuava "no chão" depois de sair de uma
    // plataforma e a checagem de borda disparava no ar.
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