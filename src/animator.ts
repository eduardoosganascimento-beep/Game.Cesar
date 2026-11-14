// Animation clips for sprites — Player, Colonists, Indigenous, Wolf
// Todos os quadros usados aqui estão desenhados virados para a direita.
// O jogo espelha o desenho quando Sand anda para a esquerda.
// Cada linha da nova folha usa apenas os quadros coerentes de um mesmo movimento,
// então o personagem nunca troca de lado no meio do ciclo.

import { type Sprite, getFrame, getColonistFrame, getIndioFrame, getWolfFrame, getZombieFrame } from './sprites'

export type Clip = {
  frames: readonly string[]
  fps: number
  loop: boolean
}

export type ClipName = 'idle' | 'run' | 'jump' | 'fall' | 'attack' | 'throw' | 'hurt' | 'death'
export type EnemyClipName = 'idle' | 'walk' | 'shoot' | 'slash' | 'hurt' | 'death'

// ============================================================
// CLIPS DO PLAYER (Sand)
// ============================================================
// As animações foram desenhadas para terem o mesmo height em todos os quadros,
// o que garante que o personagem não "piscale" ou mude de tamanho ao animar.
// A sequência de frames mantém a mesma ordem da folha de sprites original.

export const PLAYER_CLIPS: Record<ClipName, Clip> = {
  // Idle: 7 quadros, lenta, looping.
  idle: { frames: ['idle-1', 'idle-2', 'idle-3', 'idle-4', 'idle-5', 'idle-6', 'idle-7'], fps: 5, loop: true },
  // Corrida: 7 quadros a 13 fps → ~0,54s por ciclo. FPS mantido em 13 para
  // consistência com a folha original, mas o setTimeScale no main.js varia a
  // velocidade conforme o abs(vx), fazendo o compasso acelerar/decelerar suavemente.
  run: { frames: ['run-1', 'run-2', 'run-3', 'run-4', 'run-5', 'run-6', 'run-7'], fps: 13, loop: true },
  // Pulo: 3 quadros, não looping. O jogador fica no quadro final (pico do pulo).
  jump: { frames: ['jump-1', 'jump-2', 'jump-3'], fps: 10, loop: false },
  // Queda: apenas o quadro 4 da folha (pós-pico do pulo).
  fall: { frames: ['jump-4'], fps: 1, loop: false },
  // Golpe (corpo a corpo com a lança): 5 quadros a 18 fps.
  attack: { frames: ['melee-1', 'melee-2', 'melee-3', 'melee-4', 'melee-5'], fps: 18, loop: false },
  // Arremesso de lança: 4 quadros a 13 fps.
  // O quadro 4 é o primeiro sem a lança na mão → esse é o quadro em que
  // o projétil é "disparado" (nasce o hitbox do projectile).
  throw: { frames: ['throw-1', 'throw-2', 'throw-3', 'throw-4'], fps: 13, loop: false },
  // Dano: 4 quadros a 10 fps.
  hurt: { frames: ['hurt-1', 'hurt-2', 'hurt-3', 'hurt-4'], fps: 10, loop: false },
  // Morte: 5 quadros a 7 fps, não looping. A animação termina no último frame.
  death: { frames: ['death-1', 'death-2', 'death-3', 'death-4', 'death-5'], fps: 7, loop: false },
}

// ============================================================
// CLIPS DOS COLESTAIS (Inimigos genéricos)
// ============================================================
export const COLONIST_CLIPS: Record<EnemyClipName, Clip> = {
  idle: { frames: ['idle-1', 'idle-2'], fps: 2.4, loop: true },
  walk: { frames: ['walk-1', 'walk-2', 'walk-3', 'walk-4'], fps: 9, loop: true },
  shoot: { frames: ['shoot-1', 'shoot-2', 'shoot-3'], fps: 9, loop: false },
  slash: {
    frames: ['slash-1', 'slash-2', 'slash-3', 'slash-4', 'slash-5', 'slash-6'],
    fps: 12,
    loop: false,
  },
  hurt: { frames: ['hurt-1'], fps: 1, loop: false },
  death: { frames: ['death-1', 'death-2', 'death-3', 'death-4'], fps: 6, loop: false },
}

// ============================================================
// CLIPS DO ÍNDIO (personagem indígena)
// ============================================================
// O índio usa o mesmo corpo comum da folha, mas nas poses de arma, pulo e
// combate que o desenho original separou do soldado. Os frames foram
// reordenados para seguir a mesma lógica dos clips do Sand (mesmo height,
// mesma ordem da folha), garantindo que a animação nunca quebre ou mude de
// posição no meio do ciclo.
export const INDIO_CLIPS: Record<EnemyClipName, Clip> = {
  // Idle: 2 quadros, bem devagar (2,4 fps) → o índio fica parado olhando.
  idle: { frames: ['idle-1', 'idle-2'], fps: 2.4, loop: true },
  // Caminhada/ corrida: usa a mesma seqüência de "run" do Sand (run-1..7),
  // mas a 12 fps. Isso dá uma sensação de perseguição constante.
  // O importante é que o height dos quadros de "run" seja idêntico ao do índio,
  // para evitar tiling/visualmente errado.
  walk: { frames: ['run-1', 'run-2', 'run-3', 'run-4', 'run-5', 'run-6', 'run-7'], fps: 12, loop: true },
  // Ataque à distância (lança): usa frames de "throw" da folha, adaptados.
  // A seqüência throw-1..throw-5+throw-6 foi ajustada para que o quadro de
  // soltura da lança esteja no lugar correto (mesma lógica do jogador).
  shoot: { frames: ['throw-1', 'throw-2', 'throw-3', 'throw-5', 'throw-6'], fps: 12, loop: false },
  // Golpe corpo a corpo (machado/lâmina): usa a seqüência melee-1..5.
  slash: { frames: ['melee-1', 'melee-2', 'melee-3', 'melee-4', 'melee-5'], fps: 18, loop: false },
  // Hurt: 3 quadros, fps 10.
  hurt: { frames: ['hurt-2', 'hurt-3', 'hurt-4'], fps: 10, loop: false },
  // Morte: 5 quadros a 7 fps, igual ao do jogador.
  death: { frames: ['death-1', 'death-2', 'death-3', 'death-4', 'death-5'], fps: 7, loop: false },
}

// ============================================================
// CLIPS DO LOBO (Kennedy)
// ============================================================
export const WOLF_CLIPS: Record<EnemyClipName, Clip> = {
  idle: { frames: ['idle-1', 'idle-2'], fps: 2.6, loop: true },
  walk: { frames: ['walk-1', 'walk-2', 'walk-3', 'walk-4'], fps: 10, loop: true },
  shoot: { frames: ['slash-1', 'slash-2', 'slash-3', 'slash-4'], fps: 12, loop: false },
  slash: { frames: ['slash-1', 'slash-2', 'slash-3', 'slash-4'], fps: 13, loop: false },
  hurt: { frames: ['hurt-1', 'hurt-2'], fps: 8, loop: false },
  death: { frames: ['death-1', 'death-2', 'death-3', 'death-4'], fps: 6, loop: false },
}

// ============================================================
// CLIPS DO ZUMBI
// ============================================================
// A folha do zumbi tem 4 linhas: caminhada, passos lentos, ataque com os
// braços esticados e a mordida. O idle usa a segunda linha em ritmo lento
// para dar aquele balanço de morto-vivo.
export const ZOMBIE_CLIPS: Record<EnemyClipName, Clip> = {
  idle: { frames: ['idle-1', 'idle-2', 'idle-3', 'idle-4'], fps: 2.2, loop: true },
  walk: {
    frames: ['walk-1', 'walk-2', 'walk-3', 'walk-4', 'walk-5', 'walk-6', 'walk-7', 'walk-8'],
    fps: 9,
    loop: true,
  },
  shoot: {
    frames: ['attack-1', 'attack-2', 'attack-3', 'attack-4', 'attack-5', 'attack-6'],
    fps: 11,
    loop: false,
  },
  slash: {
    frames: ['attack-1', 'attack-2', 'attack-3', 'attack-4', 'attack-5', 'attack-6'],
    fps: 11,
    loop: false,
  },
  hurt: { frames: ['idle-1'], fps: 1, loop: false },
  death: { frames: ['bite-8'], fps: 1, loop: false },
}

// ============================================================
// ANIMADOR DE CLIPS (base para Sand, Colonista e Índio)
// ============================================================
export type ResolveSprite = (name: string) => Sprite | undefined

export type ClipOrName = Clip | string

export class SpriteClipAnimator {
  state: string

  private elapsed = 0
  private timeScale = 1
  private readonly initial: string

  constructor(
    private readonly clips: Record<string, Clip>,
    private readonly resolve: ResolveSprite,
    initialState: string,
    private readonly fallbackName?: string,
  ) {
    this.initial = initialState
    this.state = initialState
  }

  reset(): void {
    this.state = this.initial
    this.elapsed = 0
    this.timeScale = 1
  }

  play(state: string): void {
    if (state === this.state) return
    this.state = state
    this.elapsed = 0
    this.timeScale = 1
  }

  // A corrida acelera o compasso junto com a velocidade: os pés deixam de
  // deslizar quando o personagem está no arranque ou freando.
  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.35, Math.min(1.6, scale))
  }

  update(dt: number): void {
    this.elapsed += dt * this.timeScale
  }

  // Define a fase do loop da animação com base na distância percorrida.
  // Isso faz o "piscar" do pé ser evitado quando a velocidade muda.
  setLoopPhase(phase: number): void {
    const clip = this.clips[this.state] ?? this.clips[this.initial]
    if (!clip.loop || clip.frames.length === 0) return
    const normalized = ((phase % 1) + 1) % 1
    this.elapsed = normalized * (clip.frames.length / clip.fps)
  }

  get phase(): number {
    const clip = this.clips[this.state] ?? this.clips[this.initial]
    if (clip.frames.length === 0) return 0
    return ((this.elapsed * clip.fps) % clip.frames.length) / clip.frames.length
  }

  get frameName(): string {
    const clip = this.clips[this.state] ?? this.clips[this.initial]
    const raw = Math.floor(this.elapsed * clip.fps)
    const index = clip.loop
      ? raw % clip.frames.length
      : Math.min(clip.frames.length - 1, raw)
    return clip.frames[index]
  }

  get finished(): boolean {
    const clip = this.clips[this.state] ?? this.clips[this.initial]
    if (clip.loop) return false
    return this.elapsed * clip.fps >= clip.frames.length
  }

  get frame(): Sprite | undefined {
    return (
      this.resolve(this.frameName) ??
      (this.fallbackName ? this.resolve(this.fallbackName) : undefined)
    )
  }
}

// ============================================================
// CLASSES CONCRETAS
// ============================================================
export class Animator extends SpriteClipAnimator {
  constructor() {
    super(PLAYER_CLIPS, getFrame, 'idle', 'idle-1')
  }
}

export class ColonistAnimator extends SpriteClipAnimator {
  constructor() {
    super(COLONIST_CLIPS, getColonistFrame, 'idle', 'idle-1')
  }
}

// O índio usa o mesmo corpo da folha, mas com poses de arma, pulo e
// combate desenhadas separadamente no arquivo original. Os clips acima
// (INDIO_CLIPS) já mapeiam os frames corretos da folha.
export class IndioAnimator extends SpriteClipAnimator {
  constructor() {
    super(INDIO_CLIPS, getIndioFrame, 'idle', 'idle-1')
  }
}

// Kennedy, o lobo que protege o acampamento: andar, bote e queda.
export class WolfAnimator extends SpriteClipAnimator {
  constructor() {
    super(WOLF_CLIPS, getWolfFrame, 'idle', 'idle-1')
  }
}

// Zumbi: passos arrastados, mordida e queda.
export class ZombieAnimator extends SpriteClipAnimator {
  constructor() {
    super(ZOMBIE_CLIPS, getZombieFrame, 'idle', 'idle-1')
  }
}