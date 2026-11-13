import fs from 'node:fs'
import { PNG } from 'pngjs'

const src = 'raw/referencias/f0bac687-9edc-4d41-a5b7-f9ff80eed522.png'
const png = PNG.sync.read(fs.readFileSync(src))
const { width, height, data } = png
const at = (x, y) => {
  const i = (y * width + x) * 4
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}
const isBg = (r, g, b, a) => a < 16 || (b > r + 10 && b > g + 6 && b > 25)

const cols = 8
const rows = 5
const cellW = width / cols
const cellH = height / rows

for (let row = 0; row < rows; row += 1) {
  const parts = []
  for (let col = 0; col < cols; col += 1) {
    const x0 = Math.round(col * cellW)
    const y0 = Math.round(row * cellH)
    const x1 = Math.round((col + 1) * cellW)
    const y1 = Math.round((row + 1) * cellH)
    let minX = x1
    let minY = y1
    let maxX = x0
    let maxY = y0
    let count = 0
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const [r, g, b, a] = at(x, y)
        if (isBg(r, g, b, a)) continue
        count += 1
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    parts.push(`c${col + 1}:${maxX - minX + 1}x${maxY - minY + 1}[${count}]`)
  }
  console.log(`row ${row + 1}`, parts.join(' '))
}
