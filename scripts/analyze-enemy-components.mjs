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

const mask = new Uint8Array(width * height)
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const [r, g, b, a] = at(x, y)
    if (!isBg(r, g, b, a)) mask[y * width + x] = 1
  }
}
const seen = new Uint8Array(width * height)
const components = []
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
          if (!ox && !oy) continue
          const nx = px + ox
          const ny = py + oy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const n = ny * width + nx
          if (!mask[n] || seen[n]) continue
          seen[n] = 1
          stack.push(n)
        }
      }
    }
    if (area >= 40) components.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area })
  }
}
components.sort((a, b) => b.area - a.area)
console.log('components', components.length)
for (const component of components.slice(0, 80)) {
  console.log(JSON.stringify(component))
}
