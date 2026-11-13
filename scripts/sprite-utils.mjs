// Utilidades compartilhadas pelos geradores de sprites.
//
// - componentList: separa a folha em manchas de pixels (corpos, efeitos, lixo)
// - resampleArea: reduz a arte com média de área (sem serrilhado)
// - buildPalette / snapPalette: devolve os pixels à paleta original, o que
//   deixa o desenho limpo como pixel art de verdade
import { PNG } from 'pngjs'

export function componentList(mask, w, h, predicate) {
  const seen = new Uint8Array(w * h)
  const list = []
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const start = y * w + x
      if (seen[start] || !predicate(start)) continue
      const stack = [start]
      seen[start] = 1
      const pixels = []
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      while (stack.length) {
        const index = stack.pop()
        const px = index % w
        const py = (index - px) / w
        pixels.push(index)
        if (px < minX) minX = px
        if (px > maxX) maxX = px
        if (py < minY) minY = py
        if (py > maxY) maxY = py
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (!ox && !oy) continue
            const nx = px + ox
            const ny = py + oy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            const next = ny * w + nx
            if (seen[next] || !predicate(next)) continue
            seen[next] = 1
            stack.push(next)
          }
        }
      }
      list.push({
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
        area: pixels.length,
        pixels,
      })
    }
  }
  return list
}

// Reduz a arte por média de área. `factor` é o quanto a imagem cresce
// (1/SCALE no pipeline antigo).
export function resampleArea(source, factor, coverage = 0.42) {
  const outW = Math.max(1, Math.round(source.w * factor))
  const outH = Math.max(1, Math.round(source.h * factor))
  const out = new PNG({ width: outW, height: outH })
  out.data.fill(0)

  for (let oy = 0; oy < outH; oy += 1) {
    const sy0 = oy / factor
    const sy1 = (oy + 1) / factor
    for (let ox = 0; ox < outW; ox += 1) {
      const sx0 = ox / factor
      const sx1 = (ox + 1) / factor
      let alphaArea = 0
      let red = 0
      let green = 0
      let blue = 0
      for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy += 1) {
        if (sy < 0 || sy >= source.h) continue
        const wy = Math.max(0, Math.min(sy1, sy + 1) - Math.max(sy0, sy))
        if (wy <= 0) continue
        for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx += 1) {
          if (sx < 0 || sx >= source.w) continue
          const wx = Math.max(0, Math.min(sx1, sx + 1) - Math.max(sx0, sx))
          if (wx <= 0) continue
          if (!source.mask[sy * source.w + sx]) continue
          const weight = wx * wy
          alphaArea += weight
          const index = (sy * source.w + sx) * 4
          red += source.data[index] * weight
          green += source.data[index + 1] * weight
          blue += source.data[index + 2] * weight
        }
      }
      const totalArea = (sx1 - sx0) * (sy1 - sy0)
      if (!totalArea) continue
      if (alphaArea / totalArea < coverage) continue
      const index = (oy * outW + ox) * 4
      out.data[index] = Math.round(red / alphaArea)
      out.data[index + 1] = Math.round(green / alphaArea)
      out.data[index + 2] = Math.round(blue / alphaArea)
      out.data[index + 3] = 255
    }
  }
  return out
}

// Paleta da folha: agrupa tons parecidos antes de escolher as cores.
//
// A arte veio de uma imagem com anti-aliasing, então cada tom aparece em
// centenas de variações quase iguais. Contar cor exata fazia o vermelho do
// uniforme dos colonos desaparecer da paleta (sobravam só o preto do contorno
// e o branco da pluma), e os inimigos viravam fantasmas brancos. Agrupando por
// faixas de 14 níveis, as cores reais da arte sobrevivem à redução.
export function buildPalette(samples, limit = 96, bucketSize = 14) {
  const buckets = new Map()
  for (const [r, g, b] of samples) {
    const qr = Math.min(255, Math.floor(r / bucketSize))
    const qg = Math.min(255, Math.floor(g / bucketSize))
    const qb = Math.min(255, Math.floor(b / bucketSize))
    const key = (qr << 16) | (qg << 8) | qb
    let entry = buckets.get(key)
    if (!entry) {
      entry = { r: 0, g: 0, b: 0, count: 0 }
      buckets.set(key, entry)
    }
    entry.r += r
    entry.g += g
    entry.b += b
    entry.count += 1
  }
  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => [
      Math.round(entry.r / entry.count),
      Math.round(entry.g / entry.count),
      Math.round(entry.b / entry.count),
    ])
}

// Devolve cada pixel à cor mais próxima da paleta: o sprite fica com as
// mesmas cores da arte original, sem manchas de cor misturada.
export function snapPalette(png, palette) {
  if (!palette.length) return png
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] === 0) continue
    const r = png.data[i]
    const g = png.data[i + 1]
    const b = png.data[i + 2]
    let best = 0
    let bestDist = Infinity
    for (let p = 0; p < palette.length; p += 1) {
      const [pr, pg, pb] = palette[p]
      const dr = r - pr
      const dg = g - pg
      const db = b - pb
      const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11
      if (dist < bestDist) {
        bestDist = dist
        best = p
      }
    }
    png.data[i] = palette[best][0]
    png.data[i + 1] = palette[best][1]
    png.data[i + 2] = palette[best][2]
  }
  return png
}

// Escreve um conjunto de quadros com o mesmo tamanho e com a MESMA âncora
// visual em todos eles. Não basta centralizar o recorte: cada quadro tem uma
// quantidade diferente de arma/efeito de um lado, então o corpo acabava em
// posições diferentes e o personagem tremia. Aqui o quadro é deslocado até a
// âncora (centro da cabeça/base dos pés) cair sempre no mesmo pixel.
export function padFrames(frames) {
  const maxAbove = Math.max(...frames.map((frame) => frame.anchor.y))
  const maxBelow = Math.max(...frames.map((frame) => frame.png.height - frame.anchor.y))
  const maxLeft = Math.max(...frames.map((frame) => frame.anchor.x))
  const maxRight = Math.max(...frames.map((frame) => frame.png.width - frame.anchor.x))

  const maxW = maxLeft + maxRight + 2
  const maxH = maxAbove + maxBelow + 2
  const targetAX = maxLeft + 1
  const targetAY = maxAbove + 1

  for (const frame of frames) {
    const originalW = frame.png.width
    const originalH = frame.png.height
    const padded = new PNG({ width: maxW, height: maxH })
    padded.data.fill(0)
    const dx = targetAX - frame.anchor.x
    const dy = targetAY - frame.anchor.y
    for (let y = 0; y < originalH; y += 1) {
      for (let x = 0; x < originalW; x += 1) {
        const si = (y * originalW + x) * 4
        if (frame.png.data[si + 3] === 0) continue
        const tx = dx + x
        const ty = dy + y
        if (tx < 0 || ty < 0 || tx >= maxW || ty >= maxH) continue
        const ti = (ty * maxW + tx) * 4
        padded.data[ti] = frame.png.data[si]
        padded.data[ti + 1] = frame.png.data[si + 1]
        padded.data[ti + 2] = frame.png.data[si + 2]
        padded.data[ti + 3] = frame.png.data[si + 3]
      }
    }
    frame.png = padded
    frame.anchor = { x: targetAX, y: targetAY }
    frame.w = maxW
    frame.h = maxH
  }
  return { maxW, maxH }
}
