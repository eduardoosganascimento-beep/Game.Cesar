import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const dir = 'public/assets/sprites/player'
const atlas = JSON.parse(fs.readFileSync(path.join(dir, 'atlas.json'), 'utf8'))
const names = process.argv.slice(2)
const wanted = names.length
  ? names
  : ['r4-c2', 'r4-c5', 'r4-c6', 'r5-c1', 'r5-c3', 'r5-c5', 'r5-c7', 'r2-c1', 'r2-c2', 'r2-c4', 'r1-c1', 'r5-c3']
const S = 8
const cols = 6
const cellW = 27 * S + 16
const cellH = 32 * S + 30
const rows = Math.ceil(wanted.length / cols)
const W = cols * cellW + 8
const H = rows * cellH + 8
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#101820"/>`

wanted.forEach((name, index) => {
  const frame = atlas.frames.find((f) => f.file === `${name}.png`)
  if (!frame) return
  const b64 = fs.readFileSync(path.join(dir, frame.file)).toString('base64')
  const x = 8 + (index % cols) * cellW
  const y = 8 + Math.floor(index / cols) * cellH
  // checkerboard
  for (let cy = 0; cy < 32; cy += 8) {
    for (let cx = 0; cx < 27; cx += 8) {
      const odd = ((cx / 8) + (cy / 8)) % 2 === 0
      svg += `<rect x="${x + cx * S}" y="${y + 24 + cy * S}" width="${8 * S}" height="${8 * S}" fill="${odd ? '#1b2733' : '#22303e'}"/>`
    }
  }
  svg += `<image x="${x}" y="${y + 24}" width="${27 * S}" height="${32 * S}" image-rendering="pixelated" href="data:image/png;base64,${b64}"/>`
  svg += `<text x="${x + 2}" y="${y + 16}" fill="#ffd166" font-family="monospace" font-size="14">${name}</text>`
  svg += `<text x="${x + 2}" y="${y + 24 + 32 * S - 4}" fill="#7f95a8" font-family="monospace" font-size="11">anchor ${frame.anchor.x},${frame.anchor.y} · ${frame.w}x${frame.h}</text>`
})

svg += '</svg>'
await sharp(Buffer.from(svg)).png().toFile('raw/run-strip.png')
console.log('ok', W, H)
