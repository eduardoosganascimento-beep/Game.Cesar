import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const src = 'raw/referencias/f0bac687-9edc-4d41-a5b7-f9ff80eed522.png'
const cols = 8
const rows = 5
const cellW = 1536 / cols
const cellH = 1024 / rows
const meta = await sharp(src).metadata()

for (let band = 0; band < 3; band += 1) {
  const firstRow = band * 2
  const lastRow = Math.min(rows - 1, firstRow + 1)
  const S = 1.5
  const gap = 6
  const label = 18
  const cw = cellW * S
  const ch = cellH * S
  const W = Math.round(cols * (cw + gap) + gap)
  const H = Math.round((lastRow - firstRow + 1) * (ch + label + gap) + gap)
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#101820"/>`

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = gap + col * (cw + gap)
      const y = gap + (row - firstRow) * (ch + label + gap)
      const name = `r${row + 1}-c${col + 1}`
      const b64 = (
        await sharp(src)
          .extract({ left: Math.round(col * cellW), top: Math.round(row * cellH), width: Math.round(cellW), height: Math.round(cellH) })
          .png()
          .toBuffer()
      ).toString('base64')
      svg += `<text x="${x + 3}" y="${y + 14}" fill="#ffd166" font-family="monospace" font-size="13">${name}</text>`
      svg += `<image x="${x}" y="${y + label}" width="${cw}" height="${ch}" image-rendering="pixelated" href="data:image/png;base64,${b64}"/>`
    }
  }
  svg += '</svg>'
  await sharp(Buffer.from(svg)).png().toFile(`raw/enemy-grid-${band + 1}.png`)
  console.log(`raw/enemy-grid-${band + 1}.png`, W, H)
}
