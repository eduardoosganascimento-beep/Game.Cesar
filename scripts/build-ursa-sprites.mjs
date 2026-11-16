// Gera os quadros do boss Urso a partir da folha original em raw/ursa-sheet.avif.
// A folha tem três linhas de animação (ataque, caminhada e dano) mais uma
// ilustração grande à esquerda, que não entra no jogo. O script recorta cada
// quadro, remove o fundo listrado/marca d'água e grava public/assets/sprites/ursa.
//
// Uso: node scripts/build-ursa-sprites.mjs

import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const INPUT = 'raw/ursa-sheet.avif'
const OUT_DIR = 'public/assets/sprites/ursa'

const { data, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const width = info.width
const height = info.height
const channels = info.channels

const at = (x, y) => {
  const i = (y * width + x) * channels
  return [data[i], data[i + 1], data[i + 2]]
}

// Cor de fundo de cada linha, pela mediana das colunas da borda direita.
const bg = []
for (let y = 0; y < height; y += 1) {
  const samples = []
  for (let x = width - 18; x < width - 3; x += 1) samples.push(at(x, y))
  samples.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))
  bg.push(samples[Math.floor(samples.length / 2)])
}

// O fundo é composto por faixas verde/laranja. A marca d'água é uma mistura
// suave do fundo com branco; os dois são removidos, mas as bordas escuras do
// desenho (que são mais escuras que o fundo) permanecem.
function isBackdrop(x, y) {
  const [r, g, b] = at(x, y)
  const [br, bgc, bb] = bg[y]
  const distance = Math.abs(r - br) + Math.abs(g - bgc) + Math.abs(b - bb)
  if (distance <= 45) return true

  const wr = 255 - br
  const wg = 255 - bgc
  const wb = 255 - bb
  const denom = wr * wr + wg * wg + wb * wb
  const alpha = ((r - br) * wr + (g - bgc) * wg + (b - bb) * wb) / denom
  if (alpha <= 0.015 || alpha >= 0.32) return false
  const er = br + wr * alpha - r
  const eg = bgc + wg * alpha - g
  const eb = bb + wb * alpha - b
  return Math.abs(er) + Math.abs(eg) + Math.abs(eb) <= 12
}

const mask = new Uint8Array(width * height)
for (let y = 8; y < height - 8; y += 1) {
  for (let x = 330; x < width - 4; x += 1) {
    if (!isBackdrop(x, y)) mask[y * width + x] = 1
  }
}

// Componentes conexos: cada sprite vira um componente isolado.
const seen = new Uint8Array(width * height)
const components = []
for (let y = 8; y < height - 8; y += 1) {
  for (let x = 330; x < width - 4; x += 1) {
    const start = y * width + x
    if (!mask[start] || seen[start]) continue
    const stack = [start]
    seen[start] = 1
    const pixels = []
    let minX = x
    let maxX = x
    let minY = y
    let maxY = y
    while (stack.length) {
      const current = stack.pop()
      const cy = Math.floor(current / width)
      const cx = current - cy * width
      pixels.push(current)
      if (cx < minX) minX = cx
      if (cx > maxX) maxX = cx
      if (cy < minY) minY = cy
      if (cy > maxY) maxY = cy
      for (const next of [current - 1, current + 1, current - width, current + width]) {
        if (next < 0 || next >= mask.length || seen[next] || !mask[next]) continue
        const ny = Math.floor(next / width)
        const nx = next - ny * width
        if (nx < 330 || nx >= width - 4 || ny < 8 || ny >= height - 8) continue
        seen[next] = 1
        stack.push(next)
      }
    }
    if (pixels.length >= 100 && maxX - minX >= 20 && maxY - minY >= 20) {
      components.push({ minX, maxX, minY, maxY, pixels })
    }
  }
}

// Separa as linhas da folha.
const rows = { attack: [], walk: [], hurt: [] }
for (const component of components) {
  const centerY = (component.minY + component.maxY) / 2
  if (centerY < 175) rows.attack.push(component)
  else if (centerY < 335) rows.walk.push(component)
  else rows.hurt.push(component)
}
for (const list of Object.values(rows)) list.sort((a, b) => a.minX - b.minX)

if (rows.attack.length < 7 || rows.walk.length < 6 || rows.hurt.length < 8) {
  throw new Error(
    `Folha inesperada: ataque=${rows.attack.length}, caminhada=${rows.walk.length}, dano=${rows.hurt.length}`,
  )
}

// Linha 3, em ordem: 0 e 7 são as poses limpas (idle); 2, 3 e 4 têm o sangue
// do impacto e viram o hurt; a morte usa os mesmos quadros e é finalizada
// pela queda procedural no jogo.
const defs = [
  ...rows.attack.slice(0, 7).map((component, index) => ({
    name: `attack-${index + 1}`,
    component,
  })),
  ...rows.walk.slice(0, 6).map((component, index) => ({
    name: `walk-${index + 1}`,
    component,
  })),
  { name: 'idle-1', component: rows.hurt[0] },
  { name: 'idle-2', component: rows.hurt[7] },
  { name: 'hurt-1', component: rows.hurt[2] },
  { name: 'hurt-2', component: rows.hurt[3] },
  { name: 'hurt-3', component: rows.hurt[4] },
]

// Linha do chão de cada faixa, para o pé ficar sempre na mesma altura.
function groundLineFor(component) {
  const centerY = (component.minY + component.maxY) / 2
  if (centerY < 175) return 164
  if (centerY < 335) return 328
  return 464
}

function lowerBodyAnchorX(component) {
  const h = component.maxY - component.minY + 1
  const cutoff = component.minY + Math.floor(h * 0.62)
  const xs = []
  for (const pixel of component.pixels) {
    const y = Math.floor(pixel / width)
    if (y >= cutoff) xs.push(pixel - y * width)
  }
  if (!xs.length) return Math.floor((component.minX + component.maxX) / 2) - component.minX
  xs.sort((a, b) => a - b)
  return Math.round(xs[Math.floor(xs.length / 2)] - component.minX)
}

fs.rmSync(OUT_DIR, { recursive: true, force: true })
fs.mkdirSync(OUT_DIR, { recursive: true })

const atlasFrames = []
for (const { name, component } of defs) {
  const cropW = component.maxX - component.minX + 1
  const cropH = component.maxY - component.minY + 1
  const png = new PNG({ width: cropW, height: cropH })
  for (const pixel of component.pixels) {
    const y = Math.floor(pixel / width)
    const x = pixel - y * width
    const source = pixel * channels
    const target = ((y - component.minY) * cropW + (x - component.minX)) * 4
    png.data[target] = data[source]
    png.data[target + 1] = data[source + 1]
    png.data[target + 2] = data[source + 2]
    png.data[target + 3] = 255
  }
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), PNG.sync.write(png))

  const ground = groundLineFor(component)
  atlasFrames.push({
    file: `${name}.png`,
    name,
    w: cropW,
    h: cropH,
    anchor: {
      x: lowerBodyAnchorX(component),
      y: Math.min(cropH, ground - component.minY),
    },
  })
}

const atlas = {
  source: 'ursa-sheet.avif',
  targetBody: 44,
  clips: {
    idle: { frames: ['idle-1', 'idle-2'], fps: 2.4, loop: true },
    walk: {
      frames: ['walk-1', 'walk-2', 'walk-3', 'walk-4', 'walk-5', 'walk-6'],
      fps: 10,
      loop: true,
    },
    attack: {
      frames: ['attack-1', 'attack-2', 'attack-3', 'attack-4', 'attack-5', 'attack-6', 'attack-7'],
      fps: 10,
      loop: false,
    },
    hurt: { frames: ['hurt-1', 'hurt-2', 'hurt-3'], fps: 12, loop: false },
    death: { frames: ['hurt-1', 'hurt-2', 'hurt-3'], fps: 6, loop: false },
  },
  frames: atlasFrames,
}

fs.writeFileSync(path.join(OUT_DIR, 'atlas.json'), `${JSON.stringify(atlas, null, 2)}\n`)
console.log(`Ursa: ${atlasFrames.length} quadros gerados em ${OUT_DIR}`)
