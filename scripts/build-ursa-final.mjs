// Gera os frames do Urso com o padrão do índio/colono: fundo removido por
// cor exada da borda + regras, componente conectado por célula, paleta limpa,
// escala uniforme e âncora estável (cabeça / pés).
import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { componentList, resampleArea, buildPalette, snapPalette, padFrames } from './sprite-utils.mjs'

const INPUT = 'raw/ursa-sheet.png'
const OUT_DIR = 'public/assets/sprites/ursa'
const TARGET_BODY = 44

const { data, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const width = info.width, height = info.height, channels = info.channels
const at = (x, y) => {
  const i = (y * width + x) * channels
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}
const bg = []
for (let y = 0; y < height; y += 1) {
  const s = []
  for (let x = width - 25; x < width - 1; x += 1) s.push(at(x, y))
  s.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))
  bg.push(s[Math.floor(s.length / 2)])
}
function isBg(x, y, r, g, b) {
  const [br, bgc, bb] = bg[y]
  const d = Math.sqrt((r - br) ** 2 + (g - bgc) ** 2 + (b - bb) ** 2)
  if (d < 55) return true
  const green = g > r + 3 && g > b + 3 && r > 60 && r < 160
  const orange = r > 170 && g > 95 && g < 215 && b < 115
  return green || orange
}
const inkAt = (x, y) => {
  const [r, g, b, a] = at(x, y)
  return a >= 8 && !isBg(x, y, r, g, b)
}

const ROWS = [
  { name: 'attack', y0: 0, y1: 49, x0: 118, x1: 337, count: 7 },
  { name: 'walk', y0: 49, y1: 101, x0: 118, x1: 337, count: 6 },
  { name: 'hurt', y0: 101, y1: height, x0: 112, x1: 331, count: 8 },
]

const paletteSamples = []
for (let y = 0; y < height; y += 2) {
  for (let x = 108; x < width; x += 2) {
    if (inkAt(x, y)) paletteSamples.push(at(x, y).slice(0, 3))
  }
}
const palette = buildPalette(paletteSamples, 110)

const raw = []
for (const row of ROWS) {
  const step = (row.x1 - row.x0) / row.count
  for (let i = 0; i < row.count; i += 1) {
    const xa = Math.max(0, Math.round(row.x0 + i * step))
    const xb = Math.min(width, Math.round(row.x0 + (i + 1) * step))
    const ya = row.y0, yb = row.y1
    const cw = xb - xa, ch = yb - ya
    const mask = new Uint8Array(cw * ch)
    const rgb = new Uint8Array(cw * ch * 4)
    for (let y = ya; y < yb; y += 1) {
      for (let x = xa; x < xb; x += 1) {
        if (!inkAt(x, y)) continue
        const idx = (y - ya) * cw + (x - xa)
        mask[idx] = 1
        const [r, g, b] = at(x, y)
        rgb[idx * 4] = r
        rgb[idx * 4 + 1] = g
        rgb[idx * 4 + 2] = b
        rgb[idx * 4 + 3] = 255
      }
    }
    const comps = componentList(mask, cw, ch, (idx) => mask[idx] === 1)
      .filter((c) => c.area >= 80)
      .sort((a, b) => b.area - a.area)
    if (!comps.length) throw new Error(`célula vazia: ${row.name} ${i}`)
    const body = comps[0]
    // Recorte colado no componente (2px de borda), sem vizinhos.
    const px = Math.max(0, body.x - 2)
    const py = Math.max(0, body.y - 2)
    const pw = Math.min(cw - px, body.w + 4)
    const ph = Math.min(ch - py, body.h + 4)
    const crop = { w: pw, h: ph, mask: new Uint8Array(pw * ph), data: new Uint8Array(pw * ph * 4) }
    for (let y = py; y < py + ph; y += 1) {
      for (let x = px; x < px + pw; x += 1) {
        const src = (y * cw + x) * 4
        if (rgb[src + 3] === 0) continue
        const dst = ((y - py) * pw + (x - px)) * 4
        crop.mask[(y - py) * pw + (x - px)] = 1
        crop.data[dst] = rgb[src]
        crop.data[dst + 1] = rgb[src + 1]
        crop.data[dst + 2] = rgb[src + 2]
        crop.data[dst + 3] = 255
      }
    }
    const prefix = row.name === 'attack' ? 'attack' : row.name === 'walk' ? 'walk' : 'hurt'
    const headXs = []
    const headLimit = body.y + body.h * 0.32
    for (const pixel of body.pixels) {
      const cx = pixel % cw
      const cy = (pixel - cx) / cw
      if (cy <= headLimit) headXs.push(cx)
    }
    headXs.sort((a, b) => a - b)
    raw.push({
      name: `${prefix}-${i + 1}`,
      crop,
      reference: body.h,
      bodyBottom: body.y + body.h,
      headX: headXs.length ? headXs[Math.floor(headXs.length / 2)] : body.x + body.w / 2,
      cropX: px,
      cropY: py,
    })
  }
}

for (const [i, name] of ['idle-1', 'idle-2'].entries()) {
  raw.push({ ...raw.find((f) => f.name === `hurt-${i + 1}`), name })
}
for (let i = 0; i < 4; i += 1) {
  raw.push({ ...raw.find((f) => f.name === `hurt-${5 + i}`), name: `death-${i + 1}` })
}

const refs = raw.filter((f) => f.name.startsWith('walk')).map((f) => f.reference).sort((a, b) => a - b)
const baseFactor = TARGET_BODY / (refs[Math.floor(refs.length / 2)] || 44)
const frames = []
for (const item of raw) {
  const factor = Math.max(baseFactor * 0.9, Math.min(baseFactor * 1.1, TARGET_BODY / item.reference))
  const out = resampleArea(item.crop, factor, 0.3)
  snapPalette(out, palette)
  const anchorX = Math.max(0, Math.min(out.width, Math.round((item.headX - item.cropX) * factor)))
  const anchorY = Math.max(1, Math.min(out.height, Math.ceil((item.bodyBottom - item.cropY) * factor)))
  frames.push({ name: item.name, file: `${item.name}.png`, png: out, w: out.width, h: out.height, anchor: { x: anchorX, y: anchorY } })
}
padFrames(frames)

fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.mkdirSync(OUT_DIR, { recursive: true })
for (const frame of frames) fs.writeFileSync(path.join(OUT_DIR, frame.file), PNG.sync.write(frame.png))
fs.writeFileSync(path.join(OUT_DIR, 'atlas.json'), JSON.stringify({
  source: 'ursa-sheet.png',
  targetBody: TARGET_BODY,
  clips: {
    idle: { frames: ['idle-1', 'idle-2'], fps: 2.4, loop: true },
    walk: { frames: ['walk-1', 'walk-2', 'walk-3', 'walk-4', 'walk-5', 'walk-6'], fps: 10, loop: true },
    attack: { frames: ['attack-1', 'attack-2', 'attack-3', 'attack-4', 'attack-5', 'attack-6', 'attack-7'], fps: 11, loop: false },
    hurt: { frames: ['hurt-1', 'hurt-2', 'hurt-3'], fps: 12, loop: false },
    death: { frames: ['death-1', 'death-2', 'death-3', 'death-4'], fps: 7, loop: false },
  },
  frames: frames.map((f) => ({ file: f.file, name: f.name, w: f.w, h: f.h, anchor: f.anchor })),
}, null, 2) + '\n')
console.log(`Urso: ${frames.length} quadros (${frames[0].w}x${frames[0].h})`)
