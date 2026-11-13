// Recorta a folha dos colonos célula por célula e monta o atlas de animações.
//
// A folha é arte gerada em alta resolução sobre um fundo azul-escuro. O recorte
// antigo removia qualquer pixel "azulado", o que abria buracos no uniforme.
// Aqui a transparência vem da distância até a cor real do fundo e a redução
// usa média de alfa: o corpo fica inteiro, com contorno fechado e legível.
//
// Uso: node scripts/build-colonist-sprites.mjs [--scale 5]
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import { buildPalette, componentList, padFrames, resampleArea, snapPalette } from './sprite-utils.mjs'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : fallback
}

const input = flag('input', 'raw/referencias/f0bac687-9edc-4d41-a5b7-f9ff80eed522.png')
const outDir = flag('out', 'public/assets/sprites/colonist')
const SCALE = Number(flag('scale', 5))
const COLS = 8
const ROWS = 5
const PAD = 3
const TARGET_BODY = Number(process.argv.includes('--target') ? process.argv[process.argv.indexOf('--target') + 1] : 36)

const png = PNG.sync.read(fs.readFileSync(input))
const { width, height, data } = png
const at = (x, y) => {
  const i = (y * width + x) * 4
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

// ---------------------------------------------------------------- fundo
const samples = []
for (let x = 0; x < width; x += 3) {
  samples.push(at(x, 0), at(x, height - 1))
}
for (let y = 0; y < height; y += 3) {
  samples.push(at(0, y), at(width - 1, y))
}
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
const bg = [0, 1, 2].map((channel) => median(samples.map((color) => color[channel])))
console.log('fundo estimado:', bg.join(','))

function alphaAt(r, g, b, a) {
  if (a < 8) return 0
  const dr = r - bg[0]
  const dg = g - bg[1]
  const db = b - bg[2]
  const distance = Math.sqrt(dr * dr + dg * dg + db * db)
  return Math.max(0, Math.min(1, (distance - 10) / 22))
}

// ------------------------------------------------------- componentes
const mask = new Uint8Array(width * height)
const paletteSamples = []
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const [r, g, b, a] = at(x, y)
    if (alphaAt(r, g, b, a) > 0.45) {
      mask[y * width + x] = 1
      if (x % 3 === 0 && y % 3 === 0) paletteSamples.push([r, g, b])
    }
  }
}

const components = componentList(mask, width, height, (index) => mask[index] === 1).filter(
  (component) => component.area >= 300,
)

// Mapeia cada quadro para o n-ésimo corpo da linha, da esquerda para a direita.
// Só componentes grandes entram como corpo; fumaça e faíscas soltas ficam de
// fora da lista e são anexadas ao quadro quando estão perto do corpo.
const cellW = width / COLS
const cellH = height / ROWS

const rowBodies = Array.from({ length: ROWS }, () => [])
for (const component of components) {
  if (component.area < 5000) continue
  const centerY = component.y + component.h / 2
  const row = Math.max(0, Math.min(ROWS - 1, Math.floor(centerY / cellH)))
  rowBodies[row].push(component)
}
for (const list of rowBodies) list.sort((a, b) => a.x - b.x)

const layout = [
  ['idle-1', 0, 0],
  ['idle-2', 0, 1],
  ['walk-1', 1, 0],
  ['walk-2', 1, 1],
  ['walk-3', 1, 2],
  ['walk-4', 1, 3],
  ['shoot-1', 1, 4],
  ['shoot-2', 1, 5],
  ['shoot-3', 1, 6],
  ['slash-1', 3, 0],
  ['slash-2', 3, 1],
  ['slash-3', 3, 2],
  ['slash-4', 3, 3],
  ['slash-5', 3, 4],
  ['slash-6', 3, 5],
  ['hurt-1', 4, 0],
  ['death-1', 4, 3],
  ['death-2', 4, 4],
  ['death-3', 4, 5],
  ['death-4', 4, 6],
]

function nearBody(body, component) {
  if (component === body) return true
  if (component.area < 600) return false
  // Outro corpo grande nunca entra no quadro; só efeitos soltos (fumaça,
  // faísca, ponta de lâmina) podem acompanhar o corpo principal.
  if (component.area >= 5000) return false
  const centerY = component.y + component.h / 2
  if (centerY < body.y || centerY > body.y + body.h) return false
  const margin = 52
  const overlapX =
    component.x < body.x + body.w + margin && component.x + component.w > body.x - margin
  const overlapY =
    component.y < body.y + body.h + margin && component.y + component.h > body.y - margin
  return overlapX && overlapY
}

const medianValue = (values) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}


fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

// 1) Recorta os quadros (sem reduzir) e guarda a arte de cada um.
const raw = []
for (const [name, row, index] of layout) {
  const body = rowBodies[row]?.[index]
  if (!body) {
    console.error(`Sem corpo em ${name} (linha ${row + 1}, índice ${index})`)
    process.exit(1)
  }

  const parts = components.filter((component) => nearBody(body, component))
  const cropX = Math.max(0, Math.min(...parts.map((part) => part.x)) - PAD)
  const cropY = Math.max(0, Math.min(...parts.map((part) => part.y)) - PAD)
  const cropRight = Math.min(width, Math.max(...parts.map((part) => part.x + part.w)) + PAD)
  const cropBottom = Math.min(height, Math.max(...parts.map((part) => part.y + part.h)) + PAD)
  const cropW = cropRight - cropX
  const cropH = cropBottom - cropY

  const crop = {
    w: cropW,
    h: cropH,
    mask: new Uint8Array(cropW * cropH),
    data: new Uint8Array(cropW * cropH * 4),
  }
  for (let y = 0; y < cropH; y += 1) {
    for (let x = 0; x < cropW; x += 1) {
      const sx = cropX + x
      const sy = cropY + y
      const [r, g, b, a] = at(sx, sy)
      const alpha = alphaAt(r, g, b, a)
      if (alpha <= 0.4) continue
      const local = y * cropW + x
      crop.mask[local] = 1
      crop.data[local * 4] = r
      crop.data[local * 4 + 1] = g
      crop.data[local * 4 + 2] = b
      crop.data[local * 4 + 3] = 255
    }
  }

  const lying = body.w > body.h
  const reference = lying ? body.w : body.h
  const bodyBottom = body.y + body.h

  // A âncora horizontal é o centro da cabeça, não a ponta dos pés. Os pés
  // mudam de posição entre as poses (passada, peso do corpo, arma), e usar a
  // média deles fazia o inimigo tremer vários pixels a cada quadro. Nas poses
  // deitadas, o centro do próprio corpo é mais fiel.
  const headXs = []
  const headLimit = body.y + body.h * 0.3
  for (const pixel of body.pixels) {
    const px = pixel % width
    const py = (pixel - px) / width
    if (py <= headLimit) headXs.push(px)
  }

  raw.push({
    name,
    crop,
    body,
    reference,
    lying,
    anchorSourceX: lying ? body.x + body.w / 2 : medianValue(headXs),
    bodyBottom,
    cropX,
    cropY,
  })
}

// 2) Todos os personagens com a mesma altura de corpo.
const standingRefs = raw
  .filter((item) => !item.lying && (item.name.startsWith('idle') || item.name.startsWith('walk')))
  .map((item) => item.reference)
const baseFactor = TARGET_BODY / (medianValue(standingRefs) || medianValue(raw.map((item) => item.reference)))

const palette = buildPalette(paletteSamples, 110)

const frames = []
for (const item of raw) {
  const factor = Math.max(baseFactor * 0.86, Math.min(baseFactor * 1.14, TARGET_BODY / item.reference))
  const out = resampleArea(item.crop, factor, 0.3)
  snapPalette(out, palette)

  const anchorX = Math.max(
    0,
    Math.min(out.width, Math.round((item.anchorSourceX - item.cropX) * factor)),
  )
  const anchorY = Math.max(
    1,
    Math.min(out.height, Math.ceil((item.bodyBottom - item.cropY) * factor)),
  )

  frames.push({
    file: `${item.name}.png`,
    name: item.name,
    png: out,
    w: out.width,
    h: out.height,
    anchor: { x: anchorX, y: anchorY },
    source: { x: item.cropX, y: item.cropY, w: item.crop.w, h: item.crop.h },
    body: { x: item.body.x, y: item.body.y, w: item.body.w, h: item.body.h },
  })
}

// 3) Mesmo tamanho para todos + âncora corrigida.
const { maxW, maxH } = padFrames(frames)
for (const frame of frames) {
  fs.writeFileSync(path.join(outDir, frame.file), PNG.sync.write(frame.png))
}

const previewItems = frames.map((frame) => ({
  name: frame.name,
  png: frame.png,
  w: frame.w,
  h: frame.h,
  ax: frame.anchor.x,
  ay: frame.anchor.y,
}))

// ------------------------------------------------------ folha de conferência
const cellWidth = Math.max(...previewItems.map((item) => item.w)) + 14
const cellHeight = Math.max(...previewItems.map((item) => item.h)) + 26
const cols = 7
const rowsCount = Math.ceil(previewItems.length / cols)
const W = cellWidth * cols + 10
const H = cellHeight * rowsCount + 10
const preview = new PNG({ width: W, height: H })
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const odd = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0
    const index = (y * W + x) * 4
    preview.data[index] = odd ? 28 : 40
    preview.data[index + 1] = odd ? 36 : 48
    preview.data[index + 2] = odd ? 34 : 46
    preview.data[index + 3] = 255
  }
}

for (const [index, item] of previewItems.entries()) {
  const dx = 5 + (index % cols) * cellWidth + Math.floor((cellWidth - item.w) / 2)
  const dy = 22 + Math.floor(index / cols) * cellHeight
  for (let y = 0; y < item.h; y += 1) {
    for (let x = 0; x < item.w; x += 1) {
      const si = (y * item.w + x) * 4
      if (item.png.data[si + 3] === 0) continue
      const ti = ((dy + y) * W + dx + x) * 4
      preview.data[ti] = item.png.data[si]
      preview.data[ti + 1] = item.png.data[si + 1]
      preview.data[ti + 2] = item.png.data[si + 2]
      preview.data[ti + 3] = 255
    }
  }
}
fs.writeFileSync(path.join(outDir, 'preview.png'), PNG.sync.write(preview))

const atlas = {
  source: path.basename(input),
  scale: SCALE,
  clips: {
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
  },
  frames: frames.map((frame) => ({
    file: frame.file,
    name: frame.name,
    w: frame.w,
    h: frame.h,
    anchor: frame.anchor,
    source: frame.source,
    body: frame.body,
  })),
}
fs.writeFileSync(path.join(outDir, 'atlas.json'), `${JSON.stringify(atlas, null, 2)}\n`)

console.log(`colonos: ${frames.length} quadros · escala 1/${SCALE} · saída ${outDir}`)
console.log(frames.map((frame) => `${frame.name} ${frame.w}x${frame.h}`).join(' | '))
