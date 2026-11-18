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
  [0.16, '#2e1a0f'],
  [0.3, '#5a3218'],
  [0.44, '#8c5026'],
  [0.58, '#b8773b'],
  [0.72, '#d89a54'],
  [0.86, '#eab877'],
  [1, '#f6d39a'],
]

const INDIO_HAIR_RAMP: Ramp = [
  [0, '#07080a'],
  [0.28, '#10131a'],
  [0.52, '#1a1a22'],
  [0.76, '#2a2530'],
  [0.9, '#3d3034'],
  [1, '#58433c'],
]

const INDIO_PAINT_RAMP: Ramp = [
  [0, '#180604'],
  [0.22, '#4d0f0a'],
  [0.42, '#8a2012'],
  [0.6, '#c23a1c'],
  [0.8, '#e86430'],
  [1, '#f7a45c'],
]

const INDIO_RAMPS: RampSet = {
  skin: INDIO_SKIN_RAMP,
  hair: INDIO_HAIR_RAMP,
  accent: INDIO_PAINT_RAMP,
}

const COLONIST_SKIN_RAMP: Ramp = [
  [0, '#1a0f0a'],
  [0.16, '#3a2013'],
  [0.32, '#6b4026'],
  [0.48, '#9b6a3f'],
  [0.66, '#c08c58'],
  [0.84, '#d8ab74'],
  [1, '#efd0a0'],
]

const COLONIST_DARK_RAMP: Ramp = [
  [0, '#060606'],
  [0.22, '#151313'],
  [0.44, '#2a2623'],
  [0.64, '#3c3630'],
  [0.84, '#5a5045'],
  [1, '#7d6f5c'],
]

const COLONIST_COAT_RAMP: Ramp = [
  [0, '#1a0505'],
  [0.22, '#4a0d0b'],
  [0.42, '#7e1d15'],
  [0.6, '#a83220'],
  [0.8, '#cf5230'],
  [1, '#e6814a'],
]

const ZOMBIE_SKIN_RAMP: Ramp = [
  [0, '#10150d'],
  [0.16, '#26351a'],
  [0.34, '#40572a'],
  [0.52, '#607a3a'],
  [0.7, '#8aa152'],
  [0.86, '#b3c06a'],
  [1, '#d8d69a'],
]

const ZOMBIE_DARK_RAMP: Ramp = [
  [0, '#0b0a0c'],
  [0.24, '#18151b'],
  [0.46, '#272130'],
  [0.68, '#3a3040'],
  [0.86, '#51435a'],
  [1, '#6b5a72'],
]

const ZOMBIE_ROT_RAMP: Ramp = [
  [0, '#1c2410'],
  [0.22, '#3a4a18'],
  [0.42, '#5f7628'],
  [0.62, '#8aa63c'],
  [0.8, '#b4c65a'],
  [1, '#d8dd86'],
]

const WOLF_SKIN_RAMP: Ramp = [
  [0, '#050605'],
  [0.2, '#10140f'],
  [0.4, '#1c2319'],
  [0.6, '#2c3527'],
  [0.8, '#3e4a36'],
  [1, '#58634a'],
]

const WOLF_DARK_RAMP: Ramp = [
  [0, '#040504'],
  [0.26, '#0b0d0a'],
  [0.5, '#151a12'],
  [0.72, '#20271c'],
  [0.88, '#2e3828'],
  [1, '#414c38'],
]

const WOLF_WARM_RAMP: Ramp = [
  [0, '#1a1108'],
  [0.24, '#342411'],
  [0.46, '#55391b'],
  [0.68, '#7a5428'],
  [0.86, '#a2753c'],
  [1, '#c69a55'],
]

const COLONIST_RAMPS: RampSet = {
  skin: COLONIST_SKIN_RAMP,
  hair: COLONIST_DARK_RAMP,
  accent: COLONIST_COAT_RAMP,
}

const ZOMBIE_RAMPS: RampSet = {
  skin: ZOMBIE_SKIN_RAMP,
  hair: ZOMBIE_DARK_RAMP,
  accent: ZOMBIE_ROT_RAMP,
}

const WOLF_RAMPS: RampSet = {
  skin: WOLF_SKIN_RAMP,
  hair: WOLF_DARK_RAMP,
  accent: WOLF_WARM_RAMP,
}

type RecolorMode = 'player' | 'indio' | 'colonist' | 'zombie' | 'wolf'

const RAMPS: Record<RecolorMode, RampSet> = {
  player: PLAYER_RAMPS,
  indio: INDIO_RAMPS,
  colonist: COLONIST_RAMPS,
  zombie: ZOMBIE_RAMPS,
  wolf: WOLF_RAMPS,
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
  mode: RecolorMode,
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
    let ramp: Ramp
    if (mode === 'player' || mode === 'indio') {
      // Tons frios viram cabelo; os muito avermelhados viram urucum/tinta.
      ramp =
        b > r * 0.92 && b > g * 1.02
          ? ramps.hair
          : r > g * 1.78 && r > b * 1.55 && l > 0.24 && l < 0.62
            ? ramps.accent
            : ramps.skin
    } else if (mode === 'colonist') {
      // Casaco vermelho, couro escuro e pele quente.
      ramp =
        l < 0.22 || b > r * 1.1
          ? ramps.hair
          : r > g * 1.35 && r > b * 1.25 && l > 0.18
            ? ramps.accent
            : ramps.skin
    } else if (mode === 'zombie') {
      // Pele apodrecida: verde-oliva, sombras escuras e manchas de podridão.
      ramp =
        g > r * 1.12 && g > b * 1.05
          ? ramps.accent
          : l < 0.24
            ? ramps.hair
            : ramps.skin
    } else {
      // Lobo: pelo escuro, sombra quase preta e realces quentes no dorso.
      ramp =
        l < 0.28
          ? ramps.hair
          : r > g * 1.12 && l > 0.22
            ? ramps.accent
            : ramps.skin
    }
    const [nr, ng, nb] = sampleRamp(ramp, t)
    data[i] = nr
    data[i + 1] = ng
    data[i + 2] = nb
  }
  // Bevel de pixel art: borda superior/esquerda mais clara e inferior/direita
  // mais escura. Dá volume a todos os sprites sem desenhar contorno falso.
  const original = new Uint8ClampedArray(data)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4
      if (original[i + 3] < 16) continue
      const topEmpty = y > 0 && original[((y - 1) * w + x) * 4 + 3] < 16
      const leftEmpty = x > 0 && original[(y * w + x - 1) * 4 + 3] < 16
      const bottomEmpty = y < h - 1 && original[((y + 1) * w + x) * 4 + 3] < 16
      const rightEmpty = x < w - 1 && original[(y * w + x + 1) * 4 + 3] < 16
      if (topEmpty || leftEmpty) {
        data[i] = Math.min(255, data[i] + 16)
        data[i + 1] = Math.min(255, data[i + 1] + 14)
        data[i + 2] = Math.min(255, data[i + 2] + 10)
      }
      if (bottomEmpty || rightEmpty) {
        data[i] = Math.max(0, data[i] - 18)
        data[i + 1] = Math.max(0, data[i + 1] - 16)
        data[i + 2] = Math.max(0, data[i + 2] - 12)
      }
    }
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
  const hairY = Math.round(hy + 2)
  context.imageSmoothingEnabled = false

  // Cabelo negro com franja curta: muda a silhueta da cabeça.
  context.fillStyle = '#10121a'
  context.fillRect(x - 3, hairY, 7, 1)
  context.fillRect(x - 2, hairY + 1, 5, 1)
  context.fillStyle = '#2a2530'
  context.fillRect(x - 1, hairY, 3, 1)

  // Faixa de urucum com nó e duas penas curtas — detalhe, não cocar.
  context.fillStyle = '#8a2012'
  context.fillRect(x - 4, y, 8, 1)
  context.fillStyle = '#c23a1c'
  context.fillRect(x - 3, y, 6, 1)
  context.fillStyle = '#f0c78a'
  context.fillRect(x - 1, y, 2, 1)
  context.fillStyle = '#c9a15a'
  context.fillRect(x + 4, y, 2, 2)
  context.fillStyle = '#f0c78a'
  context.fillRect(x - 3, y - 1, 1, 1)
  context.fillRect(x - 4, y - 2, 1, 1)
  context.fillStyle = '#c23a1c'
  context.fillRect(x + 3, y - 1, 1, 1)
  context.fillRect(x + 4, y - 2, 1, 1)

  // Tinta facial: dois traços vermelhos e um ponto de osso.
  context.fillStyle = '#8a2012'
  context.fillRect(x - 2, y + 2, 1, 1)
  context.fillRect(x + 2, y + 2, 1, 1)
  context.fillStyle = '#f7d8a0'
  context.fillRect(x, y + 2, 1, 1)

  // No idle, uma faixa diagonal atravessa o peito.
  if (anim === 'idle') {
    const sashY = y + 13
    for (let i = 0; i < 8; i += 1) {
      context.fillStyle = i % 3 === 0 ? '#f0c78a' : '#a32818'
      context.fillRect(x - 4 + i, sashY + Math.floor(i / 3), 1, 1)
    }
  }
  return canvas
}

// Olhos escuros com brilho podre, costelas expostas e goteira de podridão.
// Coordenadas fixas na folha 36×53 (o zumbi sempre nasce de pé no mesmo ponto).
function paintZombieDetails(canvas: HTMLCanvasElement, file: string): HTMLCanvasElement {
  const context = canvas.getContext('2d')
  if (!context) return canvas
  const name = file.replace('.png', '')
  if (name.startsWith('death')) return canvas
  context.imageSmoothingEnabled = false
  // Órbitas.
  context.fillStyle = '#0a0d08'
  context.fillRect(13, 7, 4, 2)
  context.fillRect(19, 7, 4, 2)
  context.fillStyle = '#c8e86a'
  context.fillRect(14, 7, 1, 1)
  context.fillRect(20, 7, 1, 1)
  // Costelas e osso exposto.
  context.fillStyle = '#d8d6a4'
  for (let i = 0; i < 3; i += 1) {
    context.fillRect(13 + i, 19 + i * 2, 6 - i * 2, 1)
  }
  context.fillStyle = '#8aa63c'
  context.fillRect(11, 24, 2, 1)
  context.fillRect(23, 22, 2, 1)
  // Goteira.
  context.fillStyle = '#b4c65a'
  context.fillRect(17, 31, 1, 3)
  context.fillRect(18, 34, 1, 1)
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
  mode: RecolorMode,
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
      let lit = recolorSprite(img, w, h, RAMPS[mode], mode)
      if (mode === 'zombie') lit = paintZombieDetails(lit, frame.file)

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
          recolorSprite(img, w, h, RAMPS.indio, 'indio'),
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
      loadAtlas(PLAYER_DIR, playerCache, '#140f0b', 'player'),
      // Colono: casaco vermelho, couro escuro e pele quente.
      loadAtlas(COLONIST_DIR, colonistCache, '#0d0907', 'colonist'),
      // O índio é gerado a partir da folha do Sand dentro de loadAtlas.
      loadAtlas(WOLF_DIR, wolfCache, '#120d14', 'wolf'),
      // Zumbi: pele apodrecida esverdeada e manchas de podridão.
      loadAtlas(ZOMBIE_DIR, zombieCache, '#0d1a0b', 'zombie'),
      loadSpear(),
    ])
    console.info(
      `[sandman] ${playerCache.size} quadros de Sand · ${colonistCache.size} de colono · ${indioCache.size} de indio · ${wolfCache.size} de lobo · ${zombieCache.size} de zumbi`,
    )
  } catch {
    // sem sprites: o jogo segue com a arte provisória
  }
}
