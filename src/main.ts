import { Animator, type ClipName } from './animator'
import { sfx } from './audio'
import { drawBackground } from './background'
import { CHAPTERS, shortTitle, type ChapterDef } from './chapters'
import { Effects } from './effects'
import { Camera, Loop, TILE, VIEW_H, VIEW_W, overlaps } from './engine'
import { Enemy } from './enemy'
import { Input } from './input'
import { TileMap, Tile, type LevelData } from './level'
import { MAX_HP, Player } from './player'
import { drawScenery } from './scenery'
import { loadSprites, type Sprite } from './sprites'
import { Hud } from './ui/hud'
import { Screens, type RunStats } from './ui/screens'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('Canvas do jogo não encontrado')
const context = canvas.getContext('2d')
if (!context) throw new Error('Canvas 2D indisponível')
const ctx: CanvasRenderingContext2D = context
ctx.imageSmoothingEnabled = false

const SPRITE_SCALE = 1.0
const WIN_DELAY = 1100

type Memory = {
  x: number
  y: number
  phase: number
  got: boolean
}

type Checkpoint = {
  tx: number
  ty: number
  x: number
  baseY: number
  phase: number
  active: boolean
}

type Shot = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  boss: boolean
}

type Spear = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

class Game {
  onWin?: (stats: RunStats) => void

  private readonly input = new Input()
  private readonly camera = new Camera()
  private readonly animator = new Animator()
  private readonly effects = new Effects()
  private readonly hud = new Hud()

  private chapterIndex = 0
  private chapter: ChapterDef = CHAPTERS[0]
  private map!: TileMap
  private player!: Player
  private enemies: Enemy[] = []
  private memories: Memory[] = []
  private checkpoints: Checkpoint[] = []
  private shots: Shot[] = []
  private spears: Spear[] = []
  private dying = 0
  private deathMessage = ''
  private damageFlash = 0
  private killFlash = 0

  private goalX = 0
  private goalRow = 9
  private goalBaseY = 9 * TILE
  private bossDefeated = false
  private bossBarVisible = false
  private running = false
  private paused = false
  private won = false
  private hinted = false
  private goalHintCooldown = 0
  private runTime = 0
  private winTimer = 0
  private hudKey = ''

  constructor() {
    this.hud.setMuted(sfx.muted)
    this.hud.onMute(() => {
      sfx.unlock()
      const muted = sfx.toggle()
      this.hud.setMuted(muted)
      if (!muted) sfx.click()
    })
    this.loadChapter(0)
    this.reset()
  }

  get isRunning(): boolean {
    return this.running
  }

  get isPaused(): boolean {
    return this.paused
  }

  get finished(): boolean {
    return this.won
  }

  get nextChapterIndex(): number {
    return Math.min(CHAPTERS.length - 1, this.chapterIndex + 1)
  }

  start(chapterIndex = this.chapterIndex): void {
    window.clearTimeout(this.winTimer)
    this.loadChapter(chapterIndex)
    this.reset()
    this.running = true
    this.paused = false
    this.input.clear()
    this.hud.show()
    this.hud.hideOverlays()
    this.hud.showChapterCard(
      this.chapter.kicker,
      shortTitle(this.chapter.data.name),
      this.chapter.data.subtitle ?? '',
    )
    if (!this.hinted) {
      this.hinted = true
      this.hud.showControlsHint()
    }
    this.syncHud(true)
  }

  restart(): void {
    this.start(this.chapterIndex)
  }

  nextChapter(): void {
    this.start(this.nextChapterIndex)
  }

  pause(): void {
    if (!this.running || this.paused || this.won) return
    this.paused = true
    this.input.clear()
  }

  resume(): void {
    if (!this.paused) return
    this.paused = false
    this.input.clear()
  }

  toMenu(): void {
    window.clearTimeout(this.winTimer)
    this.running = false
    this.paused = false
    this.reset()
    this.hud.hide()
    this.hud.hideOverlays()
  }

  reset(): void {
    this.input.clear()
    this.player.hp = MAX_HP
    this.player.respawn()

    this.enemies = this.chapter.data.entities
      .filter((entity) => entity.type === 'enemy')
      .map((entity) => new Enemy(entity, TILE))

    this.memories = this.chapter.data.entities
      .filter((entity) => entity.type === 'memory')
      .map((entity, index) => ({
        x: entity.x * TILE,
        y: entity.y * TILE,
        phase: index * 1.9,
        got: false,
      }))

    this.checkpoints = this.chapter.data.entities
      .filter((entity) => entity.type === 'checkpoint')
      .map((entity, index) => ({
        tx: entity.x,
        ty: entity.y,
        x: entity.x * TILE,
        baseY: (entity.y + 1) * TILE,
        phase: index * 1.3,
        active: false,
      }))

    this.shots = []
    this.spears = []
    this.dying = 0
    this.deathMessage = ''
    this.won = false
    this.bossDefeated = false
    this.bossBarVisible = false
    this.goalHintCooldown = 0
    this.runTime = 0
    this.effects.clear()
    this.animator.reset()
    this.camera.snapTo(this.player.hurtbox, this.map.width, this.map.height)
    this.hud.resetHp()
    this.hud.hideBoss()
    this.syncHud(true)
  }

  update = (dt: number): void => {
    const safeDt = Math.min(dt, 1 / 30)

    if (!this.paused) this.effects.update(safeDt)
    this.damageFlash = Math.max(0, this.damageFlash - safeDt * 3.2)
    this.killFlash = Math.max(0, this.killFlash - safeDt * 2.4)

    if (!this.running || this.won) {
      if (!this.paused) this.updateAnimator(safeDt)
      this.input.endFrame()
      return
    }

    if (this.paused) {
      this.input.endFrame()
      return
    }

    if (this.dying > 0) {
      this.dying = Math.max(0, this.dying - safeDt)
      // A câmera continua seguindo Sand enquanto ele cai: a animação de
      // morte nunca fica fora da tela, dentro ou fora da cabana.
      const dying = this.player
      const look = dying.facing * 12
      this.camera.follow(
        { x: dying.x + look, y: dying.y, w: dying.w, h: dying.h },
        this.map.width,
        this.map.height,
        0.1,
      )
      this.updateAnimator(safeDt)
      if (this.dying <= 0) this.respawnAtCheckpoint(this.deathMessage)
      this.syncHud(true)
      this.input.endFrame()
      return
    }

    if (this.input.restartPressed) {
      this.start()
      this.input.endFrame()
      return
    }

    this.runTime += safeDt
    this.goalHintCooldown = Math.max(0, this.goalHintCooldown - safeDt)
    const player = this.player
    // Velocidade vertical antes da física: é ela que diz se Sand está
    // caindo sobre o inimigo (e não apenas encostando nele).
    const fallVy = player.vy
    player.update(safeDt, this.input)

    if (player.justJumped) {
      sfx.jump()
      this.effects.burst(player.x + player.w / 2, player.y + player.h, 'dust', 4, 24)
    }
    if (player.justDashed) {
      sfx.dash()
      this.effects.addShake(1.6)
      this.effects.burst(player.x + player.w / 2, player.y + player.h, 'dust', 8, 40)
    }
    if (player.justAttacked) {
      sfx.attack()
    }
    if (player.justThrew) {
      this.spawnSpear()
    }
    if (player.justLanded) {
      this.effects.burst(player.x + player.w / 2, player.y + player.h, 'dust', 6, 30)
      this.effects.addShake(Math.min(2.2, player.landingSpeed / 220))
    }
    if (player.dash > 0 && Math.random() < 0.85) {
      this.effects.trail(
        player.x + player.w / 2 - player.facing * 7,
        player.y + player.h / 2,
        'leaf',
      )
    }
    if (player.onGround && Math.abs(player.vx) > 72 && Math.random() < 0.12) {
      this.effects.trail(player.x + player.w / 2, player.y + player.h - 1, 'dust')
    }

    for (const checkpoint of this.checkpoints) {
      if (checkpoint.active) continue
      const marker = {
        x: checkpoint.x + 2,
        y: checkpoint.baseY - 28,
        w: TILE - 4,
        h: 28,
      }
      if (!overlaps(player.hurtbox, marker)) continue
      checkpoint.active = true
      player.setCheckpoint(checkpoint.tx, checkpoint.ty)
      sfx.collect()
      this.effects.burst(checkpoint.x + TILE / 2, checkpoint.baseY - 20, 'spark', 12, 48)
      this.effects.text(checkpoint.x + TILE / 2, checkpoint.baseY - 30, 'Marco aceso', '#ffe9a8')
    }

    for (const enemy of this.enemies) {
      enemy.update(safeDt, this.map, player.hurtbox)
      if (!enemy.alive) continue

      if (enemy.justShot) this.spawnShot(enemy)

      if (
        enemy.justStruck &&
        overlaps(enemy.attackBox, player.hurtbox) &&
        this.hurtPlayer(enemy.x, 'blade')
      ) {
        this.effects.addShake(2.6)
        this.effects.burst(
          player.x + player.w / 2,
          player.y + player.h / 2,
          'blade',
          9,
          46,
        )
      }

      // Pisão: cair sobre o inimigo machuca o colono, nunca o jogador.
      const stomp = fallVy > 0 && overlaps(player.hurtbox, enemy.rect)

      if (stomp) {
        this.damageEnemy(enemy, enemy.isBoss ? 1 : 2, player.x, true, 'stomp')
        player.vy = -258
        player.onGround = false
        player.attack = 0
        player.invuln = Math.max(player.invuln, 0.2)
        continue
      }

      if (
        player.attackActive &&
        enemy.invuln <= 0 &&
        overlaps(player.attackBox, enemy.rect)
      ) {
        this.damageEnemy(enemy, 1, player.x, false, 'blade')
        continue
      }

      if (overlaps(player.hurtbox, enemy.rect)) this.hurtPlayer(enemy.x, 'blade')
    }

    this.updateShots(safeDt)
    this.updateSpears(safeDt)

    for (const memory of this.memories) {
      if (memory.got) continue
      const orb = { x: memory.x + 2, y: memory.y + 2, w: TILE - 4, h: TILE - 4 }
      if (!overlaps(player.hurtbox, orb)) continue
      memory.got = true
      sfx.collect()
      this.effects.burst(memory.x + TILE / 2, memory.y + TILE / 2, 'spark', 16, 62)
      this.effects.text(memory.x + TILE / 2, memory.y - 2, '+1 memória', '#ffe9a8')
      this.effects.addShake(0.8)
    }

    // Interação: porta de cabana (fora) e saída (dentro).
    this.updateInteraction()

    // A morte é verificada antes do interior: sem isso, cair dentro da
    // cabana deixava Sand congelado com vida zerada.
    if (player.hp <= 0) {
      this.beginDeath('Sand caiu — a floresta o chama de volta.')
      this.input.endFrame()
      return
    }

    if (this.map.isWater(player.hurtbox)) {
      this.handleHazard('water')
      this.input.endFrame()
      return
    }

    if (this.map.spikesIn(player.hurtbox).length > 0) {
      this.handleHazard('spike')
      this.input.endFrame()
      return
    }

    if (player.y > this.map.height + 40) {
      this.handleHazard('fall')
      this.input.endFrame()
      return
    }

    if (player.hp <= 0) {
      this.beginDeath('Sand caiu — a floresta o chama de volta.')
      this.input.endFrame()
      return
    }

    const locked = this.goalLocked
    if (locked && player.x + player.w >= this.goalX) {
      player.x = this.goalX - player.w
      player.vx = Math.min(0, player.vx)
      if (this.goalHintCooldown <= 0) {
        this.goalHintCooldown = 2.2
        const boss = this.enemies.find((enemy) => enemy.isBoss)
        this.effects.text(
          this.goalX + TILE / 2,
          this.goalBaseY - 54,
          boss ? `${boss.label} ainda está de pé.` : 'O caminho ainda está fechado.',
          '#ff8b73',
        )
      }
    } else if (!locked && player.x + player.w >= this.goalX) {
      this.win()
    }

    if (!this.won) {
      const look = player.facing * 24 + Math.max(-12, Math.min(12, player.vx * 0.12))
      this.camera.follow(
        { x: player.x + look, y: player.y, w: player.w, h: player.h },
        this.map.width,
        this.map.height,
        0.1,
      )
    }

    this.updateBossBar()
    this.updateAnimator(safeDt)
    this.syncHud()
    this.input.endFrame()
  }

  render = (): void => {
    const time = performance.now() / 1000
    const shake = this.effects.shake
    const shakeX = shake > 0 ? Math.round((Math.random() * 2 - 1) * shake) : 0
    const shakeY = shake > 0 ? Math.round((Math.random() * 2 - 1) * shake) : 0

    ctx.save()
    ctx.translate(shakeX, shakeY)

    drawBackground(
      ctx,
      this.camera.px,
      this.camera.py,
      time,
      this.chapter.data.theme === 'night',
    )

    drawScenery(
      ctx,
      this.map,
      this.camera.px,
      this.camera.py,
      this.goalX,
      this.goalBaseY,
      time,
      this.chapter.data.theme,
      this.goalLocked,
    )

    ctx.fillStyle = this.chapter.tint
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    for (const checkpoint of this.checkpoints) this.paintCheckpoint(checkpoint, time)

    for (const memory of this.memories) {
      if (!memory.got) this.paintMemory(memory, time)
    }

    for (const enemy of this.enemies) {
      if (enemy.visible) this.paintEnemy(enemy, time)
    }

    this.paintShots(time)
    this.paintSpears(time)
    this.paintPlayer(time)

    this.effects.render(ctx, {
      x: this.camera.px,
      y: this.camera.py,
      w: VIEW_W,
      h: VIEW_H,
    })

    ctx.restore()
    this.paintVignette()

    // Flash de dano e de abate: dá peso aos golpes.
    if (this.damageFlash > 0) {
      const alpha = this.damageFlash * 0.34
      const gradient = ctx.createRadialGradient(
        VIEW_W / 2,
        VIEW_H / 2,
        40,
        VIEW_W / 2,
        VIEW_H / 2,
        190,
      )
      gradient.addColorStop(0, 'rgba(180, 30, 24, 0)')
      gradient.addColorStop(1, `rgba(180, 30, 24, ${alpha.toFixed(3)})`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    }

    if (this.killFlash > 0) {
      ctx.globalAlpha = this.killFlash * 0.16
      ctx.fillStyle = '#fff3c4'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      ctx.globalAlpha = 1
    }

    // Escurece a cena enquanto Sand cai: a morte fica legível.
    if (this.dying > 0) {
      ctx.globalAlpha = Math.min(0.62, (1.05 - this.dying) * 0.9)
      ctx.fillStyle = '#120a08'
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
      ctx.globalAlpha = 1
    }
  }

  get debug(): {
    chapter: number
    chapterName: string
    x: number
    y: number
    hp: number
    memories: number
    totalMemories: number
    onGround: boolean
    running: boolean
    paused: boolean
    finished: boolean
    state: string
    time: number
    goal: number
    bossHp: number | null
    enemies: { kind: string; x: number; y: number; hp: number; alive: boolean; state: string }[]
  } {
    const boss = this.enemies.find((enemy) => enemy.isBoss)
    return {
      chapter: this.chapterIndex + 1,
      chapterName: shortTitle(this.chapter.data.name),
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      hp: this.player.hp,
      memories: this.collected,
      totalMemories: this.memories.length,
      onGround: this.player.onGround,
      running: this.running,
      paused: this.paused,
      finished: this.won,
      state: this.animator.state,
      time: Math.round(this.runTime * 10) / 10,
      goal: this.goalX,
      bossHp: boss ? boss.hp : null,
      enemies: this.enemies.map((enemy) => ({
        kind: enemy.kind,
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        hp: enemy.hp,
        alive: enemy.alive,
        state: enemy.animator.state,
      })),
    }
  }

  debugStats(): RunStats {
    return {
      memories: this.collected,
      total: this.memories.length,
      seconds: this.runTime,
      allMemories: this.collected === this.memories.length,
      chapterIndex: this.chapterIndex,
      chapterName: shortTitle(this.chapter.data.name),
      endText: this.chapter.endText,
      nextChapter: this.chapterIndex < CHAPTERS.length - 1,
    }
  }

  private get goalLocked(): boolean {
    return this.chapter.lockGoalUntilBoss && !this.bossDefeated
  }

  private get collected(): number {
    return this.memories.filter((memory) => memory.got).length
  }

  private loadChapter(index: number): void {
    const clamped = Math.max(0, Math.min(CHAPTERS.length - 1, index))
    this.chapterIndex = clamped
    this.chapter = CHAPTERS[clamped]
    const data = this.chapter.data as LevelData
    this.map = new TileMap(data)
    this.player = new Player(this.map, data.spawn)
    this.goalX = (this.map.cols - 4) * TILE
    this.goalRow = this.findGoalRow(this.map.cols - 4)
    this.goalBaseY = this.goalRow * TILE
    this.hud.setChapter(`Cap. ${clamped + 1} · ${shortTitle(data.name)}`)
  }

  private findGoalRow(tx: number): number {
    for (let ty = 0; ty < this.map.rows; ty += 1) {
      if (this.map.tileAt(tx, ty) === Tile.Solid) return ty
    }
    return this.map.rows - 1
  }

  private updateAnimator(dt: number): void {
    const player = this.player
    let state: ClipName = 'idle'

    if (this.running && !this.won) {
      if (this.dying > 0 || player.hp <= 0) state = 'death'
      else if (player.hurt > 0) state = 'hurt'
      else if (player.throw > 0) state = 'throw'
      else if (player.attack > 0) state = 'attack'
      else if (!player.onGround) state = player.vy < 0 ? 'jump' : 'fall'
      else if (Math.abs(player.vx) > 14 || player.dash > 0) state = 'run'
    }

    this.animator.play(state)

    // Passada sincronizada com a velocidade real (entre 0,78 e 1,15).
    if (state === 'run') {
      this.animator.setTimeScale(0.78 + Math.min(1, Math.abs(player.vx) / 100) * 0.37)
    }

    this.animator.update(dt)
  }

  private damageEnemy(
    enemy: Enemy,
    amount: number,
    fromX: number,
    stomp: boolean,
    weapon: 'blade' | 'spear' | 'stomp' = 'blade',
  ): void {
    const cx = enemy.x + enemy.w / 2
    const cy = enemy.y + enemy.h / 2
    const killed = enemy.damage(amount, fromX)
    // Cada arma pinta o impacto do seu jeito.
    const impact = weapon === 'spear' ? 'spear' : weapon === 'stomp' ? 'hit' : 'blade'
    this.effects.burst(cx, cy, killed ? 'death' : impact, killed ? 14 : 8, killed ? 66 : 44)
    if (weapon === 'stomp') this.effects.burst(cx, enemy.y + enemy.h, 'dust', 7, 34)
    if (killed) this.killFlash = 1
    this.effects.addShake(killed ? 2.4 : 1.2)

    if (!killed) {
      this.effects.text(cx, enemy.y - 3, stomp ? 'PISÃO!' : 'ACERTO!', '#ffb38a')
      sfx.stomp()
      return
    }

    sfx.stomp()
    this.effects.text(
      cx,
      enemy.y - 3,
      stomp
        ? 'PISÃO!'
        : enemy.isBoss
          ? `${enemy.label.toUpperCase()} CAIU!`
          : 'ABATIDO!',
      enemy.isBoss ? '#ffd166' : '#ffe9a8',
    )

    if (enemy.isBoss) {
      this.bossDefeated = true
      this.bossBarVisible = false
      this.hud.hideBoss()
      this.effects.addShake(6)
      this.effects.text(this.goalX + TILE / 2, this.goalBaseY - 56, 'O caminho está livre.', '#ffd166')
      sfx.win()
    }
  }

  private hurtPlayer(fromX: number, kind: 'bullet' | 'blade' = 'bullet'): boolean {
    const before = this.player.hp
    this.player.hit(fromX)
    if (this.player.hp >= before) return false

    sfx.hit()
    this.effects.addShake(4)
    this.damageFlash = 1
    this.effects.burst(
      this.player.x + this.player.w / 2,
      this.player.y + this.player.h / 2,
      kind,
      10,
      52,
    )
    return true
  }

  private spawnShot(enemy: Enemy): void {
    const origin = enemy.shotOrigin
    const targetX = this.player.x + this.player.w / 2
    const targetY = this.player.y + this.player.h * 0.42
    const dx = targetX - origin.x
    const dy = targetY - origin.y
    const length = Math.max(1, Math.hypot(dx, dy))
    const speed = enemy.isBoss ? 232 : 208

    this.shots.push({
      x: origin.x,
      y: origin.y,
      vx: (dx / length) * speed,
      vy: (dy / length) * speed,
      life: 1.8,
      boss: enemy.isBoss,
    })
    sfx.shot()
    this.effects.addShake(1.1)
    this.effects.burst(origin.x, origin.y, 'spark', 11, 64)
  }

  private updateShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i -= 1) {
      const shot = this.shots[i]
      shot.life -= dt
      shot.x += shot.vx * dt
      shot.y += shot.vy * dt

      // Projétil um pouco maior que o desenho: o dano fica confiável mesmo
      // com o passo variável do quadro.
      const rect = { x: shot.x - 2, y: shot.y - 2, w: 4, h: 4 }
      const hitWall =
        this.map.solidsIn(rect).length > 0 || this.map.platformsIn(rect).length > 0
      const hitPlayer = overlaps(this.player.hurtbox, rect) && this.player.invuln <= 0

      if (shot.life <= 0 || hitWall) {
        if (hitWall) {
          this.effects.burst(shot.x, shot.y, 'dust', 6, 30)
          this.effects.addShake(0.4)
        }
        this.shots.splice(i, 1)
        continue
      }

      if (hitPlayer) {
        this.hurtPlayer(shot.x, 'bullet')
        this.effects.burst(shot.x, shot.y, 'bullet', 9, 52)
        this.shots.splice(i, 1)
      }
    }
  }

  private spawnSpear(): void {
    const player = this.player
    const dir = player.facing
    this.spears.push({
      x: player.x + player.w / 2 + dir * 10,
      y: player.y + 12,
      vx: dir * 335,
      vy: -6,
      life: 1.15,
    })
    this.effects.burst(player.x + player.w / 2 + dir * 10, player.y + player.h - 4, 'spark', 8, 44)
  }

  private updateSpears(dt: number): void {
    for (let i = this.spears.length - 1; i >= 0; i -= 1) {
      const spear = this.spears[i]
      spear.life -= dt
      spear.x += spear.vx * dt
      spear.y += spear.vy * dt

      const speed = Math.max(1, Math.hypot(spear.vx, spear.vy))
      const nx = spear.vx / speed
      const ny = spear.vy / speed
      const rect = { x: spear.x - nx * 9, y: spear.y - ny * 2, w: 18, h: 3 }
      const hitWall =
        this.map.solidsIn(rect).length > 0 || this.map.platformsIn(rect).length > 0
      let hitEnemy: Enemy | undefined

      for (const enemy of this.enemies) {
        if (!enemy.alive) continue
        if (enemy.invuln > 0) continue
        if (overlaps(rect, enemy.rect)) {
          hitEnemy = enemy
          break
        }
      }

      if (spear.life <= 0 || hitWall) {
        if (hitWall) {
          this.effects.burst(spear.x, spear.y, 'dust', 5, 26)
          this.effects.addShake(0.4)
        }
        this.spears.splice(i, 1)
        continue
      }

      if (hitEnemy) {
        // Chefes aguentam mais: a lança tira 1, os capangas caem com 2.
        this.damageEnemy(hitEnemy, hitEnemy.isBoss ? 1 : 2, spear.x, false, 'spear')
        this.spears.splice(i, 1)
      }
    }
  }

  private paintSpears(time: number): void {
    for (const spear of this.spears) {
      const x = Math.round(spear.x - this.camera.px)
      const y = Math.round(spear.y - this.camera.py)
      const angle = Math.atan2(spear.vy, spear.vx)

      const glow = ctx.createRadialGradient(x, y, 0.5, x, y, 8)
      glow.addColorStop(0, 'rgba(255, 178, 74, 0.4)')
      glow.addColorStop(1, 'rgba(255, 178, 74, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(x - 8, y - 8, 16, 16)

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.fillStyle = '#8a5a2a'
      ctx.fillRect(-8, -1, 16, 2)
      ctx.fillStyle = '#e8c48a'
      ctx.fillRect(-8, -0.5, 9, 1)
      ctx.fillStyle = '#b97d24'
      ctx.fillRect(1, -0.5, 6, 1)
      ctx.restore()

      ctx.globalAlpha = 0.2 + Math.sin(time * 14 + spear.x) * 0.12
      ctx.fillStyle = '#ffd166'
      ctx.fillRect(x - Math.round(spear.vx * 0.04), y - 3, 2, 2)
      ctx.globalAlpha = 1
    }
  }

  private handleHazard(kind: 'water' | 'spike' | 'fall'): void {
    const splashX = this.player.x + this.player.w / 2
    const splashY = Math.min(this.player.y + this.player.h, this.goalBaseY + 4)
    if (kind === 'water') {
      sfx.splash()
      this.effects.burst(splashX, splashY, 'splash', 18, 70)
      this.effects.text(splashX, splashY - 8, 'A água é funda!', '#bfeaf2')
    } else if (kind === 'spike') {
      sfx.hit()
      this.effects.burst(splashX, this.player.y + this.player.h - 4, 'hit', 13, 58)
      this.effects.text(splashX, this.player.y - 6, 'Estacas!', '#ffb38a')
    } else {
      sfx.hit()
      this.effects.text(splashX, this.player.y - 4, 'A floresta devolve...', '#ffd166')
    }

    this.effects.addShake(3)
    this.player.hit()
    if (this.player.hp <= 0) {
      this.player.hp = MAX_HP
      this.effects.text(splashX, splashY - 20, 'Sand respira de novo.', '#ffd166')
    }
    this.player.respawn()
    this.shots = []
    this.animator.reset()
    this.camera.snapTo(this.player.hurtbox, this.map.width, this.map.height)
    this.syncHud(true)
  }

  private updateInteraction(): void {
    // A versão 1.0 do jogo não tem cabanas nem portas: não há nada para
    // interagir, então o aviso do HUD é sempre escondido.
    this.hud.hideInteract()
  }

  private beginDeath(message: string): void {
    this.dying = 1.05
    this.deathMessage = message
    this.player.vx = 0
    this.player.attack = 0
    this.player.throw = 0
    this.spears = []
    this.shots = []
    this.effects.clear()
    this.effects.text(Math.max(80, this.player.x + this.player.w / 2), Math.max(60, this.player.y - 12), message, '#ffd166')
    this.camera.snapTo(this.player.hurtbox, this.map.width, this.map.height)
    this.syncHud(true)
  }

  private respawnAtCheckpoint(message: string): void {
    const x = this.player.x + this.player.w / 2
    const y = this.player.y - 6
    this.player.hp = MAX_HP
    this.player.respawn()
    this.shots = []
    this.animator.reset()
    this.effects.clear()
    this.effects.text(Math.max(60, x), Math.max(40, y), message, '#ffd166')
    this.camera.snapTo(this.player.hurtbox, this.map.width, this.map.height)
    this.syncHud(true)
  }

  private updateBossBar(): void {
    const boss = this.enemies.find((enemy) => enemy.isBoss)
    if (!boss || !boss.alive) {
      if (this.bossBarVisible) {
        this.bossBarVisible = false
        this.hud.hideBoss()
      }
      return
    }

    const near =
      boss.x + boss.w > this.camera.px - 32 &&
      boss.x < this.camera.px + VIEW_W + 32

    if (near) {
      if (!this.bossBarVisible) {
        this.bossBarVisible = true
        this.hud.showBoss(boss.label, boss.hp, boss.maxHp)
      } else {
        this.hud.renderBoss(boss.hp, boss.maxHp)
      }
    } else if (this.bossBarVisible) {
      this.bossBarVisible = false
      this.hud.hideBoss()
    }
  }

  private win(): void {
    if (this.won) return
    this.won = true
    this.player.vx = 0
    this.player.attack = 0
    this.player.hurt = 0
    this.animator.reset()
    sfx.win()
    this.effects.addShake(4)

    for (let i = 0; i < 6; i += 1) {
      this.effects.burst(this.goalX + TILE / 2, this.goalBaseY - 26 + i * 5, 'spark', 8, 80)
    }

    this.hud.hide()
    this.hud.hideOverlays()
    const stats = this.debugStats()

    window.clearTimeout(this.winTimer)
    this.winTimer = window.setTimeout(() => {
      this.onWin?.(stats)
    }, WIN_DELAY)
  }

  private syncHud(force = false): void {
    const total = this.memories.length
    const key = `${this.player.hp}:${this.collected}:${total}`
    if (!force && key === this.hudKey) return
    this.hudKey = key
    this.hud.render(this.player.hp, this.collected, total)
  }

  private paintCheckpoint(checkpoint: Checkpoint, time: number): void {
    const x = Math.round(checkpoint.x + TILE / 2 - this.camera.px)
    const baseY = Math.round(checkpoint.baseY - this.camera.py)
    if (x < -30 || x > VIEW_W + 30) return

    const color = checkpoint.active ? '#ffd166' : '#7b8a7a'

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
    ctx.fillRect(x - 6, baseY - 2, 12, 2)

    ctx.fillStyle = '#4a3220'
    ctx.fillRect(x - 2, baseY - 22, 4, 22)
    ctx.fillStyle = '#6b4a2d'
    ctx.fillRect(x - 1, baseY - 21, 2, 20)

    ctx.fillStyle = color
    ctx.fillRect(x + 1, baseY - 21, 7, 5)
    ctx.fillStyle = checkpoint.active ? '#fff0b8' : '#39443d'
    ctx.fillRect(x + 2, baseY - 20, 5, 1)

    if (checkpoint.active) {
      const flicker = 0.7 + Math.sin(time * 5.2 + checkpoint.phase) * 0.2
      const glow = ctx.createRadialGradient(x, baseY - 20, 1, x, baseY - 20, 24)
      glow.addColorStop(0, `rgba(255, 209, 102, ${0.22 * flicker})`)
      glow.addColorStop(1, 'rgba(255, 209, 102, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(x - 26, baseY - 46, 52, 52)

      ctx.globalAlpha = flicker
      ctx.fillStyle = '#ffb84d'
      ctx.fillRect(x - 1, baseY - 27, 2, 5)
      ctx.fillStyle = '#fff0b8'
      ctx.fillRect(x, baseY - 28, 1, 2)
      ctx.globalAlpha = 1
    }
  }

  private paintMemory(memory: Memory, time: number): void {
    const cx = Math.round(memory.x + TILE / 2 - this.camera.px)
    const cy = Math.round(memory.y + TILE / 2 - this.camera.py)
    const bob = Math.sin(time * 2.4 + memory.phase) * 2
    const y = cy + bob
    const pulse = 0.55 + Math.sin(time * 2.1 + memory.phase) * 0.2

    const glow = ctx.createRadialGradient(cx, y, 1, cx, y, 14)
    glow.addColorStop(0, `rgba(255, 229, 150, ${0.28 * pulse + 0.1})`)
    glow.addColorStop(1, 'rgba(255, 229, 150, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(cx - 14, y - 14, 28, 28)

    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#ffd166'
    ctx.fillRect(cx - 3, y - 2, 7, 5)
    ctx.globalAlpha = 1

    ctx.fillStyle = '#ffd166'
    ctx.beginPath()
    ctx.moveTo(cx, y - 6)
    ctx.lineTo(cx + 5, y)
    ctx.lineTo(cx, y + 6)
    ctx.lineTo(cx - 5, y)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#fff6d0'
    ctx.fillRect(cx - 1, y - 2, 2, 2)
    ctx.fillStyle = '#b97d24'
    ctx.fillRect(cx - 3, y + 2, 6, 1)

    for (let i = 0; i < 2; i += 1) {
      const angle = time * 1.4 + memory.phase + i * Math.PI
      const sx = cx + Math.cos(angle) * 8
      const sy = y + Math.sin(angle) * 5
      ctx.globalAlpha = 0.6
      ctx.fillStyle = '#fff3c4'
      ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1)
    }
    ctx.globalAlpha = 1
  }

  private paintEnemy(enemy: Enemy, time: number): void {
    const sprite = enemy.animator.frame
    const scale = enemy.visualScale
    const feetX = Math.round(enemy.x + enemy.w / 2 - this.camera.px)
    const feetY = Math.round(enemy.y + enemy.h - this.camera.py)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)'
    ctx.fillRect(feetX - 7, feetY - 2, 14, 2)

    if (enemy.isBoss && enemy.alive) {
      const aura = ctx.createRadialGradient(feetX, feetY - 18, 2, feetX, feetY - 18, 34)
      aura.addColorStop(0, 'rgba(196, 71, 58, 0.16)')
      aura.addColorStop(1, 'rgba(196, 71, 58, 0)')
      ctx.fillStyle = aura
      ctx.fillRect(feetX - 36, feetY - 54, 72, 58)
    }

    const flash = enemy.invuln > 0 && Math.floor(enemy.invuln * 28) % 2 === 0
    if (flash) ctx.globalAlpha = 0.55

    if (sprite) {
      const dx = feetX - sprite.ax * scale
      const dy = feetY - sprite.ay * scale
      if (enemy.facing < 0) {
        ctx.save()
        ctx.translate(feetX, 0)
        ctx.scale(-1, 1)
        this.drawSprite(sprite, -sprite.ax * scale, dy, scale, 0.2)
        ctx.restore()
      } else {
        this.drawSprite(sprite, dx, dy, scale, 0.2)
      }
    } else {
      this.paintFallbackColonist(feetX, feetY, scale, enemy.facing)
    }

    ctx.globalAlpha = 1

    if (enemy.isBoss && enemy.alive) {
      const pulse = 0.4 + Math.sin(time * 3) * 0.2
      ctx.globalAlpha = pulse
      ctx.fillStyle = '#ffd166'
      ctx.fillRect(feetX - 1, feetY - 46, 2, 2)
      ctx.globalAlpha = 1
    }
  }

  private paintShots(time: number): void {
    for (const shot of this.shots) {
      const x = Math.round(shot.x - this.camera.px)
      const y = Math.round(shot.y - this.camera.py)
      const length = Math.max(1, Math.hypot(shot.vx, shot.vy))
      const nx = shot.vx / length
      const ny = shot.vy / length

      // Rastro luminoso: três segmentos para trás, cada vez mais fracos.
      for (let i = 1; i <= 3; i += 1) {
        const tx = Math.round(x - nx * i * 5)
        const ty = Math.round(y - ny * i * 5)
        ctx.globalAlpha = 0.5 - i * 0.12
        ctx.fillStyle = shot.boss ? '#ff8b73' : '#ffe9a8'
        ctx.fillRect(tx, ty, 2, 1)
      }
      ctx.globalAlpha = 1

      const glow = ctx.createRadialGradient(x + 1, y + 1, 0.5, x + 1, y + 1, 9)
      glow.addColorStop(0, shot.boss ? 'rgba(255, 139, 115, 0.5)' : 'rgba(255, 233, 168, 0.44)')
      glow.addColorStop(1, 'rgba(255, 209, 102, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(x - 8, y - 8, 18, 18)

      // Bala de mosquete: núcleo claro, aro quente e um brilho que pisca.
      ctx.fillStyle = shot.boss ? '#c4473a' : '#c98a3c'
      ctx.fillRect(x - 1, y - 1, 4, 4)
      ctx.fillStyle = shot.boss ? '#ff8b73' : '#ffd166'
      ctx.fillRect(x, y, 3, 3)
      ctx.fillStyle = '#fff6d0'
      ctx.fillRect(x + 1, y + 1, 1, 1)

      ctx.globalAlpha = 0.35 + Math.sin(time * 16 + shot.x * 0.4) * 0.16
      ctx.fillStyle = '#fff6d0'
      ctx.fillRect(x - 2, y + 1, 1, 1)
      ctx.fillRect(x + 4, y + 1, 1, 1)
      ctx.globalAlpha = 1
    }
  }

  private paintPlayer(time: number): void {
    const player = this.player
    const feetX = Math.round(player.x + player.w / 2 - this.camera.px)
    const feetY = Math.round(player.y + player.h - this.camera.py)
    const blink = player.invuln > 0 && Math.floor(player.invuln * 22) % 2 === 0
    const sprite = this.animator.frame

    // Halo quente: mantém Sand legível sobre a mata escura.
    const halo = ctx.createRadialGradient(feetX, feetY - 16, 3, feetX, feetY - 16, 30)
    halo.addColorStop(0, 'rgba(255, 198, 96, 0.11)')
    halo.addColorStop(0.55, 'rgba(255, 178, 74, 0.045)')
    halo.addColorStop(1, 'rgba(255, 178, 74, 0)')
    ctx.fillStyle = halo
    ctx.fillRect(feetX - 32, feetY - 48, 64, 52)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)'
    ctx.fillRect(feetX - 8, feetY - 2, 16, 2)
    ctx.fillRect(feetX - 5, feetY, 10, 1)

    if (blink) ctx.globalAlpha = 0.5

    if (sprite) {
      const dy = feetY - sprite.ay * SPRITE_SCALE
      if (player.facing < 0) {
        ctx.save()
        ctx.translate(feetX, 0)
        ctx.scale(-1, 1)
        this.drawSprite(sprite, -sprite.ax * SPRITE_SCALE, dy, SPRITE_SCALE)
        ctx.restore()
      } else {
        this.drawSprite(
          sprite,
          feetX - sprite.ax * SPRITE_SCALE,
          dy,
          SPRITE_SCALE,
        )
      }
    } else {
      this.paintFallbackPlayer(feetX, feetY)
    }

    if (player.attack > 0) {
      const progress = player.actionProgress
      const alpha = Math.max(0, 0.75 - Math.abs(progress - 0.52) * 1.5)
      if (alpha > 0.05) {
        const dir = player.facing
        ctx.fillStyle = `rgba(255, 229, 150, ${alpha})`
        for (let i = 0; i < 5; i += 1) {
          ctx.fillRect(feetX + dir * (6 + i * 4), feetY - 19 + i, 2, 2)
        }
        ctx.fillStyle = `rgba(255, 255, 230, ${alpha * 0.8})`
        ctx.fillRect(feetX + dir * 23, feetY - 13, 3, 1)
      }
    }

    if (player.dash > 0) {
      const dir = player.facing
      ctx.globalAlpha = 0.16
      ctx.fillStyle = '#ffe9a8'
      ctx.fillRect(feetX - dir * 13 - 4, feetY - 20, 10, 18)
    }

    ctx.globalAlpha = 1

    if (!this.running && !this.paused) {
      const pulse = 0.15 + Math.sin(time * 2.2) * 0.08
      ctx.globalAlpha = pulse
      ctx.fillStyle = '#ffe9a8'
      ctx.fillRect(feetX + 10, feetY - 25, 2, 2)
      ctx.globalAlpha = 1
    }
  }

  private drawSprite(
    sprite: Sprite,
    x: number,
    y: number,
    scale: number,
    outlineAlpha = 0,
  ): void {
    const px = Math.round(x)
    const py = Math.round(y)
    const w = Math.max(1, Math.round(sprite.w * scale))
    const h = Math.max(1, Math.round(sprite.h * scale))

    // Contorno fino opcional: só nos inimigos, para separar a silhueta do
    // cenário. Sand já tem contorno próprio e fica mais nítido sem ele.
    if (outlineAlpha > 0) {
      ctx.globalAlpha = outlineAlpha
      const offsets = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]
      for (const [ox, oy] of offsets) {
        ctx.drawImage(sprite.outline, px + ox, py + oy, w, h)
      }
      ctx.globalAlpha = 1
    }
    ctx.drawImage(sprite.img, px, py, w, h)
  }

  private paintFallbackPlayer(feetX: number, feetY: number): void {
    const scale = SPRITE_SCALE
    const x = feetX - 5 * scale
    const y = feetY - 24 * scale
    ctx.fillStyle = '#6b4128'
    ctx.fillRect(x + 1 * scale, y + 20 * scale, 3 * scale, 4 * scale)
    ctx.fillRect(x + 6 * scale, y + 20 * scale, 3 * scale, 4 * scale)
    ctx.fillStyle = '#c98a5b'
    ctx.fillRect(x, y + 5 * scale, 10 * scale, 16 * scale)
    ctx.fillStyle = '#e8b98c'
    ctx.fillRect(x - scale, y, 12 * scale, 7 * scale)
    ctx.fillStyle = '#22160f'
    ctx.fillRect(x - scale, y - 2 * scale, 12 * scale, 3 * scale)
    ctx.fillStyle = '#1a1010'
    ctx.fillRect(this.player.facing > 0 ? x + 7 * scale : x + scale, y + 3 * scale, 2 * scale, 2 * scale)
  }

  private paintFallbackColonist(feetX: number, feetY: number, scale: number, facing: number): void {
    const w = Math.round(15 * scale)
    const h = Math.round(24 * scale)
    const x = feetX - Math.round(w / 2)
    const y = feetY - h
    ctx.fillStyle = '#8e342b'
    ctx.fillRect(x, y + 6, w, h - 8)
    ctx.fillStyle = '#d8c9a2'
    ctx.fillRect(x + 2, y + h - 6, w - 4, 4)
    ctx.fillStyle = '#c98a5b'
    ctx.fillRect(x + Math.round(w * 0.28), y, Math.round(w * 0.44), 7)
    ctx.fillStyle = '#3a2818'
    ctx.fillRect(x + Math.round(w * 0.15), y - 2, Math.round(w * 0.7), 3)
    ctx.fillStyle = '#ffd166'
    ctx.fillRect(facing > 0 ? x + w - 4 : x + 2, y + 2, 2, 1)
  }

  private paintVignette(): void {
    const gradient = ctx.createRadialGradient(
      VIEW_W / 2,
      VIEW_H / 2,
      56,
      VIEW_W / 2,
      VIEW_H / 2,
      205,
    )
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.42)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    const bottom = ctx.createLinearGradient(0, VIEW_H - 40, 0, VIEW_H)
    bottom.addColorStop(0, 'rgba(0, 0, 0, 0)')
    bottom.addColorStop(1, 'rgba(0, 0, 0, 0.22)')
    ctx.fillStyle = bottom
    ctx.fillRect(0, VIEW_H - 40, VIEW_W, 40)
  }
}

const game = new Game()

const screens = new Screens({
  onChapter: (index) => {
    sfx.unlock()
    sfx.click()
    game.start(index)
    screens.hideAll()
  },
  onNext: () => {
    sfx.unlock()
    sfx.click()
    game.nextChapter()
    screens.hideAll()
  },
  onResume: () => {
    sfx.unlock()
    sfx.click()
    game.resume()
    screens.hideAll()
  },
  onRestart: () => {
    sfx.unlock()
    sfx.click()
    game.restart()
    screens.hideAll()
  },
  onMenu: () => {
    sfx.unlock()
    sfx.click()
    game.toMenu()
    screens.showMenu()
  },
})

screens.setChapters(
  CHAPTERS.map((chapter) => ({
    name: chapter.data.name,
    shortTitle: shortTitle(chapter.data.name),
    tag: chapter.tag,
    subtitle: chapter.data.subtitle ?? '',
  })),
)

game.onWin = (stats) => {
  screens.showEnd(stats)
}

const loop = new Loop(game.update, game.render)
loop.start()

void loadSprites()

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Escape' || event.repeat) return
  if (game.finished) return

  if (game.isPaused) {
    sfx.click()
    game.resume()
    screens.hideAll()
    return
  }

  if (game.isRunning) {
    sfx.click()
    game.pause()
    screens.showPause()
    return
  }

  screens.back()
})

window.addEventListener('blur', () => {
  if (game.isRunning && !game.isPaused && !game.finished) {
    game.pause()
    screens.showPause()
  }
})

if (import.meta.env.DEV) {
  const debugWindow = window as unknown as Record<string, unknown>
  debugWindow.__sandman = game
  debugWindow.__sandmanUi = { game, screens }

  const params = new URLSearchParams(window.location.search)
  const chapterParam = Math.max(0, Math.min(CHAPTERS.length - 1, Number(params.get('chapter') ?? '1') - 1))
  if (params.has('play')) {
    game.start(chapterParam)
    screens.hideAll()
  }

  const view = params.get('view')
  if (view === 'chapters') {
    screens.showChapters()
  }
  if (view === 'how' || view === 'credits') {
    document.querySelector<HTMLButtonElement>(`[data-action="${view}"]`)?.click()
  }
  if (view === 'pause') {
    game.start(chapterParam)
    screens.hideAll()
    game.pause()
    screens.showPause()
  }
  if (view === 'end') {
    game.start(chapterParam)
    screens.hideAll()
    screens.showEnd(game.debugStats())
  }
}
