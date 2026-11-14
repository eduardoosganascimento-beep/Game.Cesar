// Recorta a folha de zumbis (8 colunas x 4 linhas, fundo branco) e monta
// o atlas usado pelo jogo. Cada célula vira um quadro com transparência,
// reduzido por média de área e alinhado pela cabeça/pés.
//
// Uso: node scripts/build-zombie-sprites.mjs
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import { resampleArea, padFrames } from './sprite-utils.mjs'

const COLS = 8
const ROWS = 4
const TARGET_BODY = 34
const PAD = 3

const sourceName = fs.readdirSync('.').find((name) => name.startsWith('Spritesheet de zumbi'))
if (!sourceName) throw new Error('Spritesheet de zumbi não encontrada na raiz do projeto')
const outDir = path.join('public', 'assets', 'sprites', 'zombie')

const png = PNG.sync.read(fs.readFileSync(sourceName))
const { width, height, data } = png
const cellW = width / COLS
const cellH = height / ROWS

const at = (x, y) => {
  const i = (y * width + x) * 4
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

const nearWhite = (r, g, b, a) => {
  if (a < 8) return true
  return r > 244 && g > 244 && b > 244
}

// Fundo: inundação a partir das bordas da célula. Isso remove o branco
// externo sem abrir buracos na camisa clara do zumbi.
function backgroundMask(cx, cy) {
  const mask = new Uint8Array(cellW * cellH)
  const stack = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= cellW || y >= cellH) return
    const local = y * cellW + x
    if (mask[local]) return
    const [r, g, b, a] = at(cx + x, cy + y)
    if (!nearWhite(r, g, b, a)) return
    mask[local] = 1
    stack.push(local)
  }
  for (let x = 0; x < cellW; x += 1) {
    push(x, 0)
    push(x, cellH - 1)
  }
  for (let y = 0; y < cellH; y += 1) {
    push(0, y)
    push(cellW - 1, y)
  }
  while (stack.length) {
    const local = stack.pop()
    const x = local % cellW
    const y = (local - x) / cellW
    push(x - 1, y)
    push(x + 1, y)
    push(x, y - 1)
    push(x, y + 1)
  }
  return mask
}

const cells = []
for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    const ox = Math.round(col * cellW)
    const oy = Math.round(row * cellH)
    const bg = backgroundMask(ox, oy)
    let minX = cellW
    let minY = cellH
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < cellH; y += 1) {
      for (let x = 0; x < cellW; x += 1) {
        if (bg[y * cellW + x]) continue
        const [r, g, b, a] = at(ox + x, oy + y)
        if (a < 8) continue
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        void r
        void g
        void b
      }
    }
    if (maxX < 0) continue
    cells.push({ row, col, ox, oy, minX, minY, maxX, maxY, bg })
  }
}

const heights = cells.filter((cell) => cell.row === 0).map((cell) => cell.maxY - cell.minY + 1)
const sorted = [...heights].sort((a, b) => a - b)
const reference = sorted[Math.floor(sorted.length / 2)] || 250
const factor = TARGET_BODY / reference

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

const raw = []
for (const cell of cells) {
  const cropX = Math.max(0, cell.minX - PAD)
  const cropY = Math.max(0, cell.minY - PAD)
  const cropW = Math.min(cellW, cell.maxX + PAD + 1) - cropX
  const cropH = Math.min(cellH, cell.maxY + PAD + 1) - cropY
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
      if (cell.bg[sy * cellW + sx]) continue
      const [r, g, b, a] = at(cell.ox + sx, cell.oy + sy)
      if (a < 8) continue
      const local = y * cropW + x
      crop.mask[local] = 1
      crop.data[local * 4] = r
      crop.data[local * 4 + 1] = g
      crop.data[local * 4 + 2] = b
      crop.data[local * 4 + 3] = 255
    }
  }

  // Âncora horizontal: centro da cabeça (30% de cima). Assim os braços
  // esticados do ataque não deslocam o corpo.
  const headLimit = cell.minY + (cell.maxY - cell.minY + 1) * 0.3
  const headXs = []
  for (let y = cell.minY; y <= Math.min(cell.maxY, Math.ceil(headLimit)); y += 1) {
    for (let x = cell.minX; x <= cell.maxX; x += 1) {
      if (!cell.bg[y * cellW + x]) headXs.push(cell.ox + x)
    }
  }
  headXs.sort((a, b) => a - b)
  const anchorSourceX = headXs[Math.floor(headXs.length / 2)] ?? (cell.ox + cell.minX + cell.maxX) / 2
  const bodyBottom = cell.oy + cell.maxY + 1

  const out = resampleArea(crop, factor, 0.38)
  const anchorX = Math.max(0, Math.min(out.width, Math.round((anchorSourceX - (cell.ox + cropX)) * factor)))
  const anchorY = Math.max(1, Math.min(out.height, Math.ceil((bodyBottom - (cell.oy + cropY)) * factor)))

  raw.push({ col: cell.col, row: cell.row, png: out, anchor: { x: anchorX, y: anchorY } })
}

const prefixes = ['walk', 'idle', 'attack', 'bite']
const frames = raw.map((item) => ({
  file: `${prefixes[item.row]}-${item.col + 1}.png`,
  name: `${prefixes[item.row]}-${item.col + 1}`,
  png: item.png,
  anchor: item.anchor,
}))

const { maxW, maxH } = padFrames(frames)
for (const frame of frames) {
  fs.writeFileSync(path.join(outDir, frame.file), PNG.sync.write(frame.png))
}

const atlas = {
  source: sourceName,
  targetBody: TARGET_BODY,
  clips: {
    idle: { frames: ['idle-1', 'idle-2', 'idle-3', 'idle-4'], fps: 2.2, loop: true },
    walk: { frames: frames.filter((f) => f.name.startsWith('walk')).map((f) => f.name), fps: 9, loop: true },
    slash: { frames: ['attack-1', 'attack-2', 'attack-3', 'attack-4', 'attack-5', 'attack-6'], fps: 11, loop: false },
    hurt: { frames: ['idle-1'], fps: 1, loop: false },
    death: { frames: ['bite-8'], fps: 1, loop: false },
  },
  frames: frames.map((frame) => ({
    file: frame.file,
    name: frame.name,
    w: frame.png.width,
    h: frame.png.height,
    anchor: frame.anchor,
  })),
}
fs.writeFileSync(path.join(outDir, 'atlas.json'), `${JSON.stringify(atlas, null, 2)}\n`)

console.log(`zumbis: ${frames.length} quadros · ${maxW}x${maxH} · saída ${outDir}`)
