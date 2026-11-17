import { embeddedAssets } from 'virtual:sandman-assets'

type AtlasFrame = {
  file: string
  w: number
  h: number
  anchor?: { x: number; y: number }
}

type AtlasData = {
  frames: AtlasFrame[]
}

export type Sprite = {
  img: HTMLImageElement | HTMLCanvasElement
  w: number
  h: number
  ax: number
  ay: number
  outline: HTMLCanvasElement
  white: HTMLCanvasElement
}

// Altura visível média de cada folha (em px de arte). Todas as pessoas do
// jogo são desenhadas na mesma altura final, para ninguém parecer gigante
// ao lado do Sandman.
export const CHARACTER_HEIGHT = 38
export const VISUAL_HEIGHT: Readonly<
  Record<'player' | 'indio' | 'colonist' | 'wolf' | 'zombie', number>
> = {
  player: 35,
  indio: 35,
  colonist: 37,
  wolf: 29,
  zombie: 50,
}

export function characterScale(kind: keyof typeof VISUAL_HEIGHT): number {
  return CHARACTER_HEIGHT / VISUAL_HEIGHT[kind]
}

const PUBLIC_BASE = import.meta.env.BASE_URL
// Versão dos assets servidos de public/ (dev). Evita que o navegador reuse
// tiles antigos depois de uma mudança de paleta; no build tudo é data URI.
const ASSET_QUERY = '?v=3'
const PLAYER_DIR = 'assets/sprites/player/'
const COLONIST_DIR = 'assets/sprites/colonist/'
const WOLF_DIR = 'assets/sprites/wolf/'
const ZOMBIE_DIR = 'assets/sprites/zombie/'
const PROJECTILE_DIR = 'assets/sprites/projectile/'

const playerCache = new Map<string, Sprite>()
const colonistCache = new Map<string, Sprite>()
const indioCache = new Map<string, Sprite>()
const wolfCache = new Map<string, Sprite>()
const zombieCache = new Map<string, Sprite>()
let spearSprite: Sprite | undefined

export function getFrame(name: string): Sprite | undefined {
  return playerCache.get(name)
}

export function getColonistFrame(name: string): Sprite | undefined {
  return colonistCache.get(name)
}

export function getIndioFrame(name: string): Sprite | undefined {
  return indioCache.get(name)
}

export function getWolfFrame(name: string): Sprite | undefined {
  return wolfCache.get(name)
}

export function getZombieFrame(name: string): Sprite | undefined {
  return zombieCache.get(name)
}

export function getSpearSprite(): Sprite | undefined {
  return spearSprite
}

export function loadedFrameCount(): number {
  return (
    playerCache.size +
    colonistCache.size +
    indioCache.size +
    wolfCache.size +
    zombieCache.size
  )
}

// Os arquivos de public/ vêm embutidos no bundle (data URI) no build e pela
// rede no dev server. Os dois caminhos usam a mesma interface.
export function publicAssetUrl(relativePath: string): string {
  const embedded = embeddedAssets[relativePath]
  if (embedded) return embedded
  return `${PUBLIC_BASE}${relativePath}${ASSET_QUERY}`
}

function waitForImage(img: HTMLImageElement): Promise<void> {
  if (img.complete) return Promise.resolve()
  return new Promise((resolve) => {
    const done = (): void => resolve()
    img.addEventListener('load', done, { once: true })
    img.addEventListener('error', done, { once: true })
  })
}

// A arte original é escura; um leve ganho de luz e saturação separa Sand
// e os colonos do fundo da mata sem descaracterizar as cores.
function lighten(
  source: HTMLImageElement,
  w: number,
  h: number,
  brightness: number,
  saturation: number,
): HTMLImageElement | HTMLCanvasElement {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const context = canvas.getContext('2d')
    if (!context) return source
    context.imageSmoothingEnabled = false
    context.filter = `brightness(${brightness}) saturate(${saturation})`
    context.drawImage(source, 0, 0, w, h)
    if (context.filter === 'none') return source
    return canvas
  } catch {
    return source
  }
}

// Paleta quente do guardião: cabelo quase preto, pele de terra, urucum nos
// pontos de luz e osso nos realces. A arte original é toda marrom-arroxeada;
// aqui ela é remapeada por brilho, preservando o desenho pixel a pixel.
type Ramp = ReadonlyArray<readonly [number, string]>

const SKIN_RAMP: Ramp = [
  [0, '#140c08'],
  [0.16, '#2f1a10'],
  [0.3, '#5a3019'],
  [0.44, '#8a4e28'],
  [0.58, '#b1733d'],
  [0.72, '#cf9755'],
  [0.86, '#e4b878'],
  [1, '#f2d59c'],
]

const HAIR_RAMP: Ramp = [
  [0, '#0b0908'],
  [0.24, '#17100c'],
  [0.46, '#281a12'],
  [0.68, '#3a271a'],
  [0.86, '#503625'],
  [1, '#6b4a31'],
]

const URUCUM_RAMP: Ramp = [
  [0, '#1d0805'],
  [0.2, '#4c110a'],
  [0.4, '#872514'],
  [0.58, '#b23d20'],
  [0.74, '#d46230'],
  [0.88, '#e88b48'],
  [1, '#f4b169'],
]

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

type RampSet = { skin: Ramp; hair: Ramp; accent: Ramp }

const PLAYER_RAMPS: RampSet = {
  skin: SKIN_RAMP,
  hair: HAIR_RAMP,
  accent: URUCUM_RAMP,
}

// O guardião inimigo usa a mesma base do Sand, mas com pele mais escura,
// cabelo cochino e faixa de tinta preta/urucum — outra silhueta e outra leitura
// dentro da mata, mantendo o mesmo estilo de pixel art.
const INDIO_SKIN_RAMP: Ramp = [
  [0, '#100b08'],
  [0.16, '#24160d'],
  [0.3, '#432712'],
  [0.44, '#653a1c'],
  [0.58, '#8a5228'],
  [0.72, '#a86c38'],
  [0.86, '#c38a4c'],
  [1, '#d8a766'],
]

const INDIO_HAIR_RAMP: Ramp = [
  [0, '#080706'],
  [0.3, '#100c09'],
  [0.6, '#1b1410'],
  [0.85, '#2a1d14'],
  [1, '#3d2a1c'],
]

const INDIO_PAINT_RAMP: Ramp = [
  [0, '#0d0504'],
  [0.25, '#1f0b07'],
  [0.5, '#44130c'],
  [0.7, '#70220f'],
  [0.88, '#9d3a18'],
  [1, '#c46228'],
]

const INDIO_RAMPS: RampSet = {
  skin: INDIO_SKIN_RAMP,
  hair: INDIO_HAIR_RAMP,
  accent: INDIO_PAINT_RAMP,
}

const RAMPS: Record<'player' | 'indio', RampSet> = {
  player: PLAYER_RAMPS,
  indio: INDIO_RAMPS,
}

function sampleRamp(ramp: Ramp, t: number): [number, number, number] {
  let i = 1
  while (i < ramp.length - 1 && ramp[i][0] < t) i += 1
  const [stop0, hex0] = ramp[i - 1]
  const [stop1, hex1] = ramp[i]
  const c0 = hexToRgb(hex0)
  const c1 = hexToRgb(hex1)
  const k = Math.max(0, Math.min(1, (t - stop0) / (stop1 - stop0)))
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * k),
    Math.round(c0[1] + (c1[1] - c0[1]) * k),
    Math.round(c0[2] + (c1[2] - c0[2]) * k),
  ]
}

function recolorSprite(
  source: HTMLImageElement | HTMLCanvasElement,
  w: number,
  h: number,
  ramps: RampSet,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const context = canvas.getContext('2d')
  if (!context) return canvas
  context.imageSmoothingEnabled = false
  context.drawImage(source, 0, 0, w, h)
  const image = context.getImageData(0, 0, w, h)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 16) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    const t = Math.max(0, Math.min(0.999, l * 1.18 + 0.05))
    // Tons frios/arroxeados viram cabelo e sombra; os quentes viram pele;
    // os muito avermelhados recebem tinta de urucum.
    const ramp =
      b > r * 0.92 && b > g * 1.02
        ? ramps.hair
        : r > g * 1.78 && r > b * 1.55 && l > 0.24 && l < 0.62
          ? ramps.accent
          : ramps.skin
    const [nr, ng, nb] = sampleRamp(ramp, t)
    data[i] = nr
    data[i + 1] = ng
    data[i + 2] = nb
  }
  context.putImageData(image, 0, 0)
  return canvas
}

// Posição do alto da cabeça em cada quadro (medida na folha 47×41). serve
// para desenhar a faixa de pano do índio sem flutuar sobre o corpo.
const HEAD_ANCHORS: Record<string, readonly [number, number]> = {
  'run-6': [24.5, 3.5],
  'melee-4': [19.5, 11.5],
  'melee-5': [20.5, 12.5],
  'throw-1': [19, 5.5],
  'throw-2': [25.5, 8.5],
  'throw-3': [24, 9],
  'throw-4': [26, 7.5],
  'hurt-4': [17.5, 9.5],
}

function headAnchor(file: string): readonly [number, number] {
  const name = file.replace('.png', '')
  const tweak = HEAD_ANCHORS[name]
  if (tweak) return tweak
  switch (name.split('-')[0]) {
    case 'idle':
      return [20, 4]
    case 'run':
      return [21.5, 3]
    case 'jump':
      return [22.5, 3]
    case 'melee':
      return [20, 13]
    case 'throw':
      return [24.5, 8]
    case 'hurt':
      return [27, 5]
    default:
      return [23, 20]
  }
}

// Faixa de pano e tinta facial: o que separa o índio do Sand em silhueta.
function paintIndioDetails(
  canvas: HTMLCanvasElement,
  file: string,
): HTMLCanvasElement {
  const context = canvas.getContext('2d')
  if (!context) return canvas
  const name = file.replace('.png', '')
  const anim = name.split('-')[0]
  // Em golpes, arremesso, dano e queda a cabeça sai demais do lugar e a faixa
  // viraria um pixel solto: nesses quadros só a paleta já identifica o índio.
  if (anim === 'melee' || anim === 'throw' || anim === 'hurt' || anim === 'death') {
    return canvas
  }
  const [hx, hy] = headAnchor(file)
  const y = Math.round(hy + 4)
  const x = Math.round(hx)
  context.imageSmoothingEnabled = false
  // Faixa de urucum atravessando a testa.
  context.fillStyle = '#9d3a1b'
  context.fillRect(x - 4, y, 8, 1)
  context.fillStyle = '#d8803a'
  context.fillRect(x - 3, y, 6, 1)
  // Nó e ponta da faixa na lateral.
  context.fillStyle = '#c9a15a'
  context.fillRect(x + 4, y, 2, 2)
  context.fillStyle = '#1f0b07'
  context.fillRect(x - 2, y + 2, 1, 1)
  context.fillRect(x + 2, y + 2, 1, 1)
  return canvas
}

function makeOutline(
  source: HTMLImageElement | HTMLCanvasElement,
  w: number,
  h: number,
  color: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const context = canvas.getContext('2d')
  if (!context) return canvas

  context.imageSmoothingEnabled = false
  context.drawImage(source, 0, 0, w, h)
  context.globalCompositeOperation = 'source-in'
  context.fillStyle = color
  context.fillRect(0, 0, w, h)
  return canvas
}

async function loadAtlas(
  directory: string,
  cache: Map<string, Sprite>,
  outlineColor: string,
  brightness: number,
  saturation: number,
): Promise<void> {
  const atlasUrl = publicAssetUrl(`${directory}atlas.json`)
  let atlas: AtlasData
  try {
    const response = await fetch(atlasUrl)
    if (!response.ok) return
    atlas = (await response.json()) as AtlasData
  } catch {
    return
  }

  await Promise.all(
    atlas.frames.map(async (frame) => {
      const img = new Image()
      img.src = publicAssetUrl(`${directory}${frame.file}`)
      await waitForImage(img)
      if (img.naturalWidth === 0) return
      const w = img.naturalWidth || frame.w
      const h = img.naturalHeight || frame.h
      const isPlayer = directory === PLAYER_DIR
      const lit = isPlayer
        ? recolorSprite(img, w, h, RAMPS.player)
        : lighten(img, w, h, brightness, saturation)

      // Âncoras antigas de Sand apontavam para fora do quadro (31 em um
      // sprite de 26 px), o que deixava o personagem flutuando. Quando isso
      // acontece, o pé passa a ser a base real da imagem.
      const anchorY = frame.anchor?.y && frame.anchor.y <= h ? frame.anchor.y : h
      const anchorX = Math.max(
        0,
        Math.min(w, frame.anchor?.x ?? Math.floor(w / 2)),
      )
      const name = frame.file.replace('.png', '')

      cache.set(name, {
        img: lit,
        w,
        h,
        ax: anchorX,
        ay: anchorY,
        outline: makeOutline(lit, w, h, outlineColor),
        white: makeOutline(lit, w, h, '#fff1c8'),
      })

      // O índio inimigo nasce da mesma folha, mas com paleta própria e faixa
      // de pano: animação completa e silhueta diferente sem assets extras.
      if (isPlayer) {
        const indioArt = paintIndioDetails(
          recolorSprite(img, w, h, RAMPS.indio),
          frame.file,
        )
        indioCache.set(name, {
          img: indioArt,
          w,
          h,
          ax: anchorX,
          ay: anchorY,
          outline: makeOutline(indioArt, w, h, '#150c08'),
          white: makeOutline(indioArt, w, h, '#f0d9a8'),
        })
      }
    }),
  )
}

// A lança em voo vem do próprio quadro throw-4 da folha de Sand.
async function loadSpear(): Promise<void> {
  try {
    const metaResponse = await fetch(publicAssetUrl(`${PROJECTILE_DIR}spear.json`))
    if (!metaResponse.ok) return
    const meta = (await metaResponse.json()) as {
      file: string
      w: number
      h: number
      ax: number
      ay: number
    }
    const img = new Image()
    img.src = publicAssetUrl(`${PROJECTILE_DIR}${meta.file}`)
    await waitForImage(img)
    if (img.naturalWidth === 0) return
    const w = img.naturalWidth || meta.w
    const h = img.naturalHeight || meta.h
    const lit = lighten(img, w, h, 1.28, 1.16)
    spearSprite = {
      img: lit,
      w,
      h,
      ax: Math.min(w, Math.max(0, meta.ax ?? w / 2)),
      ay: Math.min(h, Math.max(0, meta.ay ?? h / 2)),
      outline: makeOutline(lit, w, h, '#2a1608'),
      white: makeOutline(lit, w, h, '#fff1c8'),
    }
  } catch {
    spearSprite = undefined
  }
}

export async function loadSprites(): Promise<void> {
  try {
    await Promise.all([
      loadAtlas(PLAYER_DIR, playerCache, '#140f0b', 1.32, 1.22),
      // Colonos mais vibrantes: casaco vermelho e chapéu branco saltam da mata.
      loadAtlas(COLONIST_DIR, colonistCache, '#0d0907', 1.3, 1.24),
// O índio é gerado a partir da folha do Sand em loadAtlas.
      loadAtlas(WOLF_DIR, wolfCache, '#120d14', 1.18, 1.16),
      // Zumbi: mais luz e saturação para o verde doentio aparecer no fundo.
      loadAtlas(ZOMBIE_DIR, zombieCache, '#0d1a0b', 1.26, 1.2),
      loadSpear(),
    ])
    console.info(
      `[sandman] ${playerCache.size} quadros de Sand · ${colonistCache.size} de colono · ${indioCache.size} de indio · ${wolfCache.size} de lobo · ${zombieCache.size} de zumbi`,
    )
  } catch {
    // sem sprites: o jogo segue com a arte provisória
  }
}
