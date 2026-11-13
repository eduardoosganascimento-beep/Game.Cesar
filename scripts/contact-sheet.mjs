import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const dir = 'public/assets/sprites/player'
const atlas = JSON.parse(fs.readFileSync(path.join(dir, 'atlas.json'), 'utf8'))
const S = 4
const cw = atlas.frame.w * S
const ch = atlas.frame.h * S
const pad = 26
const W = 8 * (cw + 8) + 8
const H = 5 * (ch + pad) + 8
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#1e2936"/>`

for (const f of atlas.frames) {
  const b64 = fs.readFileSync(path.join(dir, f.file)).toString('base64')
  const x = 8 + (f.col - 1) * (cw + 8)
  const y = 8 + (f.row - 1) * (ch + pad)
  svg += `<rect x="${x}" y="${y + 18}" width="${cw}" height="${ch}" fill="#2b3a4a" stroke="#3f5568"/>`
  svg += `<image x="${x}" y="${y + 18}" width="${cw}" height="${ch}" image-rendering="pixelated" href="data:image/png;base64,${b64}"/>`
  svg += `<text x="${x + 3}" y="${y + 13}" fill="#ffd166" font-family="monospace" font-size="12">r${f.row}c${f.col}</text>`
}
svg += '</svg>'

await sharp(Buffer.from(svg)).png().toFile('raw/contact.png')
console.log('ok', W, H)
