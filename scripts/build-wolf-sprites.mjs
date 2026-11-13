// Recorta a arte do lobo (boss Kennedy) e monta o atlas das animações.
//
// A folha é um JPEG com fundo branco: o recorte usa o branco como chave.
// Os quadros do lobo são os componentes de tamanho consistente (w >= 40,
// h entre 20 e 36). Eles são ordenados por faixa vertical e repartidos em
// idle, walk, slash, hurt e death.
//
// Uso: node scripts/build-wolf-sprites.mjs
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const input = 'raw/wolf-source.png'
const outDir = 'public/assets/sprites/wolf'
const SCALE = 1

const png = PNG.sync.read(fs.readFileSync(input))
const { width, height, data } = png
const at = (x, y) => {
  const i = (y * width + x) * 4
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

// Fundo branco (com leve ruído de JPEG): o que for quase branco vira transparente.
const isBackground = (r, g, b) => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return min >= 196 && max - min <= 26
}

const mask = new Uint8Array(width * height)
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const [r, g, b] = at(x, y)
    if (!isBackground(r, g, b)) mask[y * width + x] = 1
  }
}

function componentsOf() {
  const seen = new Uint8Array(width * height)
  const list = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x
      if (seen[start] || !mask[start]) continue
      const stack = [start]
      seen[start] = 1
      const pixels = []
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      while (stack.length) {
        const index = stack.pop()
        const px = index % width
        const py = (index - px) / width
        pixels.push(index)
        if (px < minX) minX = px
        if (px > maxX) maxX = px
        if (py < minY) minY = py
        if (py > maxY) maxY = py
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (!ox && !oy) continue
            const nx = px + ox
            const ny = py + oy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const next = ny * width + nx
            if (seen[next] || !mask[next]) continue
            seen[next] = 1
            stack.push(next)
          }
        }
      }
      list.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area: pixels.length, pixels })
    }
  }
  return list
}

const components = componentsOf()
// Quadros do lobo: tamanho consistente e área suficiente.
const wolfFrames = components
  .filter((part) => part.w >= 40 && part.h >= 20 && part.h <= 36 && part.area >= 380)
  .sort((a, b) => a.y - b.y || a.x - b.x)

if (!wolfFrames.length) {
  console.error('Nenhum quadro de lobo encontrado')
  process.exit(1)
}

// Agrupa por faixa vertical (mesma linha da folha).
const bands = []
for (const frame of wolfFrames) {
  const band = bands.find((item) => Math.abs(item.y - frame.y) < 12)
  if (band) {
    band.frames.push(frame)
    band.y = Math.round((band.y + frame.y) / 2)
  } else {
    bands.push({ y: frame.y, frames: [frame] })
  }
}
for (const band of bands) band.frames.sort((a, b) => a.x - b.x)

const ordered = bands.flatMap((band) => band.frames)

const plan = [
  { clip: 'idle', count: 2 },
  { clip: 'walk', count: 4 },
  { clip: 'slash', count: 4 },
  { clip: 'hurt', count: 2 },
  { clip: 'death', count: 4 },
]

const names = []
let cursor = 0
for (const item of plan) {
  for (let i = 0; i < item.count; i += 1) {
    const source = ordered[cursor % ordered.length]
    cursor += 1
    names.push({ clip: item.clip, index: i + 1, source })
  }
}

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

const frames = []
const previewItems = []

for (const item of names) {
  const part = item.source
  const pad = 1
  const cropX = Math.max(0, part.x - pad)
  const cropY = Math.max(0, part.y - pad)
  const cropW = Math.min(width - cropX, part.w + pad * 2)
  const cropH = Math.min(height - cropY, part.h + pad * 2)

  const out = new PNG({ width: Math.ceil(cropW / SCALE), height: Math.ceil(cropH / SCALE) })
  out.data.fill(0)
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const sx = cropX + x * SCALE
      const sy = cropY + y * SCALE
      if (sx >= width || sy >= height) continue
      const [r, g, b] = at(sx, sy)
      if (isBackground(r, g, b)) continue
      const i = (y * out.width + x) * 4
      out.data[i] = r
      out.data[i + 1] = g
      out.data[i + 2] = b
      out.data[i + 3] = 255
    }
  }

  const file = `${item.clip}-${item.index}.png`
  fs.writeFileSync(path.join(outDir, file), PNG.sync.write(out))

  // Âncora nos pés, no centro horizontal do corpo.
  const footXs = []
  const bodyBottom = part.y + part.h
  for (const pixel of part.pixels) {
    const px = pixel % width
    const py = (pixel - px) / width
    if (py >= bodyBottom - 4) footXs.push(px)
  }
  const sorted = [...footXs].sort((a, b) => a - b)
  const footX = sorted.length ? sorted[Math.floor(sorted.length / 2)] : part.x + part.w / 2
  const anchorX = Math.max(1, Math.min(out.width - 1, Math.round(footX - cropX)))
  const anchorY = Math.max(1, Math.min(out.height, Math.round(bodyBottom - cropY)))

  frames.push({
    file,
    name: file.replace('.png', ''),
    w: out.width,
    h: out.height,
    anchor: { x: anchorX, y: anchorY },
    source: { x: cropX, y: cropY, w: cropW, h: cropH },
  })
  previewItems.push({ name: file, png: out })
}

// ------------------------------------------------------ folha de conferência
const cellWidth = Math.max(...previewItems.map((item) => item.png.width)) + 12
const cellHeight = Math.max(...previewItems.map((item) => item.png.height)) + 22
const cols = 6
const rows = Math.ceil(previewItems.length / cols)
const W = cellWidth * cols + 8
const H = cellHeight * rows + 8
const preview = new PNG({ width: W, height: H })
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const odd = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0
    const i = (y * W + x) * 4
    preview.data[i] = odd ? 32 : 44
    preview.data[i + 1] = odd ? 40 : 52
    preview.data[i + 2] = odd ? 38 : 50
    preview.data[i + 3] = 255
  }
}
previewItems.forEach((item, index) => {
  const dx = 4 + (index % cols) * cellWidth + Math.floor((cellWidth - item.png.width) / 2)
  const dy = 18 + Math.floor(index / cols) * cellHeight
  for (let y = 0; y < item.png.height; y += 1) {
    for (let x = 0; x < item.png.width; x += 1) {
      const si = (y * item.png.width + x) * 4
      if (item.png.data[si + 3] === 0) continue
      const ti = ((dy + y) * W + dx + x) * 4
      preview.data[ti] = item.png.data[si]
      preview.data[ti + 1] = item.png.data[si + 1]
      preview.data[ti + 2] = item.png.data[si + 2]
      preview.data[ti + 3] = 255
    }
  }
})
fs.writeFileSync(path.join(outDir, 'preview.png'), PNG.sync.write(preview))

const atlas = {
  source: path.basename(input),
  scale: SCALE,
  clips: {
    idle: { frames: ['idle-1', 'idle-2'], fps: 2.6, loop: true },
    walk: { frames: ['walk-1', 'walk-2', 'walk-3', 'walk-4'], fps: 9, loop: true },
    slash: { frames: ['slash-1', 'slash-2', 'slash-3', 'slash-4'], fps: 12, loop: false },
    hurt: { frames: ['hurt-1', 'hurt-2'], fps: 8, loop: false },
    death: { frames: ['death-1', 'death-2', 'death-3', 'death-4'], fps: 6, loop: false },
  },
  frames,
}
fs.writeFileSync(path.join(outDir, 'atlas.json'), `${JSON.stringify(atlas, null, 2)}\n`)

console.log(`lobo: ${frames.length} quadros · ${bands.length} faixas · saída ${outDir}`)
console.log(frames.map((frame) => `${frame.name} ${frame.w}x${frame.h}`).join(' | '))
