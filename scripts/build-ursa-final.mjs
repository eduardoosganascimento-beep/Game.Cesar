// Gera os frames do Urso com o padrão do índio: fundo removido por cor,
// recorte por célula, paleta limpa, escala uniforme e âncora estável.
// Folha: 350x143. Linha 0 = 7 ataques, linha 1 = 6 caminhadas, linha 2 = 8 dano.
import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { componentList, resampleArea, buildPalette, snapPalette, padFrames } from './sprite-utils.mjs'

const INPUT = 'raw/ursa-sheet.png'
const OUT_DIR = 'public/assets/sprites/ursa'
const TARGET_BODY = 46

const { data, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const width = info.width, height = info.height, channels = info.channels
const at = (x, y) => {
  const i = (y * width + x) * channels
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}
// Fundo: moda por linha (listras horizontais) + flood-fill a partir das
// bordas. Remove só o fundo conectado à borda, preservando detalhes do urso.
const bg = []
for (let y = 0; y < height; y += 1) {
  const c = new Map()
  for (let x = 112; x < width; x += 1) {
    const [r, g, b] = at(x, y)
    const k = (r << 16) | (g << 8) | b
    c.set(k, (c.get(k) || 0) + 1)
  }
  const best = [...c.entries()].sort((a, b) => b[1] - a[1])[0]
  bg.push([(best[0] >> 16) & 255, (best[0] >> 8) & 255, best[0] & 255])
}
const isBgColor = (x, y) => {
  const [r, g, b] = at(x, y)
  const [br, bgc, bb] = bg[y]
  return Math.abs(r - br) + Math.abs(g - bgc) + Math.abs(b - bb) <= 75
}
const bgMark = new Uint8Array(width * height)
const stack = []
for (let x = 0; x < width; x += 1) stack.push(x, (height - 1) * width + x)
for (let y = 0; y < height; y += 1) stack.push(y * width, y * width + width - 1)
while (stack.length) {
  const idx = stack.pop()
  if (bgMark[idx]) continue
  const x = idx % width, y = (idx - x) / width
  if (!isBgColor(x, y)) continue
  bgMark[idx] = 1
  if (x > 0) stack.push(idx - 1)
  if (x < width - 1) stack.push(idx + 1)
  if (y > 0) stack.push(idx - width)
  if (y < height - 1) stack.push(idx + width)
}
const inkAt = (x, y) => at(x, y)[3] >= 8 && !bgMark[y * width + x]

const ROWS = [
  // Limites medidos nos vales de tinta da folha (células iguais cortavam poses).
  { name: 'attack', y0: 0, y1: 49, edges: [118, 148, 176, 197, 218, 257, 294, 337], count: 7 },
  { name: 'walk', y0: 49, y1: 101, edges: [118, 152, 194, 230, 266, 301, 337], count: 6 },
  { name: 'hurt', y0: 101, y1: height, edges: [112, 139, 167, 194, 222, 249, 276, 304, 331], count: 8 },
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
  for (let i = 0; i < row.count; i += 1) {
    const xa = Math.max(0, row.edges[i])
    const xb = Math.min(width, row.edges[i + 1])
    const ya = row.y0, yb = row.y1
    const cw = xb - xa, chh = yb - ya
    const mask = new Uint8Array(cw * chh)
    const rgb = new Uint8Array(cw * chh * 4)
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
    const comps = componentList(mask, cw, chh, (idx) => mask[idx] === 1)
      .filter((c) => c.area >= 60)
      .sort((a, b) => b.area - a.area)
    if (!comps.length) throw new Error(`célula vazia: ${row.name} ${i}`)
    // Usa TODOS os componentes grandes: nas poses agachadas o urso se divide
    // em duas metades (corpo + machado) e pegar só o maior cortava metade dele.
    const parts = comps.slice(0, 4)
    const minX = Math.min(...parts.map((c) => c.x))
    const maxX = Math.max(...parts.map((c) => c.x + c.w))
    const minY = Math.min(...parts.map((c) => c.y))
    const maxY = Math.max(...parts.map((c) => c.y + c.h))
    const px = Math.max(0, minX - 2)
    const py = Math.max(0, minY - 2)
    const pw = Math.min(cw - px, maxX - minX + 4)
    const ph = Math.min(chh - py, maxY - minY + 4)
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
    // Centro de massa de TODAS as partes: estável mesmo quando o corpo se divide.
    let massX = 0, massN = 0
    for (const c of parts) {
      for (const pixel of c.pixels) {
        massX += pixel % cw
        massN += 1
      }
    }
    const centerX = massN ? Math.round(massX / massN) : Math.round((minX + maxX) / 2)
    raw.push({
      name: `${prefix}-${i + 1}`,
      crop,
      reference: maxY - minY + 1,
      bodyBottom: maxY + 1,
      headX: centerX,
      cropX: px,
      cropY: py,
    })
  }
}

// Idle: hurt-1 e hurt-2. Morte: hurt-5..8.
for (const [i, name] of ['idle-1', 'idle-2'].entries()) {
  raw.push({ ...raw.find((f) => f.name === `hurt-${i + 1}`), name })
}
for (let i = 0; i < 4; i += 1) {
  raw.push({ ...raw.find((f) => f.name === `hurt-${5 + i}`), name: `death-${i + 1}` })
}

// Escala ÚNICA para todos os quadros. Usar TARGET_BODY / item.reference fazia
// o urso inchar e encolher a cada pose (as de ataque têm 26-45px de altura).
const refs = raw.filter((f) => f.name.startsWith('walk')).map((f) => f.reference).sort((a, b) => a - b)
const factor = TARGET_BODY / (refs[Math.floor(refs.length / 2)] || 44)
const frames = []
for (const item of raw) {
  const out = resampleArea(item.crop, factor, 0.3)
  snapPalette(out, palette)
  const anchorX = Math.max(0, Math.min(out.width, Math.round((item.headX - item.cropX) * factor)))
  // Âncora Y alinhada ao chão: todas as poses assentam na mesma linha de pés.
  const anchorY = Math.max(1, Math.min(out.height, Math.ceil((item.bodyBottom - item.cropY) * factor)))
  frames.push({ name: item.name, file: `${item.name}.png`, png: out, w: out.width, h: out.height, anchor: { x: anchorX, y: anchorY } })
}
padFrames(frames)
// Força TODOS os quadros ao mesmo tamanho (o padFrames alinha âncoras, mas
// cada pose ainda tinha dimensões diferentes → urso "pulava" de tamanho).
{
  const W = Math.max(...frames.map((f) => f.png.width))
  const H = Math.max(...frames.map((f) => f.png.height))
  for (const frame of frames) {
    const square = new PNG({ width: W, height: H })
    square.data.fill(0)
    const dx = Math.round(frame.anchor.x - W / 2)
    const dy = Math.round(frame.anchor.y - H * 0.8)
    for (let y = 0; y < frame.png.height; y += 1) {
      for (let x = 0; x < frame.png.width; x += 1) {
        const si = (y * frame.png.width + x) * 4
        if (frame.png.data[si + 3] === 0) continue
        const tx = x - dx, ty = y - dy
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue
        const ti = (ty * W + tx) * 4
        square.data[ti] = frame.png.data[si]
        square.data[ti + 1] = frame.png.data[si + 1]
        square.data[ti + 2] = frame.png.data[si + 2]
        square.data[ti + 3] = 255
      }
    }
    frame.png = square
    frame.w = W
    frame.h = H
    frame.anchor = { x: Math.round(W / 2), y: Math.round(H * 0.8) }
  }
}

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
