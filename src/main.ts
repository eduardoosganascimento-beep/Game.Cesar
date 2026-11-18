import { Animator, type ClipName } from './animator'
import { sfx } from './audio'
import { drawBackground } from './background'
import { CHAPTERS, TUTORIAL, shortTitle, type ChapterDef } from './chapters'
import { DELTAS, DIFFICULTY_LABELS, readDifficulty, writeDifficulty, type Difficulty } from './difficulty'
import { Effects } from './effects'
import { Camera, Loop, TILE, VIEW_H, VIEW_W, overlaps } from './engine'
import { Enemy } from './enemy'
import { Input } from './input'
import { TileMap, Tile, type EnemyKind, type LevelData } from './level'
import { MAX_HP, Player } from './player'
import { drawScenery } from './scenery'
import { characterScale, loadSprites, type Sprite } from './sprites'
import { CutsceneView } from './ui/cutscene'
import { Hud } from './ui/hud'
import { Screens, type RunStats } from './ui/screens'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('Canvas do jogo não encontrado')
const context = canvas.getContext('2d')
if (!context) throw new Error('Canvas 2D indisponível')
const ctx: CanvasRenderingContext2D = context
ctx.imageSmoothingEnabled = false

// Todos os personagens são desenhados na mesma altura visível (38 px).
// O Sand não tem cocar: só o sprite original, recolorido com tons quentes.
const SPRITE_SCALE = characterScale('player')

function enemyScale(enemy: Enemy): number {
  if (enemy.isZombie) return characterScale('zombie')
  if (enemy.kind === 'lobisomem') return characterScale('wolf')
  if (enemy.kind === 'indio' || enemy.kind === 'guardiao') return characterScale('indio')
  return characterScale('colonist')
}

// Passe final de cor: o jogo é desenhado no canvas e depois copiado de volta
// com dessaturação, contraste e split-tone (sombras frias, luzes quentes).
// Dá unidade cinematográfica aos cenários, sprites e efeitos sem custo de GPU.
const gradeCanvas = document.createElement('canvas')
gradeCanvas.width = VIEW_W
gradeCanvas.height = VIEW_H
const gradeCtx = gradeCanvas.getContext('2d')
const WIN_DELAY = 1100
// Tempo do esmagamento do corpo ao aterrissar.
const LAND_SQUASH_TIME = 0.2

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

// Rastro do dash: cópias de Sand que se apagam atrás dele.
type DashGhost = {
  x: number
  y: number
  facing: number
  life: number
  max: number
  sprite?: Sprite
}

// Passos do tutorial jogável. Cada passo avança quando a condição
// correspondente é cumprida; o último fica na tela até o fim da fase.
const TUTORIAL_STEPS = [
  'Ande com ← e → pela trilha',
  'Pule com Espaço (segure para ir mais alto)',
  'Ataque com J — o tacape é seu',
  'Arremesse a lança com L',
  'Siga até a fogueira no fim da trilha',
  'Use o Perry com F — bloqueie ataques inimigos e contra-ataca',
]

// Colonos armados (espada ou arma de fogo) podem ser infectados pelos
// zumbis. Índios, lobos e guardiões não fazem parte desse grupo.
function isArmedColonist(kind: EnemyKind): boolean {
  return kind === 'capanga' || kind === 'soldado' || kind === 'feitor' || kind === 'capitao'
}

class Game {
  onWin?: (stats: RunStats) => void

  private readonly input = new Input()
  private readonly camera = new Camera()
  private readonly animator = new Animator()
  private readonly effects = new Effects()
  private readonly hud = new Hud()
  private readonly cutsceneView = new CutsceneView()

  private chapterIndex = 0
  private chapter: ChapterDef = CHAPTERS[0]
  private cutsceneLines: string[] = []
  private cutsceneLine = 0
  private tutorialMode = false
  private tutorialStep = 0
  private tutorialStartX = 0
  private map!: TileMap
  private player!: Player
  private enemies: Enemy[] = []
  private shots: Shot[] = []
  private spears: Spear[] = []
  private dashGhosts: DashGhost[] = []
  private dashGhostTimer = 0
  private hitStop = 0
  private landSquash = 0
  private dying = 0
  private deathMessage = ''
  private damageFlash = 0
  private killFlash = 0
  private deathDust = new Set<Enemy>()

  private goalX = 0
  private goalRow = 9
  private goalBaseY = 9 * TILE
  private running = false
  private paused = false
  private won = false
  private hinted = false
  private goalHintCooldown = 0
  private parryTimer = 0
  private riposte = 0
  private combo = 0
  private comboTimer = 0
  private runTime = 0
  private winTimer = 0
  private hudKey = ''
  private difficulty: Difficulty = readDifficulty()

  constructor() {
    this.hud.setMuted(sfx.muted)
    this.hud.setDifficulty(DIFFICULTY_LABELS[this.difficulty])
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

  // Capítulos de noite usam o fundo de luar e uma grade azulada.
  get isNight(): boolean {
    return this.chapter.data.night ?? this.chapter.data.theme === 'night'
  }

  get isPaused(): boolean {
    return this.paused
  }

  get finished(): boolean {
    return this.won
  }

  getDifficulty(): Difficulty {
    return this.difficulty
  }

  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty
    this.hud.setDifficulty(DIFFICULTY_LABELS[difficulty])
    writeDifficulty(difficulty)
  }

  get nextChapterIndex(): number {
    return Math.min(CHAPTERS.length - 1, this.chapterIndex + 1)
  }

  start(chapterIndex = this.chapterIndex): void {
    window.clearTimeout(this.winTimer)
    this.tutorialMode = false
    this.hud.hideTutorialPrompt()
    this.loadChapter(chapterIndex)
    this.reset()
    this.running = true
    this.paused = false
    this.input.clear()
    this.hud.show()
    this.hud.hideOverlays()
    this.showCutscene()
    this.syncHud(true)
  }

  restart(): void {
    if (this.tutorialMode) {
      this.startTutorial()
      return
    }
    this.start(this.chapterIndex)
  }

  startTutorial(): void {
    window.clearTimeout(this.winTimer)
    this.tutorialMode = true
    this.tutorialStep = 0
    this.chapterIndex = 0
    this.chapter = TUTORIAL
    const data = this.chapter.data as LevelData
    this.map = new TileMap(data)
    this.player = new Player(this.map, data.spawn)
    this.goalX = (this.map.cols - 4) * TILE
    this.goalRow = this.findGoalRow(this.map.cols - 4)
    this.goalBaseY = this.goalRow * TILE
    this.reset()
    this.tutorialStartX = this.player.x
    this.running = true
    this.paused = false
    this.input.clear()
    this.hud.show()
    this.hud.hideOverlays()
    this.hud.showChapterCard('Tutorial', 'A Trilha', 'Aprenda os controles jogando.')
    this.hud.setChapter('Tutorial · A Trilha')
    this.hud.showTutorialPrompt(TUTORIAL_STEPS[0])
    this.syncHud(true)
  }

  private updateTutorial(): void {
    if (!this.tutorialMode || this.dying > 0 || this.won) return
    const player = this.player
    let done = false

    switch (this.tutorialStep) {
      case 0:
        done = player.x > this.tutorialStartX + TILE * 4
        break
      case 1:
        done = player.justJumped
        break
      case 2:
        done = player.justAttacked
        break
      case 3:
        done = player.justThrew
        break
      case 4:
        done = this.collected >= 1
        break
      case 5:
        done = false // completar o tutorial normalmente
        break
      case 6:
        // Perry step - verifica se o jogador apertou F para bloquear
        // ou se o índio está no estado parry
        if (this.input.parryPressed) {
          done = true // Jogador ativou o Perry com a tecla F
        }
        const indio = this.enemies.find((e) => e.kind === 'indio')
        if (indio && indio.animator.state === 'parry') {
          done = true // Perry ativado automaticamente
        }
        break
      default:
        return
    }

    if (done) {
      this.tutorialStep = Math.min(this.tutorialStep + 1, TUTORIAL_STEPS.length - 1)
      this.hud.showTutorialPrompt(TUTORIAL_STEPS[this.tutorialStep])
    }
  }

  nextChapter(): void {
    this.start(this.nextChapterIndex)
  }

  // Cutcines: uma cena narrativa no início de cada capítulo. O jogador avança
  // com Espaço/Enter/J; a ação fica pausada até a última fala.
  private showCutscene(): void {
    const cut = this.chapter.cutscene
    this.cutsceneLines = cut.lines
    this.cutsceneLine = 0
    this.cutsceneView.show(this.chapter.kicker, cut.title, cut.lines)
  }

  private get inCutscene(): boolean {
    return this.cutsceneLines.length > 0
  }

  private advanceCutscene(): void {
    if (this.cutsceneLine < this.cutsceneLines.length - 1) {
      this.cutsceneLine += 1
      this.cutsceneView.setLine(this.cutsceneLine)
      return
    }

    this.cutsceneLines = []
    this.cutsceneView.hide()
    this.hud.show()
    this.hud.showChapterCard(
      this.chapter.kicker,
      shortTitle(this.chapter.data.name),
      this.chapter.data.subtitle ?? '',
    )
    if (!this.hinted) {
      this.hinted = true
      this.hud.showControlsHint()
    }
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
    this.tutorialMode = false
    this.cutsceneLines = []
    this.cutsceneView.hide()
    this.hud.hideTutorialPrompt()
    this.reset()
    this.hud.hide()
    this.hud.hideOverlays()
  }

  reset(): void {
    this.input.clear()
    this.player.hp = MAX_HP
    this.player.respawn()
    this.spawnEnemies()
    this.clearCombatState()
    this.dying = 0
    this.deathMessage = ''
    this.won = false
    this.goalHintCooldown = 0
    this.runTime = 0
    this.effects.clear()
    this.animator.reset()
    this.camera.snapTo(this.player.hurtbox, this.map.width, this.map.height)
    this.hud.resetHp()
    this.syncHud(true)
  }

  // Recria todos os inimigos da fase. Chamado no início e a cada morte:
  // morrer devolve Sand ao começo e o campo volta ao estado original.
  private spawnEnemies(): void {
    this.enemies = this.chapter.data.entities
      .filter((entity) => entity.type === 'enemy')
      .map((entity) => {
        const enemy = new Enemy(entity, TILE, this.chapterIndex + 1)
        const diff = this.difficulty
        enemy.setSpeedScale(DELTAS.speed[diff] || 1)
        enemy.setHealthScale(DELTAS.enemies[diff] || 1)
        return enemy
      })
  }

  // Limpa estados de combate que podem sobrar de uma morte ou de um golpe.
  private clearCombatState(): void {
    this.shots = []
    this.spears = []
    this.dashGhosts.length = 0
    this.dashGhostTimer = 0
    this.hitStop = 0
    this.landSquash = 0
    this.parryTimer = 0
    this.riposte = 0
    this.combo = 0
    this.comboTimer = 0
    this.damageFlash = 0
    this.killFlash = 0
    this.deathDust.clear()
  }

  update = (dt: number): void => {
    const safeDt = Math.min(dt, 1 / 30)

    // Congelamento curtíssimo no impacto: o golpe "pesa" sem travar o jogo.
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - safeDt)
      this.input.endFrame()
      return
    }

    // Sistema de parry ativado no loop do jogador (abaixo).
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

    // Cutcine: a ação fica suspensa; Espaço/Enter/J avança as falas.
    if (this.inCutscene) {
      if (this.input.jumpPressed || this.input.attackPressed) {
        this.advanceCutscene()
      }
      this.input.endFrame()
      return
    }

    if (this.dying > 0) {
      this.dying = Math.max(0, this.dying - safeDt)
      // A câmera continua seguindo Sand enquanto ele cai: a animação de
      // morte nunca fica fora da tela.
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
      this.restart()
      this.input.endFrame()
      return
    }

    this.runTime += safeDt
    this.goalHintCooldown = Math.max(0, this.goalHintCooldown - safeDt)
    const player = this.player
    player.update(safeDt, this.input)

    // Parry do jogador (F): janela curta de bloqueio. Se um golpe chegar nela,
    // o inimigo fica atordoado e o próximo ataque é um riposte (dano dobrado).
    if (this.input.parryPressed && this.parryTimer <= 0 && this.riposte <= 0 && player.hurt <= 0) {
      this.parryTimer = 0.34
      sfx.guard()
      this.effects.ring(player.x + player.w / 2, player.y + 12, '#ffe9a8')
      this.effects.burst(player.x + player.w/2, player.y + 10, 'spark', 5, 26)
    }
    if (this.parryTimer > 0) this.parryTimer = Math.max(0, this.parryTimer - safeDt)
    if (this.riposte > 0) this.riposte = Math.max(0, this.riposte - safeDt)
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - safeDt)
      if (this.comboTimer === 0) this.combo = 0
    }

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
      // Faísca no ar acompanha o avanço da lança, mesmo sem acertar ninguém.
      this.effects.slash(
        player.x + player.w / 2 + player.facing * 14,
        player.y + player.h * 0.45,
        player.facing,
      )
      this.effects.burst(
        player.x + player.w / 2 + player.facing * 20,
        player.y + player.h * 0.48,
        'spark',
        3,
        20,
      )
    }
    if (player.justThrew) {
      this.spawnSpear()
    }
    if (player.justLanded) {
      this.landSquash = LAND_SQUASH_TIME
      this.effects.burst(player.x + player.w / 2, player.y + player.h, 'dust', 6, 30)
      this.effects.addShake(Math.min(2.2, player.landingSpeed / 220))
    }
    this.landSquash = Math.max(0, this.landSquash - safeDt)
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

        for (const enemy of this.enemies) {
      enemy.update(safeDt, this.map, player.hurtbox)
      if (!enemy.alive) continue

      // O índio levanta o machado quando o Sand ataca por perto (defesa
      // reativa, sem som nem luz piscando).
      if (enemy.kind === 'indio' && enemy.guardTimer <= 0 && enemy.counterWindow <= 0) {
        const dx = Math.abs(player.x + player.w / 2 - (enemy.x + enemy.w / 2))
        if (player.attack > 0 && dx < 34) enemy.startGuard()
      }

      if (enemy.justShot) this.spawnShot(enemy)
      if (enemy.justStruck) {
        this.effects.slash(
          enemy.x + enemy.w / 2 + enemy.facing * 10,
          enemy.y + enemy.h * 0.42,
          enemy.facing,
        )
      }

      // Poeira dos passos: só quando o colono realmente anda.
      if (enemy.alive && enemy.onGround && Math.abs(enemy.vx) > 8 && Math.random() < 0.09) {
        this.effects.trail(enemy.x + enemy.w / 2, enemy.y + enemy.h - 1, 'dust')
      }

      // O zumbi pinga o que escorre dele.
      if (enemy.isZombie && enemy.alive && Math.random() < 0.03) {
        this.effects.burst(enemy.x + enemy.w / 2, enemy.y + 5, 'ooze', 2, 14)
      }

      // Parry (Sons of Sparta): qualquer ameaça que encoste no Sand durante a
      // janela é desviada. Nos primeiros 0,14s é PERFECT (riposte + dano x2);
      // depois ainda bloqueia, mas sem contra-ataque.
      if (this.parryTimer > 0 && enemy.alive) {
        const threat =
          overlaps(enemy.attackBox, player.hurtbox) ||
          overlaps(enemy.rect, player.hurtbox)
        if (threat) {
          const perfect = this.parryTimer > 0.14
          this.parryTimer = 0
          if (perfect) {
            this.riposte = 1.5
            enemy.stun(1.1)
            sfx.guard()
            this.effects.addShake(3.6)
            this.effects.ring(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#ffd166')
            this.effects.burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 'spark', 16, 72)
            this.effects.text(enemy.x + enemy.w / 2, enemy.y - 8, 'PERFECT PARRY!', '#ffe9a8')
          } else {
            this.effects.addShake(1.6)
            this.effects.ring(player.x + player.w / 2, player.y + 12, '#c9d6c9')
            this.effects.burst(player.x + player.w/2, player.y + 10, 'spark', 6, 30)
            this.effects.text(player.x + player.w/2, player.y - 6, 'BLOCK', '#c9d6c9')
          }
          player.invuln = 0.4
          continue
        }
      }

      // Índio: defesa com machado. Quando o jogador ataca e o índio está em
      // guarda, o golpe é desviado (sem dano) e ele contra-ataca em seguida.
      if (enemy.kind === 'indio' && enemy.isGuarding && enemy.invuln <= 0) {
        if (player.attackActive && overlaps(player.attackBox, enemy.rect)) {
          enemy.blockedByGuard()
          enemy.invuln = 0.25
          this.effects.burst(enemy.x + enemy.w / 2, enemy.y + 10, 'spark', 6, 30)
          this.effects.text(enemy.x + enemy.w / 2, enemy.y - 4, 'BLOQUEADO', '#c9d6c9')
          continue
        }
      }

      if (enemy.justStruck && overlaps(enemy.attackBox, player.hurtbox)) {
        if (enemy.isZombie) {
          this.zombieBite(enemy)
          this.input.endFrame()
          return
        }
        if (this.hurtPlayer(enemy.x, 'blade', enemy.attackDamage)) {
          this.effects.addShake(2.6)
          this.effects.burst(
            player.x + player.w / 2,
            player.y + player.h / 2,
            'blade',
            9,
            46,
          )
        }
      }

      if (
        player.attackActive &&
        enemy.invuln <= 0 &&
        overlaps(player.attackBox, enemy.rect)
      ) {
        this.damageEnemy(enemy, 1, player.x, 'blade')
        continue
      }

      if (overlaps(player.hurtbox, enemy.rect)) {
        if (enemy.isZombie) {
          // A mordida só mata quando o ataque está ativo — e o parry já foi
          // checado acima. Encostar de leve não é morte instantânea.
          if (enemy.justStruck || enemy.isAttacking) {
            this.zombieBite(enemy)
            this.input.endFrame()
            return
          }
        } else if (this.parryTimer <= 0) {
          this.hurtPlayer(enemy.x, 'blade', enemy.attackDamage)
        }
      }
    }

    this.updateInfections()

    this.updateShots(safeDt)
    this.updateSpears(safeDt)

        // A morte é verificada antes de qualquer interior: sem isso, cair com
    // vida zerada deixava Sand congelado.
    if (player.hp <= 0) {
      this.beginDeath('Sandman caiu — a floresta o chama de volta.')
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
      this.beginDeath('Sandman caiu — a floresta o chama de volta.')
      this.input.endFrame()
      return
    }

    const locked = this.goalLocked
    if (locked && player.x + player.w >= this.goalX) {
      player.x = this.goalX - player.w
      player.vx = Math.min(0, player.vx)
      if (this.goalHintCooldown <= 0) {
        this.goalHintCooldown = 2.2
        this.effects.text(
          this.goalX + TILE / 2,
          this.goalBaseY - 54,
          'O caminho ainda está fechado.',
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

    this.updateTutorial()
    this.updateAnimator(safeDt)
    this.updateDashGhosts(safeDt)
    this.syncHud()
    this.input.endFrame()
  }

  // O rastro do dash é só cosmético, mas dá a leitura de velocidade que
  // faltava: uma fileira de Sand que se apaga atrás do corpo.
  private updateDashGhosts(dt: number): void {
    for (let i = this.dashGhosts.length - 1; i >= 0; i -= 1) {
      const ghost = this.dashGhosts[i]
      ghost.life -= dt
      if (ghost.life <= 0) this.dashGhosts.splice(i, 1)
    }

    if (this.player.dash <= 0) {
      this.dashGhostTimer = 0
      return
    }

    this.dashGhostTimer -= dt
    if (this.dashGhostTimer > 0) return
    this.dashGhostTimer = 0.035
    this.dashGhosts.push({
      x: this.player.x,
      y: this.player.y,
      facing: this.player.facing,
      life: 0.22,
      max: 0.22,
      sprite: this.animator.frame,
    })
  }

  render = (): void => {
    const bosses = this.enemies.filter((enemy) => enemy.isBoss && enemy.alive)
    const boss = bosses.sort((a, b) => b.maxHp - a.maxHp)[0]
    if (boss) this.hud.setBoss(boss.label, boss.hp, boss.maxHp)
    else this.hud.hideBoss()

    const time = performance.now() / 1000
    const shake = this.effects.shake
    const shakeX = shake > 0 ? Math.round((Math.random() * 2 - 1) * shake) : 0
    const shakeY = shake > 0 ? Math.round((Math.random() * 2 - 1) * shake) : 0

    ctx.save()
    ctx.translate(shakeX, shakeY)

    drawBackground(
      ctx,
      this.camera.px,
      time,
      this.chapter.bg,
      this.isNight,
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
      this.chapter.data.terrain,
    )

    ctx.fillStyle = this.chapter.tint
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    // À noite a floresta recebe um véu azul: o luar entra, a cor some.
    if (this.isNight) {
      const veil = ctx.createLinearGradient(0, 0, 0, VIEW_H)
      veil.addColorStop(0, 'rgba(18, 28, 66, 0.16)')
      veil.addColorStop(0.55, 'rgba(16, 26, 60, 0.09)')
      veil.addColorStop(1, 'rgba(8, 14, 38, 0.18)')
      ctx.fillStyle = veil
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    }

        for (const enemy of this.enemies) {
      if (enemy.visible) this.paintEnemy(enemy, time)
    }

    this.paintShots(time)
    this.paintSpears(time)
    this.paintDashGhosts()
    this.paintPlayer(time)

    this.effects.render(ctx, {
      x: this.camera.px,
      y: this.camera.py,
      w: VIEW_W,
      h: VIEW_H,
    })

    // Combo: contador estilo Sons of Sparta, some quando o timer acaba.
    if (this.combo >= 2 && this.comboTimer > 0) {
      ctx.save()
      const alpha = Math.min(1, this.comboTimer)
      const scale = 1 + Math.sin(time * 12) * 0.04 + (this.combo - 2) * 0.03
      ctx.globalAlpha = alpha
      ctx.translate(VIEW_W - 44, 54)
      ctx.scale(scale, scale)
      ctx.textAlign = 'right'
      ctx.font = 'bold 16px "Courier New", monospace'
      ctx.fillStyle = '#1a110a'
      ctx.fillText(`${this.combo}x`, 2, 2)
      ctx.fillStyle = this.combo >= 5 ? '#ff6b5c' : this.combo >= 3 ? '#ff9f43' : '#ffd166'
      ctx.fillText(`${this.combo}x`, 0, 0)
      ctx.font = 'bold 6px "Courier New", monospace'
      ctx.fillStyle = '#fff1dd'
      ctx.fillText('COMBO', 0, 9)
      ctx.restore()
    }

    ctx.restore()
    this.paintGrade()
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
      totalMemories: 0,
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
      total: 0,
      seconds: this.runTime,
      allMemories: false,
      chapterIndex: this.chapterIndex,
      chapterName: shortTitle(this.chapter.data.name),
      endText: this.chapter.endText,
      nextChapter: this.chapterIndex < CHAPTERS.length - 1,
    }
  }

  private get goalLocked(): boolean {
    return this.chapter.lockGoalUntilBoss && this.enemies.some((enemy) => enemy.isBoss && enemy.alive)
  }

  private get collected(): number {
    return 0
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
      else if (this.parryTimer > 0 || this.riposte > 0) state = 'guard'
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
    weapon: 'blade' | 'spear' = 'blade',
  ): void {
    const cx = enemy.x + enemy.w / 2
    const cy = enemy.y + enemy.h / 2
    // Riposte: golpe após parry bem-sucedido causa dano dobrado.
    const riposteHit = this.riposte > 0
    // Combo: cada acerto aumenta o dano um pouco (até +50% no 5º golpe).
    const comboBonus = 1 + Math.min(0.5, this.combo * 0.1)
    const dealt = Math.round((amount * comboBonus) * (riposteHit ? 2 : 1))
    if (riposteHit) {
      this.riposte = 0
      this.effects.text(cx, cy - 8, 'RIPOSTE!', '#ff9f43')
      this.effects.addShake(3)
    }
    this.combo += 1
    this.comboTimer = 2.4
    const killed = enemy.damage(dealt, fromX)
    const dir = fromX < cx ? 1 : -1
    // Cada arma pinta o impacto do seu jeito.
    const impact = weapon === 'spear' ? 'spear' : 'blade'
    this.effects.burst(cx, cy, killed ? 'death' : impact, killed ? 16 : 10, killed ? 70 : 48)
    // Sangue jorra na direção do golpe: combate com peso, estilo Sons of Sparta.
    this.effects.bloodSpray(cx, cy, dir, killed ? 18 : 9)
    if (killed) this.killFlash = 1
    this.effects.addShake(killed ? 3.6 : 1.8)
    // Pausa no impacto: mais peso quando o golpe derruba o inimigo.
    this.hitStop = Math.max(this.hitStop, killed ? 0.085 : 0.05)

    if (!killed) {
      this.effects.text(cx, enemy.y - 3, 'ACERTO!', '#ffb38a')
      sfx.hit()
      return
    }

    sfx.stomp()
    this.effects.text(
      cx,
      enemy.y - 3,
      enemy.isBoss ? `${enemy.label.toUpperCase()} CAIU!` : 'ABATIDO!',
      enemy.isBoss ? '#ffd166' : '#ffe9a8',
    )
  }

  // A mordida do zumbi mata Sand na hora: não é dano, é fim de fase.
  private zombieBite(zombie: Enemy): void {
    if (this.dying > 0 || this.won) return
    const cx = this.player.x + this.player.w / 2
    const cy = this.player.y + this.player.h / 2
    this.beginDeath('Mordida de zumbi — Sandman não resistiu.')
    this.damageFlash = 1
    this.effects.burst(cx, cy, 'death', 20, 76)
    this.effects.burst(
      zombie.x + zombie.w / 2,
      zombie.y + zombie.h / 2,
      'hit',
      10,
      48,
    )
    this.effects.addShake(6)
    sfx.hit()
  }

  // Zumbi encostou em colono armado → o colono vira zumbi.
  private updateInfections(): void {
    for (const zombie of this.enemies) {
      if (!zombie.alive || !zombie.isZombie) continue
      for (const other of this.enemies) {
        if (other === zombie || !other.alive || other.isZombie) continue
        if (!isArmedColonist(other.kind)) continue
        if (!overlaps(zombie.rect, other.rect)) continue
        if (!other.convertToZombie()) continue

        const cx = other.x + other.w / 2
        const cy = other.y + other.h / 2
        this.effects.burst(cx, cy, 'death', 14, 62)
        this.effects.burst(cx, other.y + other.h, 'dust', 8, 36)
        this.effects.text(cx, other.y - 4, 'INFECTADO!', '#a8e063')
        this.effects.addShake(2.4)
        sfx.hit()
      }
    }
  }

  private hurtPlayer(fromX: number, kind: 'bullet' | 'blade' = 'bullet', damage: number = 1): boolean {    const diff = this.difficulty as 'facil' | 'normal' | 'dificil'
    const finalDamage = Math.max(1, Math.round(damage * DELTAS.damage[diff]))
    const before = this.player.hp
    this.player.hit(fromX, finalDamage)
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
        this.damageEnemy(hitEnemy, hitEnemy.isBoss ? 1 : 2, spear.x, 'spear')
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
      this.effects.text(splashX, splashY - 20, 'Sandman respira de novo.', '#ffd166')
    }
    this.player.respawn()
    this.shots = []
    this.animator.reset()
    this.camera.snapTo(this.player.hurtbox, this.map.width, this.map.height)
    this.syncHud(true)
  }

  private beginDeath(message: string): void {
    this.dying = 1.05
    this.deathMessage = message
    this.player.hp = 0
    this.player.vx = 0
    this.player.attack = 0
    this.player.throw = 0
    this.clearCombatState()
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
    this.spawnEnemies()
    this.clearCombatState()
    this.animator.reset()
    this.effects.clear()
    this.effects.text(Math.max(60, x), Math.max(40, y), message, '#ffd166')
    this.camera.snapTo(this.player.hurtbox, this.map.width, this.map.height)
    this.syncHud(true)
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
    if (this.tutorialMode) {
      stats.kicker = 'Tutorial'
      stats.chapterName = 'Tutorial concluído!'
      stats.endText = this.chapter.endText
      stats.nextChapter = false
    }

    window.clearTimeout(this.winTimer)
    this.winTimer = window.setTimeout(() => {
      this.onWin?.(stats)
    }, WIN_DELAY)
  }

  private syncHud(force = false): void {
    const total = 0
    const key = `${this.player.hp}:${this.collected}:${total}`
    if (!force && key === this.hudKey) return
    this.hudKey = key
    this.hud.render(this.player.hp)
  }

  private paintEnemy(enemy: Enemy, time: number): void {
    const sprite = enemy.animator.frame
    const scale = enemy.visualScale * enemyScale(enemy)
    const walking = enemy.alive && Math.abs(enemy.vx) > 4
    // Andar balança o corpo; parado, o colono só respira.
    const bob = enemy.alive
      ? walking
        ? Math.round(Math.sin(time * 10 + enemy.x * 0.25))
        : Math.round(Math.sin(time * 2.1 + enemy.x * 0.07) * 0.6)
      : 0
    // Quem avança inclina o corpo para a frente.
    const lean = walking ? (enemy.vx > 0 ? 1 : -1) : 0
    const feetX = Math.round(enemy.x + enemy.w / 2 - this.camera.px)
    const shadowY = Math.round(enemy.y + enemy.h - this.camera.py)
    const feetY = shadowY - bob

    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)'
    ctx.fillRect(feetX - 7, shadowY - 2, 14, 2)

    if (enemy.isBoss && enemy.alive) {
      const aura = ctx.createRadialGradient(feetX, feetY - 18, 2, feetX, feetY - 18, 34)
      aura.addColorStop(0, 'rgba(196, 71, 58, 0.16)')
      aura.addColorStop(1, 'rgba(196, 71, 58, 0)')
      ctx.fillStyle = aura
      ctx.fillRect(feetX - 36, feetY - 54, 72, 58)
    }

    // Aura doentia ao redor dos zumbis vivos.
    if (enemy.isZombie && enemy.alive) {
      const pulse = 0.8 + Math.sin(time * 2.6 + enemy.x * 0.05) * 0.2
      const aura = ctx.createRadialGradient(feetX, feetY - 16, 2, feetX, feetY - 16, 26)
      aura.addColorStop(0, `rgba(132, 186, 74, ${0.16 * pulse})`)
      aura.addColorStop(1, 'rgba(132, 186, 74, 0)')
      ctx.fillStyle = aura
      ctx.fillRect(feetX - 28, feetY - 44, 56, 48)
    }

    const flash = enemy.invuln > 0 && Math.floor(enemy.invuln * 28) % 2 === 0
    if (flash) ctx.globalAlpha = 0.55

    if (sprite) {
      if (!enemy.alive) {
        // Queda: solavanco no impacto e pausa com o corpo no chão, sem girar
        // o sprite (os quadros de morte já carregam a queda).
        const progress = Math.min(1, enemy.deathProgress)
        ctx.save()
        ctx.translate(feetX, feetY)
        const kick = Math.sin(Math.min(1, progress * 3.2) * Math.PI) * 3
        ctx.translate(-enemy.facing * kick, 0)
        ctx.imageSmoothingEnabled = false
        if (progress < 0.18) {
          ctx.globalAlpha = (1 - progress / 0.18) * 0.85
          ctx.drawImage(sprite.white, Math.round(-sprite.ax * scale), Math.round(-sprite.ay * scale), Math.max(1, Math.round(sprite.w * scale)), Math.max(1, Math.round(sprite.h * scale)))
        }
        ctx.globalAlpha = progress < 0.72 ? 1 : Math.max(0, 1 - (progress - 0.72) / 0.28)
        this.drawSprite(sprite, -sprite.ax * scale, -sprite.ay * scale, scale, 0)
        ctx.restore()
        ctx.globalAlpha = 1
        // Impacto no chão: poeira + respingo de sangue (estilo Sons of Sparta).
        if (progress >= 0.42 && progress < 0.52 && !this.deathDust.has(enemy)) {
          this.deathDust.add(enemy)
          this.effects.burst(feetX, feetY, 'dust', 8, 30)
          this.effects.bloodSpray(feetX, feetY - 4, enemy.facing, 10)
          this.effects.addShake(1.2)
        }
      } else if (enemy.facing < 0) {
        ctx.save()
        ctx.translate(feetX, 0)
        ctx.scale(-1, 1)
        this.drawSprite(sprite, -sprite.ax * scale + lean, feetY - sprite.ay * scale, scale, 0.2)
        ctx.restore()
      } else {
        const dx = feetX - sprite.ax * scale + lean
        const dy = feetY - sprite.ay * scale
        this.drawSprite(sprite, dx, dy, scale, 0.2)
      }
    } else {
      this.paintFallbackColonist(feetX, feetY, scale, enemy.facing)
    }

    // Rastro do golpe corpo a corpo: uma lasca clara que sai da arma no
    // instante do impacto, para o ataque ficar legível na mata escura.
    if (enemy.justStruck && enemy.alive) {
      const dir = enemy.facing
      const sx = feetX + dir * 11
      const sy = feetY - 17
      ctx.save()
      if (sprite) {
        ctx.globalAlpha = 0.32
        ctx.drawImage(
          sprite.white,
          Math.round(feetX - sprite.ax * scale),
          Math.round(feetY - sprite.ay * scale),
          Math.max(1, Math.round(sprite.w * scale)),
          Math.max(1, Math.round(sprite.h * scale)),
        )
      }
      ctx.globalAlpha = 0.8
      ctx.fillStyle = '#fff0c4'
      for (let i = 0; i < 4; i += 1) {
        ctx.fillRect(Math.round(sx + dir * i * 2), Math.round(sy - i), 2, 1)
      }
      ctx.globalAlpha = 0.35
      ctx.fillStyle = '#ffd166'
      ctx.fillRect(Math.round(sx + dir * 6), Math.round(sy - 4), 3, 1)
      ctx.restore()
    }

    ctx.globalAlpha = 1

    // Olho do zumbi: um brilho doente que acompanha a cabeça.
    if (enemy.isZombie && enemy.alive && sprite) {
      const headY = feetY - sprite.ay * scale + 6
      const headX = feetX + enemy.facing * 3
      const glow = ctx.createRadialGradient(headX, headY, 0.5, headX, headY, 6)
      const pulse = 0.55 + Math.sin(time * 4.4 + enemy.x * 0.11) * 0.25
      glow.addColorStop(0, `rgba(168, 224, 99, ${0.3 * pulse})`)
      glow.addColorStop(1, 'rgba(168, 224, 99, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(headX - 6, headY - 6, 12, 12)
      ctx.globalAlpha = 0.7 + pulse * 0.3
      ctx.fillStyle = '#d8f79a'
      ctx.fillRect(headX + enemy.facing, headY - 1, 1, 1)
      ctx.fillRect(headX + enemy.facing * 3, headY - 1, 1, 1)
      ctx.globalAlpha = 1
    }

    // Fagulha da arma no instante do disparo.
    if (enemy.justShot) {
      const origin = enemy.shotOrigin
      const flashX = Math.round(origin.x - this.camera.px)
      const flashY = Math.round(origin.y - this.camera.py)
      const muzzle = ctx.createRadialGradient(flashX, flashY, 0.5, flashX, flashY, 12)
      muzzle.addColorStop(0, 'rgba(255, 244, 198, 0.85)')
      muzzle.addColorStop(0.4, 'rgba(255, 186, 84, 0.5)')
      muzzle.addColorStop(1, 'rgba(255, 159, 67, 0)')
      ctx.fillStyle = muzzle
      ctx.fillRect(flashX - 12, flashY - 12, 24, 24)
    }

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

  private paintDashGhosts(): void {
    const player = this.player
    for (const ghost of this.dashGhosts) {
      if (!ghost.sprite) continue
      const alpha = (ghost.life / ghost.max) * 0.28
      if (alpha <= 0.01) continue
      const feetX = Math.round(ghost.x + player.w / 2 - this.camera.px)
      const feetY = Math.round(ghost.y + player.h - this.camera.py)
      const dy = feetY - ghost.sprite.ay * SPRITE_SCALE
      ctx.globalAlpha = alpha
      if (ghost.facing < 0) {
        ctx.save()
        ctx.translate(feetX, 0)
        ctx.scale(-1, 1)
        this.drawSprite(ghost.sprite, -ghost.sprite.ax * SPRITE_SCALE, dy, SPRITE_SCALE)
        ctx.restore()
      } else {
        this.drawSprite(
          ghost.sprite,
          feetX - ghost.sprite.ax * SPRITE_SCALE,
          dy,
          SPRITE_SCALE,
        )
      }
    }
    ctx.globalAlpha = 1
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

    // Defesa com o cajado: uma haste diagonal na frente do Sand, com faíscas
    // no perfect parry. Sem escudo mágico — é o tacape que desvia o golpe.
    if (this.parryTimer > 0) {
      const t = this.parryTimer / 0.34
      const perfect = t > 0.45
      ctx.save()
      ctx.translate(feetX, feetY - 14)
      ctx.scale(player.facing, 1)
      // Cajado erguido na diagonal, apoio no ombro.
      ctx.rotate(-0.5)
      ctx.globalAlpha = 0.75 + t * 0.25
      ctx.fillStyle = '#6b4526'
      ctx.fillRect(-2, -16, 4, 30)
      ctx.fillStyle = perfect ? '#ffe9a8' : '#a8845c'
      ctx.fillRect(-3, -18, 6, 5)
      ctx.fillStyle = perfect ? '#fff6d0' : '#c9a36a'
      ctx.fillRect(-2, -18, 2, 3)
      ctx.restore()
      if (perfect) {
        ctx.globalAlpha = (t - 0.45) * 1.4
        ctx.fillStyle = '#fff6d0'
        for (let i = 0; i < 3; i += 1) {
          const sx = feetX + player.facing * (10 + i * 4)
          const sy = feetY - 26 - i * 3
          ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2)
        }
        ctx.globalAlpha = 1
      }
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)'
    ctx.fillRect(feetX - 8, feetY - 2, 16, 2)
    ctx.fillRect(feetX - 5, feetY, 10, 1)

    if (blink) ctx.globalAlpha = 0.5

    // Luz de fogueira atrás de Sandro: separa a silhueta do chão escuro sem
    // desenhar um contorno artificial.
    const backlight = ctx.createRadialGradient(feetX, feetY - 18, 2, feetX, feetY - 18, 24)
    backlight.addColorStop(0, 'rgba(255, 189, 108, 0.16)')
    backlight.addColorStop(0.55, 'rgba(235, 132, 54, 0.07)')
    backlight.addColorStop(1, 'rgba(200, 90, 30, 0)')
    ctx.fillStyle = backlight
    ctx.fillRect(feetX - 24, feetY - 42, 48, 44)

    // Espremer e esticar: Sand afunda ao aterrissar e se estica na subida.
    const squash = this.landSquash > 0 ? this.landSquash / LAND_SQUASH_TIME : 0
    const rising = !player.onGround && player.vy < -50
    const scaleY = 1 + squash * 0.2 - (rising ? 0.07 : 0)
    const scaleX = 1 - squash * 0.16 + (rising ? 0.05 : 0)

    if (sprite) {
      const dy = feetY - sprite.ay * SPRITE_SCALE
      ctx.save()
      ctx.translate(feetX, feetY)
      ctx.scale(scaleX, scaleY)
      ctx.translate(-feetX, -feetY)
      if (player.facing < 0) {
        ctx.save()
        ctx.translate(feetX, 0)
        ctx.scale(-1, 1)
        this.drawSprite(sprite, -sprite.ax * SPRITE_SCALE, dy, SPRITE_SCALE, 0, 0.18)
        ctx.restore()
      } else {
        this.drawSprite(sprite, feetX - sprite.ax * SPRITE_SCALE, dy, SPRITE_SCALE, 0, 0.18)
      }
      ctx.restore()
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
    rimAlpha = 0,
  ): void {
    const px = Math.round(x)
    const py = Math.round(y)
    const w = Math.max(1, Math.round(sprite.w * scale))
    const h = Math.max(1, Math.round(sprite.h * scale))

    // Rim light: uma cópia clara deslocada 1 px atrás da silhueta. Só aparece
    // na borda e separa Sandro do fundo escuro sem contorno artificial.
    if (rimAlpha > 0) {
      ctx.globalAlpha = rimAlpha
      ctx.drawImage(sprite.white, px - 1, py - 1, w, h)
      ctx.globalAlpha = 1
    }

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

  // Color grading cinematográfico: menos saturação de desenho, contraste
  // maior, sombras azul-esverdeadas e luzes puxadas para o fogo/ocre.
  private paintGrade(): void {
    if (!gradeCtx || !canvas) return
    gradeCtx.clearRect(0, 0, VIEW_W, VIEW_H)
    gradeCtx.drawImage(canvas, 0, 0)

    ctx.clearRect(0, 0, VIEW_W, VIEW_H)
    ctx.save()
    ctx.filter = 'saturate(0.74) contrast(1.12) brightness(0.94)'
    ctx.drawImage(gradeCanvas, 0, 0)
    ctx.filter = 'none'

    ctx.globalCompositeOperation = 'soft-light'
    const tone = ctx.createLinearGradient(0, 0, 0, VIEW_H)
    tone.addColorStop(0, 'rgba(46, 78, 92, 0.42)')
    tone.addColorStop(0.5, 'rgba(28, 40, 34, 0.2)')
    tone.addColorStop(1, 'rgba(128, 74, 30, 0.34)')
    ctx.fillStyle = tone
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    // Escurece topo e base como uma lente antiga; o centro permanece legível.
    ctx.globalCompositeOperation = 'multiply'
    const shade = ctx.createLinearGradient(0, 0, 0, VIEW_H)
    shade.addColorStop(0, 'rgba(9, 15, 19, 0.4)')
    shade.addColorStop(0.42, 'rgba(255, 255, 255, 0)')
    shade.addColorStop(0.72, 'rgba(255, 255, 255, 0)')
    shade.addColorStop(1, 'rgba(20, 12, 8, 0.32)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.globalCompositeOperation = 'source-over'
    ctx.restore()
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
    gradient.addColorStop(1, 'rgba(2, 4, 5, 0.52)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)

    const bottom = ctx.createLinearGradient(0, VIEW_H - 40, 0, VIEW_H)
    bottom.addColorStop(0, 'rgba(0, 0, 0, 0)')
    bottom.addColorStop(1, 'rgba(0, 0, 0, 0.28)')
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
  onTutorial: () => {
    sfx.unlock()
    sfx.click()
    game.startTutorial()
    screens.hideAll()
  },
  onDifficulty: (difficulty: Difficulty) => {
    sfx.unlock()
    sfx.click()
    game.setDifficulty(difficulty)
    screens.setDifficultySelection(difficulty)
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
    detail: chapter.detail,
  })),
)

// Reflete no menu a dificuldade salva da última partida.
screens.setDifficultySelection(readDifficulty())

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
  if (view === 'how' || view === 'credits' || view === 'difficulty') {
    document.querySelector<HTMLButtonElement>(`[data-action="${view === 'difficulty' ? 'difficulty-screen' : view}"]`)?.click()
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
