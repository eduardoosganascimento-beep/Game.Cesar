// Gera os frames do Urso a partir da folha final: cada linha tem quadros
// igualmente espaçados (7 ataque, 6 caminhada, 8 dano).
import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const INPUT = 'raw/ursa-sheet.png'
const OUT_DIR = 'public/assets/sprites/ursa'

const { data, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const width = info.width, height = info.height, channels = info.channels
const at = (x, y) => { const i = (y * width + x) * channels; return [data[i], data[i+1], data[i+2]] }

const bg = []
for (let y = 0; y < height; y += 1) {
  const s = []
  for (let x = Math.max(0, width - 18); x < width - 3; x += 1) s.push(at(x, y))
  s.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))
  bg.push(s[Math.floor(s.length / 2)])
}
function isBackdrop(x, y) {
  const [r, g, b] = at(x, y)
  const [br, bgc, bb] = bg[y]
  if (Math.abs(r - br) + Math.abs(g - bgc) + Math.abs(b - bb) <= 45) return true
  const wr = 255 - br, wg = 255 - bgc, wb = 255 - bb
  const d = wr * wr + wg * wg + wb * wb
  const a = ((r - br) * wr + (g - bgc) * wg + (b - bb) * wb) / d
  if (a <= 0.015 || a >= 0.32) return false
  return Math.abs(br + wr * a - r) + Math.abs(bgc + wg * a - g) + Math.abs(bb + wb * a - b) <= 12
}

const ROWS = [
  { name: 'attack', y0: 4, y1: 48, x0: 118, x1: 337, n: 7 },
  { name: 'walk', y0: 50, y1: 101, x0: 118, x1: 337, n: 6 },
  { name: 'hurt', y0: 101, y1: height - 4, x0: 112, x1: 331, n: 8 },
]

const frameDefs = []
for (const row of ROWS) {
  const step = (row.x1 - row.x0) / row.n
  const slices = []
  let rowGround = -1
  for (let i = 0; i < row.n; i += 1) {
    const xa = Math.round(row.x0 + i * step)
    const xb = Math.round(row.x0 + (i + 1) * step)
    let minX = width, maxX = -1, minY = height, maxY = -1
    const pixels = []
    for (let y = row.y0; y < row.y1; y += 1) {
      for (let x = xa; x < xb; x += 1) {
        if (isBackdrop(x, y)) continue
        pixels.push([x, y])
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    if (maxX < minX) throw new Error(`quadro vazio: ${row.name} ${i}`)
    rowGround = Math.max(rowGround, maxY)
    slices.push({ pixels, minX, maxX, minY, maxY })
  }
  for (let i = 0; i < row.n; i += 1) {
    const s = slices[i]
    const cropW = s.maxX - s.minX + 1
    const cropH = s.maxY - s.minY + 1
    const png = new PNG({ width: cropW, height: cropH })
    for (const [x, y] of s.pixels) {
      const src = (y * width + x) * channels
      const dst = ((y - s.minY) * cropW + (x - s.minX)) * 4
      png.data[dst] = data[src]
      png.data[dst + 1] = data[src + 1]
      png.data[dst + 2] = data[src + 2]
      png.data[dst + 3] = 255
    }
    const name =
      row.name === 'attack' ? `attack-${i + 1}` : row.name === 'walk' ? `walk-${i + 1}` : `hurt-${i + 1}`
    fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), PNG.sync.write(png))
    // Âncora X no centro da parte inferior (corpo), Y no chão da linha.
    const cutoff = s.minY + Math.floor(cropH * 0.62)
    const xs = s.pixels.filter(([, y]) => y >= cutoff).map(([x]) => x)
    xs.sort((a, b) => a - b)
    const anchorX = xs.length
      ? Math.round(xs[Math.floor(xs.length / 2)] - s.minX)
      : Math.round((s.minX + s.maxX) / 2 - s.minX)
    frameDefs.push({
      name,
      file: `${name}.png`,
      w: cropW,
      h: cropH,
      anchor: { x: anchorX, y: Math.min(cropH, Math.max(0, rowGround - s.minY)) },
    })
  }
}

const byName = Object.fromEntries(frameDefs.map((f) => [f.name, f]))
const defs = [
  ...Array.from({ length: 7 }, (_, i) => byName[`attack-${i + 1}`]),
  ...Array.from({ length: 6 }, (_, i) => byName[`walk-${i + 1}`]),
  byName['hurt-1'],  // idle-1 (pose limpa)
  byName['hurt-8'],  // idle-2 (pose limpa)
  byName['hurt-3'],
  byName['hurt-4'],
  byName['hurt-5'],
]
const ordered = [
  ['attack-1','attack-2','attack-3','attack-4','attack-5','attack-6','attack-7'],
  ['walk-1','walk-2','walk-3','walk-4','walk-5','walk-6'],
  ['idle-1','idle-2','hurt-1','hurt-2','hurt-3'],
].flat()
const used = new Set(ordered)
const frames = frameDefs.filter((f) => used.has(f.name)).map((f) => ({
  file: f.file,
  name: f.name,
  w: f.w,
  h: f.h,
  anchor: f.anchor,
}))
// Os quadros de idle reaproveitam hurt-1/hurt-8: cria arquivos aliases.
for (const [alias, source] of [['idle-1', 'hurt-1'], ['idle-2', 'hurt-8']]) {
  fs.copyFileSync(path.join(OUT_DIR, `${source}.png`), path.join(OUT_DIR, `${alias}.png`))
  frames.push({ ...byName[source], name: alias, file: `${alias}.png` })
}
// Remove o frame único provisório.
try { fs.unlinkSync(path.join(OUT_DIR, 'ursa-boss.png')) } catch {}

fs.writeFileSync(path.join(OUT_DIR, 'atlas.json'), JSON.stringify({
  source: 'ursa-sheet.png',
  targetBody: 44,
  clips: {
    idle: { frames: ['idle-1', 'idle-2'], fps: 2.4, loop: true },
    walk: { frames: ['walk-1', 'walk-2', 'walk-3', 'walk-4', 'walk-5', 'walk-6'], fps: 10, loop: true },
    attack: { frames: ['attack-1', 'attack-2', 'attack-3', 'attack-4', 'attack-5', 'attack-6', 'attack-7'], fps: 10, loop: false },
    hurt: { frames: ['hurt-1', 'hurt-2', 'hurt-3'], fps: 12, loop: false },
    death: { frames: ['hurt-1', 'hurt-2', 'hurt-3'], fps: 6, loop: false },
  },
  frames,
}, null, 2) + '\n')
console.log(`Gerados ${frames.length} frames de ${OUT_DIR}`)
for (const f of frames) console.log(`  ${f.name}: ${f.w}x${f.h} anchor=(${f.anchor.x},${f.anchor.y})`)
