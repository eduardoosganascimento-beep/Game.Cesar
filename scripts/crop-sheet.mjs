// Recorta folhas de sprite (PNG) em quadros individuais.
//
// Uso:
//   node scripts/crop-sheet.mjs raw/sandman-poses.png
//   node scripts/crop-sheet.mjs raw/folha.png --out public/assets/sprites/player --cols 8 --rows 5 --scale 4
//
// Estratégia:
//   - a folha é dividida em células (cols x rows)
//   - dentro de cada célula, os desenhos são agrupados
//   - rótulos pequenos (texto) são descartados por altura
//   - o fundo é removido (fica transparente)
//   - o sprite é reduzido por escala inteira (nearest), mantendo pixel art
//   - todos os quadros ficam no mesmo tamanho, com os pés alinhados na base

import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const args = process.argv.slice(2)
const input = args.find((a) => !a.startsWith('--'))
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : fallback
}

const outDir = flag('out', 'public/assets/sprites/player')
const COLS = Number(flag('cols', 8))
const ROWS = Number(flag('rows', 5))
const SCALE = Number(flag('scale', 4))
const MIN_HEIGHT = Number(flag('min-height', 40))
const MIN_AREA = Number(flag('min-area', 150))
const PADDING = 1

if (!input) {
  console.error('Uso: node scripts/crop-sheet.mjs <folha.png> [--out pasta] [--cols 8] [--rows 5] [--scale 4]')
  process.exit(1)
}

const png = PNG.sync.read(fs.readFileSync(input))
const { width, height, data } = png

const at = (x, y) => {
  const i = (y * width + x) * 4
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

// cor de fundo mais frequente
const counts = new Map()
for (let y = 0; y < height; y += 3) {
  for (let x = 0; x < width; x += 3) {
    const [r, g, b, a] = at(x, y)
    if (a < 8) continue
    const key = `${r},${g},${b}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
}
let bgKey = '0,0,0'
let best = -1
for (const [key, count] of counts) {
  if (count > best) {
    best = count
    bgKey = key
  }
}
const bg = bgKey.split(',').map(Number)
const isBg = (r, g, b) => Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) <= 30
const isInk = (x, y) => {
  const [r, g, b, a] = at(x, y)
  if (a < 16) return false
  return !isBg(r, g, b)
}

// ---------- componentes conectados ----------
const mask = new Uint8Array(width * height)
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if (isInk(x, y)) mask[y * width + x] = 1
  }
}

const seen = new Uint8Array(width * height)
const boxes = []

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const start = y * width + x
    if (!mask[start] || seen[start]) continue

    const stack = [start]
    seen[start] = 1
    let minX = x
    let maxX = x
    let minY = y
    let maxY = y
    let area = 0

    while (stack.length) {
      const index = stack.pop()
      const px = index % width
      const py = (index - px) / width
      area += 1
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py

      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue
          const nx = px + ox
          const ny = py + oy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const nIndex = ny * width + nx
          if (!mask[nIndex] || seen[nIndex]) continue
          seen[nIndex] = 1
          stack.push(nIndex)
        }
      }
    }

    boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area })
  }
}

const sprites = boxes.filter((box) => box.area >= 25)

// ---------- distribuir nas células ----------
const cellW = width / COLS
const cellH = height / ROWS

const cells = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => []))

for (const sprite of sprites) {
  const cx = sprite.x + sprite.w / 2
  const cy = sprite.y + sprite.h / 2
  const col = Math.min(COLS - 1, Math.max(0, Math.floor(cx / cellW)))
  const row = Math.min(ROWS - 1, Math.max(0, Math.floor(cy / cellH)))
  cells[row][col].push(sprite)
}

const union = (items) => ({
  x: Math.min(...items.map((i) => i.x)),
  y: Math.min(...items.map((i) => i.y)),
  w: Math.max(...items.map((i) => i.x + i.w)) - Math.min(...items.map((i) => i.x)),
  h: Math.max(...items.map((i) => i.y + i.h)) - Math.min(...items.map((i) => i.y)),
})

// Junta partes do mesmo personagem (cabeça, arma, corpo) e deixa os
// rótulos de texto de fora: eles ficam afastados do desenho principal.
const LINK_GAP = Number(flag('link-gap', 3))
const touches = (a, b) =>
  a.x - LINK_GAP < b.x + b.w &&
  a.x + a.w + LINK_GAP > b.x &&
  a.y - LINK_GAP < b.y + b.h &&
  a.y + a.h + LINK_GAP > b.y

const cluster = (items) => {
  const sorted = [...items].sort((a, b) => b.area - a.area)
  const groups = []

  for (const item of sorted) {
    let group = groups.find((candidate) => candidate.some((member) => touches(member, item)))
    if (!group) {
      group = []
      groups.push(group)
    }
    group.push(item)

    // absorve grupos que passaram a tocar depois da inclusão
    for (let i = groups.length - 1; i >= 0; i -= 1) {
      if (groups[i] === group) continue
      if (groups[i].some((member) => group.some((own) => touches(own, member)))) {
        group.push(...groups[i])
        groups.splice(i, 1)
      }
    }
  }

  groups.sort((a, b) => union(b).area - union(a).area || b.length - a.length)
  return groups
}

const frames = []
for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    const items = cells[row][col]
    if (!items.length) continue
    const groups = cluster(items)
    const main = groups[0]
    if (!main || main.length === 0) continue
    frames.push({ row: row + 1, col: col + 1, box: union(main) })
  }
}

// descarta cenas com dois personagens / efeitos muito maiores que o normal
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
const medianW = median(frames.map((frame) => frame.box.w))
const medianH = median(frames.map((frame) => frame.box.h))
const MAX_RATIO = Number(flag('max-ratio', 1.45))

for (let i = frames.length - 1; i >= 0; i -= 1) {
  const { box } = frames[i]
  if (box.w > medianW * MAX_RATIO || box.h > medianH * MAX_RATIO) frames.splice(i, 1)
}

if (!frames.length) {
  console.error('Nenhum sprite encontrado. Ajuste --min-height / --min-area.')
  process.exit(1)
}

// ---------- reduzir e exportar ----------
const scaled = frames.map((frame) => ({
  ...frame,
  sw: Math.max(1, Math.round(frame.box.w / SCALE)),
  sh: Math.max(1, Math.round(frame.box.h / SCALE)),
}))

const sideW = Math.max(...scaled.map((frame) => frame.sw)) + PADDING * 2
const sideH = Math.max(...scaled.map((frame) => frame.sh)) + PADDING * 2

const atlas = {
  source: path.basename(input),
  scale: SCALE,
  frame: { w: sideW, h: sideH },
  animations: {},
  frames: [],
}

const preview = new PNG({ width: COLS * sideW, height: ROWS * sideH })
preview.data.fill(0)

const blit = (target, sprite, dx, dy) => {
  for (let y = 0; y < sprite.height; y += 1) {
    for (let x = 0; x < sprite.width; x += 1) {
      const si = (y * sprite.width + x) * 4
      if (sprite.data[si + 3] === 0) continue
      const ti = ((dy + y) * target.width + (dx + x)) * 4
      target.data[ti] = sprite.data[si]
      target.data[ti + 1] = sprite.data[si + 1]
      target.data[ti + 2] = sprite.data[si + 2]
      target.data[ti + 3] = sprite.data[si + 3]
    }
  }
}

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

for (const frame of scaled) {
  const { box } = frame
  const out = new PNG({ width: sideW, height: sideH })
  out.data.fill(0)

  const offsetX = Math.floor((sideW - frame.sw) / 2)
  const offsetY = sideH - frame.sh - PADDING

  // reduz por bloco: usa a cor dominante de cada quadrado SCALE x SCALE
  for (let y = 0; y < frame.sh; y += 1) {
    for (let x = 0; x < frame.sw; x += 1) {
      const sx0 = box.x + x * SCALE
      const sy0 = box.y + y * SCALE
      const tally = new Map()
      let total = 0
      let ink = 0

      for (let oy = 0; oy < SCALE; oy += 1) {
        for (let ox = 0; ox < SCALE; ox += 1) {
          const sx = sx0 + ox
          const sy = sy0 + oy
          if (sx >= width || sy >= height) continue
          const [r, g, b, a] = at(sx, sy)
          total += 1
          if (a < 16 || isBg(r, g, b)) continue
          ink += 1
          const key = `${r},${g},${b}`
          tally.set(key, (tally.get(key) ?? 0) + 1)
        }
      }

      if (total === 0 || ink / total < 0.35) continue

      let colorKey = null
      let colorCount = -1
      for (const [key, count] of tally) {
        if (count > colorCount) {
          colorCount = count
          colorKey = key
        }
      }
      if (!colorKey) continue

      const [r, g, b] = colorKey.split(',').map(Number)
      const oi = ((offsetY + y) * sideW + (offsetX + x)) * 4
      out.data[oi] = r
      out.data[oi + 1] = g
      out.data[oi + 2] = b
      out.data[oi + 3] = 255
    }
  }

  // âncora: centro dos pés (últimas linhas com pixels) e base do desenho
  let bottom = -1
  for (let y = sideH - 1; y >= 0 && bottom < 0; y -= 1) {
    for (let x = 0; x < sideW; x += 1) {
      if (out.data[(y * sideW + x) * 4 + 3] > 0) {
        bottom = y
        break
      }
    }
  }

  let minX = sideW
  let maxX = -1
  for (let y = Math.max(0, bottom - 2); y <= bottom; y += 1) {
    for (let x = 0; x < sideW; x += 1) {
      if (out.data[(y * sideW + x) * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
  }

  const anchorX = maxX >= minX ? Math.round((minX + maxX) / 2) : Math.floor(sideW / 2)
  const anchorY = Math.max(0, bottom + 1)

  const name = `r${frame.row}-c${frame.col}.png`
  fs.writeFileSync(path.join(outDir, name), PNG.sync.write(out))
  blit(preview, out, (frame.col - 1) * sideW, (frame.row - 1) * sideH)

  atlas.frames.push({
    file: name,
    row: frame.row,
    col: frame.col,
    w: frame.sw,
    h: frame.sh,
    anchor: { x: anchorX, y: anchorY },
    source: { x: box.x, y: box.y, w: box.w, h: box.h },
  })
}

fs.writeFileSync(path.join(outDir, 'atlas.json'), JSON.stringify(atlas, null, 2) + '\n')
fs.writeFileSync(path.join(outDir, 'preview.png'), PNG.sync.write(preview))

console.log(`quadros: ${frames.length} | quadro: ${sideW}x${sideH}px | escala 1/${SCALE}`)
console.log(`saída: ${outDir}`)
