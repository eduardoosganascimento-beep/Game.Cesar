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

const PUBLIC_BASE = import.meta.env.BASE_URL
const PLAYER_DIR = 'assets/sprites/player/'
const COLONIST_DIR = 'assets/sprites/colonist/'
const INDIO_DIR = 'assets/sprites/indio/'
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
  return `${PUBLIC_BASE}${relativePath}`
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
      const lit = lighten(img, w, h, brightness, saturation)

      // Âncoras antigas de Sand apontavam para fora do quadro (31 em um
      // sprite de 26 px), o que deixava o personagem flutuando. Quando isso
      // acontece, o pé passa a ser a base real da imagem.
      const anchorY = frame.anchor?.y && frame.anchor.y <= h ? frame.anchor.y : h
      const anchorX = Math.max(
        0,
        Math.min(w, frame.anchor?.x ?? Math.floor(w / 2)),
      )

      cache.set(frame.file.replace('.png', ''), {
        img: lit,
        w,
        h,
        ax: anchorX,
        ay: anchorY,
        outline: makeOutline(lit, w, h, outlineColor),
        white: makeOutline(lit, w, h, '#fff1c8'),
      })
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
      loadAtlas(INDIO_DIR, indioCache, '#2a1a10', 1.28, 1.18),
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
