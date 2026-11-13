import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const names = ['r1-c1', 'r4-c5', 'r5-c5', 'r5-c7', 'r4-c2']
const dir = 'public/assets/sprites/player'
const scale = 14
const frameW = 27
const frameH = 32
const cellW = frameW * scale + 8
const W = cellW * names.length + 8
const H = frameH * scale + 34
const images = []

for (const name of names) {
  const b64 = fs.readFileSync(path.join(dir, `${name}.png`)).toString('base64')
  images.push({ name, b64 })
}

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#22303e"/>`
images.forEach((image, index) => {
  const x = 8 + index * cellW
  svg += `<image x="${x}" y="30" width="${frameW * scale}" height="${frameH * scale}" image-rendering="pixelated" href="data:image/png;base64,${image.b64}"/>`
  svg += `<text x="${x + 3}" y="20" fill="#ffd166" font-family="monospace" font-size="15">${image.name}</text>`
})
svg += '</svg>'
await sharp(Buffer.from(svg)).png().toFile('raw/faces.png')
console.log('ok')
