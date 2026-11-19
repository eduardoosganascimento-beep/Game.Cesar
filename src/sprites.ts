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
  // Ponto mais alto da arte (usado pelo nome flutuante e pela coroa dos chefes).
  topX?: number
  topY?: number
}

// Cada chefe usa a mesma base de animação, mas com paleta, coroa e aura
// próprias. São cinco presenças diferentes sem precisar de novas folhas.
export type BossSkin = 'sy' | 'tuba' | 'kypyy' | 'kybykuera' | 'guardiao'

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

// Chefes derivados da folha do capitão (capítulos 1–5).
const COLONIST_BOSS_SKINS: readonly Exclude<BossSkin, 'guardiao'>[] = [
  'sy',
  'tuba',
  'kypyy',
  'kybykuera',
]
const bossCaches: Record<Exclude<BossSkin, 'guardiao'>, Map<string, Sprite>> = {
  sy: new Map<string, Sprite>(),
  tuba: new Map<string, Sprite>(),
  kypyy: new Map<string, Sprite>(),
  kybykuera: new Map<string, Sprite>(),
}
// O chefão final nasce da folha do Sand, com coroa e paleta de brasa.
const guardiaoCache = new Map<string, Sprite>()
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

export function getBossFrame(skin: BossSkin, name: string): Sprite | undefined {
  if (skin === 'guardiao') return guardiaoCache.get(name)
  return bossCaches[skin].get(name)
}

export function getSpearSprite(): Sprite | undefined {
  return spearSprite
}

export function loadedFrameCount(): number {
  let bossCount = guardiaoCache.size
  for (const cache of Object.values(bossCaches)) bossCount += cache.size
  return (
    playerCache.size +
    colonistCache.size +
    indioCache.size +
    wolfCache.size +
    zombieCache.size +
    bossCount
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

// ============================================================
// PALETAS DOS CHEFES
// ============================================================
// Os nomes vêm da família de Sandman (tupi antigo), e cada chefe veste uma
// variação da farda do invasor como uma pele espiritual. As paletas mantêm
// contraste alto para o chefe se destacar na mata e no templo à noite.
const BOSS_RAMPS: Record<BossSkin, RampSet> = {
  // Sy, a mãe: osso, urucum e vermelho profundo.
  sy: {
    skin: [
      [0, '#12090a'],
      [0.16, '#32151a'],
      [0.32, '#672a2a'],
      [0.48, '#9b4a3f'],
      [0.64, '#c8755c'],
      [0.8, '#e3a184'],
      [1, '#f7d3b0'],
    ],
    hair: [
      [0, '#08060a'],
      [0.24, '#140f18'],
      [0.48, '#221a28'],
      [0.72, '#37283a'],
      [0.88, '#503b4a'],
      [1, '#6d5260'],
    ],
    accent: [
      [0, '#1c0506'],
      [0.2, '#4a0a0c'],
      [0.4, '#7d1114'],
      [0.58, '#a81d1c'],
      [0.74, '#d02f24'],
      [0.88, '#e85a36'],
      [1, '#f49a5a'],
    ],
  },
  // Tuba, o pai: verde-mata, bronze e osso.
  tuba: {
    skin: [
      [0, '#0b100a'],
      [0.16, '#22301a'],
      [0.32, '#425a2a'],
      [0.48, '#6b7d3d'],
      [0.64, '#95a45a'],
      [0.8, '#bcc47a'],
      [1, '#e2d9a2'],
    ],
    hair: [
      [0, '#050807'],
      [0.24, '#0d1512'],
      [0.48, '#18241d'],
      [0.72, '#25352a'],
      [0.88, '#354a38'],
      [1, '#4c634a'],
    ],
    accent: [
      [0, '#1a1206'],
      [0.2, '#3d2a08'],
      [0.4, '#6e4a0d'],
      [0.58, '#9c6d16'],
      [0.74, '#c89422'],
      [0.88, '#e6b83a'],
      [1, '#f6d96a'],
    ],
  },
  // Kypy'y, a irmã: brasa, âmbar e vermelho-vivo.
  kypyy: {
    skin: [
      [0, '#140a05'],
      [0.16, '#3a1a0c'],
      [0.32, '#6f3518'],
      [0.48, '#a45a28'],
      [0.64, '#cf8040'],
      [0.8, '#e8a865'],
      [1, '#f9d49a'],
    ],
    hair: [
      [0, '#0a0705'],
      [0.24, '#1a100a'],
      [0.48, '#2a1a10'],
      [0.72, '#402818'],
      [0.88, '#5a3a22'],
      [1, '#7a5230'],
    ],
    accent: [
      [0, '#1e0803'],
      [0.2, '#4f1207'],
      [0.4, '#8a220b'],
      [0.58, '#c23a12'],
      [0.74, '#e8641e'],
      [0.88, '#f59a36'],
      [1, '#ffd166'],
    ],
  },
  // Kybykuera, os irmãos: noite, gelo e azul-índigo.
  kybykuera: {
    skin: [
      [0, '#090a12'],
      [0.16, '#1a2032'],
      [0.32, '#343f5a'],
      [0.48, '#55627d'],
      [0.64, '#7c8a9e'],
      [0.8, '#a8b4c4'],
      [1, '#d6e2e8'],
    ],
    hair: [
      [0, '#04060a'],
      [0.24, '#0b1018'],
      [0.48, '#151d2a'],
      [0.72, '#222c3e'],
      [0.88, '#33405a'],
      [1, '#4a5a78'],
    ],
    accent: [
      [0, '#080a1e'],
      [0.2, '#101a4a'],
      [0.4, '#1c2e7a'],
      [0.58, '#2f4aa8'],
      [0.74, '#4a6fd0'],
      [0.88, '#7fa4e8'],
      [1, '#b8d4ff'],
    ],
  },
  // O chefão: negro, ouro e brasa.
  guardiao: {
    skin: [
      [0, '#100a05'],
      [0.16, '#2e1c0c'],
      [0.32, '#5a3a18'],
      [0.48, '#8a5e28'],
      [0.64, '#b8863c'],
      [0.8, '#d8ad5a'],
      [1, '#f2d89a'],
    ],
    hair: [
      [0, '#050505'],
      [0.24, '#100d0a'],
      [0.48, '#1c1710'],
      [0.72, '#2e2618'],
      [0.88, '#463a22'],
      [1, '#66522e'],
    ],
    accent: [
      [0, '#1a0d04'],
      [0.2, '#4a2606'],
      [0.4, '#7d440a'],
      [0.58, '#b06a12'],
      [0.74, '#d89a24'],
      [0.88, '#f2c44a'],
      [1, '#ffe98a'],
    ],
  },
}

const BOSS_OUTLINES: Record<BossSkin, string> = {
  sy: '#1a0709',
  tuba: '#08120a',
  kypyy: '#1a0803',
  kybykuera: '#070a1a',
  guardiao: '#1a0d03',
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

type CrestConfig = {
  colors: readonly string[]
  dark: string
  height: number
  count: number
  fan: number
}

const BOSS_CRESTS: Record<BossSkin, CrestConfig> = {
  // Coroa de osso e urucum: três penas longas.
  sy: { colors: ['#f2e2c4', '#c4473a', '#f2e2c4'], dark: '#2a1414', height: 7, count: 3, fan: 2 },
  // Coroa larga de penas verdes e douradas.
  tuba: {
    colors: ['#6fbf5a', '#d9b24a', '#3f8f4a', '#f0d166'],
    dark: '#14200f',
    height: 6,
    count: 4,
    fan: 2.4,
  },
  // Leque de brasa.
  kypyy: {
    colors: ['#ffd166', '#ff9f43', '#e8641e', '#ffe9a8', '#c23a12'],
    dark: '#2a0e08',
    height: 7,
    count: 5,
    fan: 2.2,
  },
  // Penas gélidas com ponta vermelha.
  kybykuera: {
    colors: ['#b8d4ff', '#6fa8ff', '#e8f4ff', '#c4473a'],
    dark: '#0a0e24',
    height: 7,
    count: 4,
    fan: 2.5,
  },
  // Coroa do chefão: alta, dourada e incandescente.
  guardiao: {
    colors: ['#ffe98a', '#ffb347', '#f2c44a', '#ff8b3d', '#fff6d0'],
    dark: '#1a0e04',
    height: 9,
    count: 5,
    fan: 2.4,
  },
}

// Encontra o ponto mais alto da silhueta perto da cabeça. O leque do topo é
// preso nesse ponto, então a coroa acompanha o chapéu em qualquer quadro.
function measureTop(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  centerX: number,
  range: number,
): { x: number; y: number } {
  const context = canvas.getContext('2d')
  if (!context) return { x: Math.round(centerX), y: 0 }
  const data = context.getImageData(0, 0, w, h).data
  const left = Math.max(0, Math.floor(centerX - range))
  const right = Math.min(w - 1, Math.ceil(centerX + range))
  for (let y = 0; y < h; y += 1) {
    let sum = 0
    let count = 0
    for (let x = left; x <= right; x += 1) {
      if (data[(y * w + x) * 4 + 3] > 30) {
        sum += x
        count += 1
      }
    }
    if (count > 0) return { x: Math.round(sum / count), y }
  }
  return { x: Math.round(centerX), y: 0 }
}

// Pinta a coroa de penas acima do ponto mais alto do quadro. Como o desenho
// é expandido para cima, as penas nunca são cortadas.
function paintBossCrest(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  centerX: number,
  skin: BossSkin,
): { x: number; y: number } {
  const context = canvas.getContext('2d')
  if (!context) return { x: Math.round(centerX), y: 0 }
  const config = BOSS_CRESTS[skin]
  const top = measureTop(canvas, w, h, centerX, skin === 'guardiao' ? 10 : 13)
  const baseX = top.x
  const baseY = Math.max(1, top.y - 1)
  context.imageSmoothingEnabled = false

  // Base escura: prende as penas no chapéu/cabeça.
  const fanWidth = Math.round(config.count * config.fan) + 3
  context.fillStyle = config.dark
  context.fillRect(baseX - Math.floor(fanWidth / 2), baseY, fanWidth, 1)

  for (let i = 0; i < config.count; i += 1) {
    const offset = i - (config.count - 1) / 2
    const fx = Math.round(baseX + offset * config.fan)
    const fh = config.height + (i % 2 === 0 ? 2 : 0)
    const color = config.colors[i % config.colors.length]
    const tip = config.colors[(i + 1) % config.colors.length]
    for (let j = 0; j < fh; j += 1) {
      const x = Math.round(fx + offset * 0.28 * (j / Math.max(1, fh - 1)))
      const y = baseY - 1 - j
      if (x < 0 || x >= w || y < 0) continue
      context.fillStyle = j === 0 ? config.dark : j >= fh - 2 ? tip : color
      context.fillRect(x, y, 1, 1)
    }
  }

  // Um ponto de osso no centro para dar leitura de cocar, não de chapéu.
  context.fillStyle = config.colors[config.colors.length - 1]
  context.fillRect(baseX, baseY - Math.min(config.height + 1, 4), 1, 1)

  return { x: baseX, y: Math.max(0, baseY - config.height - 2) }
}

const BOSS_PAD_TOP = 14
const BOSS_PAD_X = 3

// Expande a moldura do sprite para cima e acrescenta a coroa. A âncora é
// corrigida para os pés continuarem exatamente no mesmo lugar.
function makeBossSprite(
  base: HTMLCanvasElement,
  w: number,
  h: number,
  ax: number,
  ay: number,
  skin: BossSkin,
): Sprite {
  const cw = w + BOSS_PAD_X * 2
  const ch = h + BOSS_PAD_TOP
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const context = canvas.getContext('2d')
  if (!context) {
    return { img: base, w, h, ax, ay, outline: base, white: base }
  }
  context.imageSmoothingEnabled = false
  context.drawImage(base, BOSS_PAD_X, BOSS_PAD_TOP)
  const top = paintBossCrest(canvas, cw, ch, ax + BOSS_PAD_X, skin)
  return {
    img: canvas,
    w: cw,
    h: ch,
    ax: ax + BOSS_PAD_X,
    ay: ay + BOSS_PAD_TOP,
    outline: makeOutline(canvas, cw, ch, BOSS_OUTLINES[skin]),
    white: makeOutline(canvas, cw, ch, '#fff1c8'),
    topX: top.x,
    topY: top.y,
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

        // O chefão final é uma versão negra/dourada do guardião, com coroa
        // de brasa. Ele mantém os quadros de luta do Sand, mas com outra
        // presença e outra paleta.
        const guardiaoArt = paintIndioDetails(
          recolorSprite(img, w, h, BOSS_RAMPS.guardiao, 'indio'),
          frame.file,
        )
        guardiaoCache.set(
          name,
          makeBossSprite(guardiaoArt, w, h, anchorX, anchorY, 'guardiao'),
        )
      }

      // Cada capítulo tem seu próprio rosto para o mesmo capitão. A base é
      // recolorida e recebe uma coroa de penas; a animação continua idêntica.
      if (directory === COLONIST_DIR) {
        for (const skin of COLONIST_BOSS_SKINS) {
          const bossArt = recolorSprite(img, w, h, BOSS_RAMPS[skin], 'colonist')
          bossCaches[skin].set(
            name,
            makeBossSprite(bossArt, w, h, anchorX, anchorY, skin),
          )
        }
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
      `[sandman] ${playerCache.size} quadros de Sand · ${colonistCache.size} de colono · ${indioCache.size} de indio · ${wolfCache.size} de lobo · ${zombieCache.size} de zumbi · ${loadedFrameCount()} no total (com chefes)`,
    )
  } catch {
    // sem sprites: o jogo segue com a arte provisória
  }
}
