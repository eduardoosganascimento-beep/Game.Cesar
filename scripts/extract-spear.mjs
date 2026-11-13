// Extrai a lança em voo da própria folha de Sandman (quadro throw-4).
//
// O desenho da lança é um componente solto ao lado do corpo. Este script isola
// esse componente, aplica a mesma paleta e a mesma escala do personagem e grava
// um sprite próprio para o projétil. Assim a lança que voa é exatamente a que
// aparece saindo da mão no PNG original.
//
// Uso: node scripts/extract-spear.mjs [--input raw/player-oip.png] [--target 36]
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'
import { buildPalette, componentList, resampleArea, snapPalette } from './sprite-utils.mjs'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : fallback
}

const input = flag('input', 'raw/player-oip.png')
const TARGET_BODY = Number(flag('target', 36))
const outDir = flag('out', 'public/assets/sprites/projectile')
const PAD = 1

const png = PNG.sync.read(fs.readFileSync(input))
const { width, height, data } = png
const at = (x, y) => {
  const i = (y * width + x) * 4
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

const median = (values) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// O fundo é a cor dominante da borda, como no gerador do jogador.
const border = []
for (let x = 0; x < width; x += 2) border.push(at(x, 0), at(x, height - 1))
for (let y = 0; y < height; y += 2) border.push(at(0, y), at(width - 1, y))
const BG = [0, 1, 2].map((channel) => median(border.map((color) => color[channel])))
const isBackground = (r, g, b) =>
  Math.abs(r - BG[0]) <= 26 && Math.abs(g - BG[1]) <= 26 && Math.abs(b - BG[2]) <= 26

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

const parts = componentList(mask, width, height, (index) => mask[index] === 1)
const bodies = parts.filter((part) => part.area >= 500)

// Escala do gerador do jogador: mediana da altura dos corpos em pé (idle/run).
const standing = bodies.filter((body) => body.y < height * 0.35)
const baseFactor = TARGET_BODY / (median(standing.map((body) => body.h)) || 67)

// A lança solta é o componente comprido e fino que não toca no corpo. Pode
// haver outros (efeitos), então escolhemos o maior.
const candidates = parts.filter(
  (part) =>
    part.area < 500 &&
    part.w > part.h * 2.2 &&
    part.w > 24 &&
    !bodies.some(
      (body) =>
        part.x < body.x + body.w &&
        part.x + part.w > body.x &&
        part.y < body.y + body.h &&
        part.y + part.h > body.y,
    ),
)
candidates.sort((a, b) => b.w * b.h - a.w * a.h)
const spear = candidates[0]
if (!spear) {
  console.error('Não encontrei a lança solta na folha')
  process.exit(1)
}

const minX = Math.max(0, spear.x - PAD)
const minY = Math.max(0, spear.y - PAD)
const maxX = Math.min(width, spear.x + spear.w + PAD)
const maxY = Math.min(height, spear.y + spear.h + PAD)
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
    const sx = minX + x
    const sy = minY + y
    if (!mask[sy * width + sx]) continue
    const local = y * cropW + x
    crop.mask[local] = 1
    const [r, g, b] = at(sx, sy)
    crop.data[local * 4] = r
    crop.data[local * 4 + 1] = g
    crop.data[local * 4 + 2] = b
    crop.data[local * 4 + 3] = 255
  }
}

const palette = buildPalette(paletteSamples, 110)
const image = resampleArea(crop, baseFactor)
snapPalette(image, palette)

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'spear.png'), PNG.sync.write(image))
fs.writeFileSync(
  path.join(outDir, 'spear.json'),
  `${JSON.stringify({ file: 'spear.png', w: image.width, h: image.height, ax: image.width / 2, ay: image.height / 2 }, null, 2)}\n`,
)
console.log(
  `lança: ${image.width}x${image.height} · fonte ${spear.x},${spear.y} ${spear.w}x${spear.h} · escala ${baseFactor.toFixed(3)}`,
)
