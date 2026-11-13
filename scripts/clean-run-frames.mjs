// Remove respingos/sujeira soltos dos quadros de corrida e recalcula as âncoras.
import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const dir = 'public/assets/sprites/player'
const atlasPath = path.join(dir, 'atlas.json')
const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'))
const targets = ['r5-c5.png', 'r5-c7.png']

for (const file of targets) {
  const png = PNG.sync.read(fs.readFileSync(path.join(dir, file)))
  const { width, height, data } = png
  const seen = new Uint8Array(width * height)
  const components = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x
      if (seen[start] || data[start * 4 + 3] === 0) continue

      const stack = [start]
      seen[start] = 1
      const pixels = []
      while (stack.length) {
        const index = stack.pop()
        const px = index % width
        const py = (index - px) / width
        pixels.push(index)
        for (const [ox, oy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = px + ox
          const ny = py + oy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const nIndex = ny * width + nx
          if (seen[nIndex] || data[nIndex * 4 + 3] === 0) continue
          seen[nIndex] = 1
          stack.push(nIndex)
        }
      }
      components.push(pixels)
    }
  }

  components.sort((a, b) => b.length - a.length)
  const removed = components.slice(1).reduce((total, pixels) => total + pixels.length, 0)
  for (const pixels of components.slice(1)) {
    for (const index of pixels) data[index * 4 + 3] = 0
  }

  // Recalcula a âncora dos pés.
  let bottom = -1
  for (let y = height - 1; y >= 0 && bottom < 0; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        bottom = y
        break
      }
    }
  }
  let minX = width
  let maxX = -1
  for (let y = Math.max(0, bottom - 2); y <= bottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
  }
  const anchorX = maxX >= minX ? Math.round((minX + maxX) / 2) : Math.floor(width / 2)
  const anchorY = Math.max(0, bottom + 1)

  fs.writeFileSync(path.join(dir, file), PNG.sync.write(png))
  const frame = atlas.frames.find((entry) => entry.file === file)
  if (frame) frame.anchor = { x: anchorX, y: anchorY }
  console.log(`${file}: ${removed} pixels soltos removidos · âncora ${anchorX},${anchorY}`)
}

fs.writeFileSync(atlasPath, `${JSON.stringify(atlas, null, 2)}\n`)
