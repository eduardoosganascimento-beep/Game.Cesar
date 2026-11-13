import fs from 'node:fs'
import { PNG } from 'pngjs'

const png = PNG.sync.read(fs.readFileSync(process.argv[2] ?? 'raw/sandman-poses.png'))
const { width, height, data } = png

const at = (x, y) => {
  const i = (y * width + x) * 4
  return [data[i], data[i + 1], data[i + 2], data[i + 3]]
}

// fundo = cor do canto
const bg = at(0, 0)
const isInk = (x, y) => {
  const [r, g, b, a] = at(x, y)
  if (a < 16) return false
  return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 40
}

const colSum = new Array(width).fill(0)
const rowSum = new Array(height).fill(0)
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    if (!isInk(x, y)) continue
    colSum[x] += 1
    rowSum[y] += 1
  }
}

const runs = (sum, minGap = 2) => {
  const out = []
  let start = -1
  let gap = 0
  for (let i = 0; i < sum.length; i += 1) {
    if (sum[i] > 0) {
      if (start < 0) start = i
      gap = 0
    } else if (start >= 0) {
      gap += 1
      if (gap >= minGap) {
        out.push([start, i - gap])
        start = -1
        gap = 0
      }
    }
  }
  if (start >= 0) out.push([start, sum.length - 1])
  return out
}

console.log('tamanho:', width, 'x', height)
console.log('fundo:', bg)
console.log('runs de colunas:', JSON.stringify(runs(colSum)))
console.log('runs de linhas:', JSON.stringify(runs(rowSum)))
