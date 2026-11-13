// Recorta a folha de Sandman pose a pose e monta o atlas do jogador.
//
// Funciona com as duas folhas do projeto:
//
//  - folha antiga (800x800, 8 colunas, com rótulos)
//  - folha nova OIP (500x500, 7 colunas, sem rótulos)
//
// O fundo é medido na própria imagem (cor dominante da borda) e removido por
// distância de cor. Depois de recortar, todos os quadros são normalizados
// para a MESMA altura de personagem (--target) e as cores voltam à paleta
// original: o desenho fica limpo, nítido e com o mesmo porte dos colonos.
//
// Uso: node scripts/build-player-sprites.mjs [--input raw/player-oip.png] [--cols 7] [--rows 7]
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import { buildPalette, componentList, padFrames, resampleArea, snapPalette } from './sprite-utils.mjs'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : fallback
}

const input = flag('input', 'raw/player-new-source.png')
const outDir = flag('out', 'public/assets/sprites/player')
const TARGET_BODY = Number(flag('target', 36))
const COLS = Number(flag('cols', 8))
const ROWS = Number(flag('rows', 7))
const PAD = 2

const png = PNG.sync.read(fs.readFileSync(input))
const { width, height, data } = png
const at = (x, y) => {
  const i = (y * width + x) * 4
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

const cellW = width / COLS
const cellH = height / ROWS

// Layout: nome -> clip de animação. A folha é lida por linhas de componentes,
// então a quantidade de quadros vem do próprio desenho.
const CLIP_ORDER = ['idle', 'run', 'jump', 'throw', 'melee', 'hurt', 'death']
const FPS = {
  idle: 5,
  run: 13,
  jump: 10,
  throw: 13,
  melee: 18,
  hurt: 10,
  death: 7,
}

const median = (values) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// ------------------------------------------------------- fundo da folha
// A cor de fundo é a mais comum na borda da imagem.
const border = []
for (let x = 0; x < width; x += 2) {
  border.push(at(x, 0), at(x, height - 1))
}
for (let y = 0; y < height; y += 2) {
  border.push(at(0, y), at(width - 1, y))
}
const channelMedian = (index) => median(border.map((color) => color[index]))
const BG = [channelMedian(0), channelMedian(1), channelMedian(2)]
const BG_TOLERANCE = 26

const isBackground = (r, g, b) =>
  Math.abs(r - BG[0]) <= BG_TOLERANCE &&
  Math.abs(g - BG[1]) <= BG_TOLERANCE &&
  Math.abs(b - BG[2]) <= BG_TOLERANCE

const mask = new Uint8Array(width * height)
const paletteSamples = []
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const [r, g, b] = at(x, y)
    if (isBackground(r, g, b)) continue
    mask[y * width + x] = 1
    if (x % 2 === 0 && y % 2 === 0) paletteSamples.push([r, g, b])
  }
}
console.log(`fundo estimado: ${BG.join(',')}`)

// Grade vertical da folha antiga: só remove onde a cor é neutra.
for (let col = 1; col < COLS; col += 1) {
  const boundary = Math.round(col * cellW)
  for (let y = 0; y < height; y += 1) {
    for (let x = boundary - 1; x <= boundary; x += 1) {
      if (x < 0 || x >= width || !mask[y * width + x]) continue
      const [r, g, b] = at(x, y)
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (max - min <= 16 && max < 180) mask[y * width + x] = 0
    }
  }
}

// ------------------------------------------------------- corpos e efeitos
const parts = componentList(mask, width, height, (index) => mask[index] === 1)
// O corpo é o maior componente do quadro; efeitos (poeira, faísca) são menores.
const bodies = parts.filter((part) => part.area >= 500)
if (!bodies.length) {
  console.error('Nenhum corpo encontrado na folha')
  process.exit(1)
}

// Agrupa os corpos por linha da folha (mesma altura na origem).
const rows = []
for (const body of [...bodies].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2))) {
  const center = body.y + body.h / 2
  const row = rows.find((item) => Math.abs(item.center - center) < 26)
  if (row) {
    row.bodies.push(body)
    row.center = (row.center + center) / 2
  } else {
    rows.push({ center, bodies: [body] })
  }
}
for (const row of rows) row.bodies.sort((a, b) => a.x - b.x)

// A folha pode ter mais linhas do que clipes (rótulos antigos viram linhas).
// Usa as linhas mais populadas, na ordem de cima para baixo.
rows.sort((a, b) => a.center - b.center)
const usedRows = rows.filter((row) => row.bodies.length >= 3).slice(0, CLIP_ORDER.length)

// 1) Recorta todos os quadros sem reduzir.
const raw = []
usedRows.forEach((row, rowIndex) => {
  const clip = CLIP_ORDER[rowIndex] ?? `extra${rowIndex}`
  for (const body of row.bodies) {
    // Efeitos próximos do corpo entram no mesmo quadro.
    const included = [body]
    for (const part of parts) {
      if (part === body || part.area < 40 || part.area >= 500) continue
      const gapX = Math.max(body.x - (part.x + part.w), part.x - (body.x + body.w), 0)
      const gapY = Math.max(body.y - (part.y + part.h), part.y - (body.y + body.h), 0)
      if (gapX > 36 || gapY > 30) continue

      // No quadro em que a lança já está voando, ela aparece solta ao lado do
      // corpo. Esse componente não é parte do Sandman: se entrasse no quadro,
      // o jogo desenharia uma segunda lança flutuando. Peças compridas e
      // separadas do corpo são projéteis, não poeira ou faísca.
      const detached = gapX > 2 || gapY > 2
      const flyingProjectile = detached && part.w > part.h * 2.2 && part.w > 28
      if (flyingProjectile) continue

      included.push(part)
    }

    const include = new Uint8Array(width * height)
    for (const part of included) for (const pixel of part.pixels) include[pixel] = 1

    const minX = Math.max(0, Math.min(...included.map((part) => part.x)) - PAD)
    const minY = Math.max(0, Math.min(...included.map((part) => part.y)) - PAD)
    const maxX = Math.min(width, Math.max(...included.map((part) => part.x + part.w)) + PAD)
    const maxY = Math.min(height, Math.max(...included.map((part) => part.y + part.h)) + PAD)
    const cropW = maxX - minX
    const cropH = maxY - minY

    const crop = {
      w: cropW,
      h: cropH,
      mask: new Uint8Array(cropW * cropH),
      data: new Uint8Array(cropW * cropH * 4),
    }
    for (let y = 0; y < cropH; y += 1) {
      for (let x = 0; x < cropW; x += 1) {
        const sourceIndex = (minY + y) * width + (minX + x)
        if (!include[sourceIndex]) continue
        const local = y * cropW + x
        crop.mask[local] = 1
        const [r, g, b] = at(minX + x, minY + y)
        crop.data[local * 4] = r
        crop.data[local * 4 + 1] = g
        crop.data[local * 4 + 2] = b
        crop.data[local * 4 + 3] = 255
      }
    }

    const lying = body.w > body.h
    const reference = lying ? body.w : body.h
    const bodyBottom = body.y + body.h

    // Âncora no centro da cabeça (parte de cima do corpo), não na ponta dos
    // pés. Nos quadros de corrida a perna vai longe para a frente/trás; usar
    // os pés fazia o Sandman pular vários pixels para o lado a cada quadro.
    const headXs = []
    const headLimit = body.y + body.h * 0.3
    for (const pixel of body.pixels) {
      const px = pixel % width
      const py = (pixel - px) / width
      if (py <= headLimit) headXs.push(px)
    }

    raw.push({
      name: `${clip}-${row.bodies.indexOf(body) + 1}`,
      clip,
      crop,
      body,
      reference,
      lying,
      anchorSourceX: lying ? body.x + body.w / 2 : median(headXs),
      bodyBottom,
      minX,
      minY,
    })
  }
})

if (!raw.length) {
  console.error('Nenhum quadro recortado')
  process.exit(1)
}

// 2) Altura única para todos os quadros (com limite para não deformar poses).
const standingRefs = raw
  .filter((item) => !item.lying && (item.clip === 'idle' || item.clip === 'run'))
  .map((item) => item.reference)
const baseFactor =
  TARGET_BODY / (median(standingRefs) || median(raw.map((item) => item.reference)))
const palette = buildPalette(paletteSamples, 110)

const frames = []
for (const item of raw) {
  const factor = Math.max(
    baseFactor * 0.86,
    Math.min(baseFactor * 1.14, TARGET_BODY / item.reference),
  )
  const image = resampleArea(item.crop, factor)
  snapPalette(image, palette)

  const anchorX = Math.max(
    0,
    Math.min(image.width, Math.round((item.anchorSourceX - item.minX) * factor)),
  )
  const anchorY = Math.max(
    1,
    Math.min(image.height, Math.ceil((item.bodyBottom - item.minY) * factor)),
  )

  frames.push({
    name: item.name,
    png: image,
    w: image.width,
    h: image.height,
    anchor: { x: anchorX, y: anchorY },
    source: { x: item.minX, y: item.minY, w: item.crop.w, h: item.crop.h },
    body: { x: item.body.x, y: item.body.y, w: item.body.w, h: item.body.h },
  })
}

// 3) Mesmo tamanho para todos os quadros + âncora corrigida.
const { maxW, maxH } = padFrames(frames)

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

for (const frame of frames) {
  fs.writeFileSync(path.join(outDir, `${frame.name}.png`), PNG.sync.write(frame.png))
}

// ------------------------------------------------------ folha de conferência
const cellWidth = maxW + 14
const cellHeight = maxH + 26
const cols = 7
const rowsCount = Math.ceil(frames.length / cols)
const W = cellWidth * cols + 10
const H = cellHeight * rowsCount + 10
const preview = new PNG({ width: W, height: H })
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const odd = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0
    const i = (y * W + x) * 4
    preview.data[i] = odd ? 30 : 42
    preview.data[i + 1] = odd ? 38 : 50
    preview.data[i + 2] = odd ? 36 : 48
    preview.data[i + 3] = 255
  }
}
frames.forEach((frame, index) => {
  const dx = 5 + (index % cols) * cellWidth + Math.floor((cellWidth - maxW) / 2)
  const dy = 22 + Math.floor(index / cols) * cellHeight
  for (let y = 0; y < maxH; y += 1) {
    for (let x = 0; x < maxW; x += 1) {
      const si = (y * maxW + x) * 4
      if (frame.png.data[si + 3] === 0) continue
      const ti = ((dy + y) * W + dx + x) * 4
      preview.data[ti] = frame.png.data[si]
      preview.data[ti + 1] = frame.png.data[si + 1]
      preview.data[ti + 2] = frame.png.data[si + 2]
      preview.data[ti + 3] = 255
    }
  }
})
fs.writeFileSync(path.join(outDir, 'preview.png'), PNG.sync.write(preview))

const clips = {}
for (const clip of CLIP_ORDER) {
  const names = frames
    .filter((frame) => frame.name.startsWith(`${clip}-`))
    .map((frame) => frame.name)
  if (!names.length) continue
  clips[clip === 'melee' ? 'attack' : clip] = {
    frames: names,
    fps: FPS[clip] ?? 8,
    loop: clip === 'idle' || clip === 'run',
  }
}
if (clips.jump) {
  clips.jump.loop = false
  clips.fall = { frames: [clips.jump.frames[clips.jump.frames.length - 1]], fps: 1, loop: false }
}

const atlas = {
  source: path.basename(input),
  targetBody: TARGET_BODY,
  clips,
  frames: frames.map((frame) => ({
    file: `${frame.name}.png`,
    name: frame.name,
    w: frame.w,
    h: frame.h,
    anchor: frame.anchor,
    source: frame.source,
    body: frame.body,
  })),
}
fs.writeFileSync(path.join(outDir, 'atlas.json'), `${JSON.stringify(atlas, null, 2)}\n`)

console.log(`Sandman: ${frames.length} quadros · corpo ${TARGET_BODY}px · quadro ${maxW}x${maxH}`)
console.log(frames.map((frame) => `${frame.name} ${frame.w}x${frame.h}`).join(' | '))
