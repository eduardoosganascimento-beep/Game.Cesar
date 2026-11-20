import { VIEW_H, VIEW_W } from './engine'

// Cenários desenhados no próprio jogo (sem pacote externo). A direção é a
// mesma do resto: floresta indígena densa, noite, fumaça, urucum e osso.
// Cada cena tem uma arte estática em cache; fogo, névoa, brasas e raios são
// animados por cima todo quadro.
export type BgScene =
  | 'village-fire'
  | 'waterfall'
  | 'misty-forest'
  | 'temple-night'
  | 'temple-steps'
  | 'forest-dawn'
  | 'river-dawn'

const W = VIEW_W
const H = VIEW_H
const GROUND_Y = 144

// ---------- utilidades de pixel art ----------

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  if (w <= 0 || h <= 0) return
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

// Elipse "pixel": uma faixa de 1 px por linha, sem antialiasing.
function blob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
): void {
  if (rx <= 0 || ry <= 0) return
  ctx.fillStyle = color
  for (let y = -Math.round(ry); y <= Math.round(ry); y += 1) {
    const t = y / ry
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)))
    if (w > 0) ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1)
  }
}

function sky(ctx: CanvasRenderingContext2D, top: string, mid: string, bottom: string): void {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y)
  g.addColorStop(0, top)
  g.addColorStop(0.58, mid)
  g.addColorStop(1, bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function stars(ctx: CanvasRenderingContext2D, count: number, seed: number, alpha: number): void {
  for (let i = 0; i < count; i += 1) {
    const x = Math.floor(hash(seed + i * 1.37) * W)
    const y = Math.floor(hash(seed + i * 2.71 + 9) * 92)
    const bright = hash(seed + i * 4.13 + 3)
    if (bright < 0.35) continue
    ctx.globalAlpha = alpha * (0.35 + bright * 0.65)
    px(ctx, x, y, bright > 0.88 ? 2 : 1, 1, '#d9e4e8')
  }
  ctx.globalAlpha = 1
}

// Copas distantes: uma faixa irregular de elipses escuras.
function farCanopy(
  ctx: CanvasRenderingContext2D,
  baseY: number,
  rx: number,
  ry: number,
  color: string,
  seed: number,
  step = 20,
): void {
  for (let x = -20; x < W + 20; x += step) {
    const jitter = (hash(seed + x * 0.37) - 0.5) * 8
    blob(ctx, x, baseY + jitter, rx * (0.7 + hash(seed + x * 0.91) * 0.5), ry, color)
  }
}

function trunk(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  height: number,
  width: number,
  color: string,
  light: string,
): void {
  const w = Math.max(2, Math.round(width))
  const lean = (hash(x * 1.71) - 0.5) * 8
  for (let y = 0; y < height; y += 1) {
    const t = y / height
    const dx = Math.round(lean * t * t)
    px(ctx, x + dx - w / 2, baseY - height + y, w, 1, color)
  }
  // Luz fria na lateral esquerda do tronco.
  for (let y = 0; y < height; y += 2) {
    const t = y / height
    const dx = Math.round(lean * t * t)
    px(ctx, x + dx - w / 2, baseY - height + y, 1, 1, light)
  }
  // Raízes na base.
  px(ctx, x - w / 2 - 4, baseY - 3, 6, 2, color)
  px(ctx, x + w / 2 - 1, baseY - 3, 5, 2, color)
  px(ctx, x - w / 2 - 2, baseY - 1, 3, 1, color)
}

function tree(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  height: number,
  width: number,
  trunkColor: string,
  trunkLight: string,
  leafColor: string,
  leafLight: string,
  seed: number,
): void {
  trunk(ctx, x, baseY, height, width, trunkColor, trunkLight)
  const cy = baseY - height
  blob(ctx, x + 6, cy + 8, 26, 11, leafColor)
  blob(ctx, x - 18, cy + 14, 20, 9, leafColor)
  blob(ctx, x + 22, cy + 16, 18, 8, leafColor)
  blob(ctx, x, cy + 2, 18, 8, leafColor)
  // Bordas iluminadas por cima.
  ctx.globalAlpha = 0.5
  blob(ctx, x + 2, cy, 12, 3, leafLight)
  blob(ctx, x - 16, cy + 10, 8, 2, leafLight)
  ctx.globalAlpha = 1
  // Cipós.
  for (let i = 0; i < 3; i += 1) {
    const vx = x - 14 + Math.floor(hash(seed + i * 2.3) * 30)
    const len = 10 + Math.floor(hash(seed + i * 5.1) * 22)
    for (let y = 0; y < len; y += 2) {
      px(ctx, vx + Math.round(Math.sin(y * 0.25 + i) * 1.5), cy + 12 + y, 1, 2, '#28331f')
    }
  }
}

// Árvore de floresta com tronco afunilado, galhos e copa em camadas.
function jungleTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  height: number,
  width: number,
  trunk: string,
  trunkLight: string,
  leaf: string,
  leafLight: string,
  seed: number,
): void {
  const lean = (hash(seed * 1.7) - 0.5) * 10
  const topY = baseY - height
  for (let y = 0; y < height; y += 1) {
    const t = y / height
    const w = Math.max(2, Math.round(width * (1 - t * 0.55)))
    const dx = Math.round(lean * t * t)
    px(ctx, x + dx - w / 2, baseY - height + y, w, 1, trunk)
    if (y % 3 === 0) px(ctx, x + dx - w / 2, baseY - height + y, 1, 1, trunkLight)
  }
  // Raízes.
  px(ctx, x - width / 2 - 5, baseY - 3, 7, 2, trunk)
  px(ctx, x + width / 2 - 1, baseY - 3, 6, 2, trunk)
  px(ctx, x - width / 2 - 2, baseY - 1, 4, 1, trunkLight)

  // Galhos subindo para a copa.
  for (const side of [-1, 1]) {
    const branchY = baseY - height * (0.62 + hash(seed + side) * 0.12)
    const reach = 16 + hash(seed + side * 3.1) * 14
    const bx = x + lean * 0.6
    for (let t = 1; t <= reach; t += 1) {
      px(ctx, bx + side * t, branchY - t * 0.55, 2, 1, trunk)
    }
  }

  // Copa: massas sobrepostas, com pontos de luz no topo.
  const topX = x + lean
  blob(ctx, topX, topY + 10, 30, 13, leaf)
  blob(ctx, topX - 22, topY + 18, 20, 10, leaf)
  blob(ctx, topX + 22, topY + 16, 22, 11, leaf)
  blob(ctx, topX - 6, topY + 2, 18, 9, leaf)
  blob(ctx, topX + 12, topY - 2, 13, 7, leaf)
  ctx.globalAlpha = 0.55
  blob(ctx, topX + 2, topY + 1, 13, 4, leafLight)
  blob(ctx, topX - 20, topY + 12, 8, 3, leafLight)
  blob(ctx, topX + 24, topY + 11, 9, 3, leafLight)
  ctx.globalAlpha = 1
  // Folhas pontudas na borda.
  for (let i = 0; i < 7; i += 1) {
    const fx = topX - 26 + i * 9
    const fy = topY + 16 + Math.round(Math.sin(i * 1.7 + seed) * 3)
    px(ctx, fx, fy, 1, 3, leaf)
    px(ctx, fx + 1, fy + 1, 1, 2, leafLight)
  }
}

// Pinheiro em camadas: silhueta recortada contra a névoa.
function pineSilhouette(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  height: number,
  halfW: number,
  color: string,
  edge: string,
  tiers = 7,
): void {
  const topY = baseY - height
  px(ctx, cx - 2, topY + height * 0.55, 4, height * 0.45, color)
  px(ctx, cx - 2, topY + height * 0.55, 1, height * 0.45, edge)
  for (let t = 0; t < tiers; t += 1) {
    const tierTop = topY + (t * height * 0.66) / tiers
    const tierH = (height * 0.66) / tiers + 1
    const w = halfW * (0.3 + (0.7 * (t + 1)) / tiers)
    for (let k = 0; k < tierH; k += 1) {
      const ww = Math.max(2, Math.round(w * (0.35 + (0.65 * k) / tierH)))
      px(ctx, cx - ww / 2, tierTop + k, ww, 1, color)
      px(ctx, cx - ww / 2, tierTop + k, 1, 1, edge)
    }
  }
}

function palm(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  height: number,
  lean: number,
  color: string,
  light: string,
): void {
  for (let y = 0; y < height; y += 1) {
    const t = y / height
    const dx = Math.round(lean * t * t)
    px(ctx, x + dx, baseY - height + y, 2, 1, color)
    if (y % 3 === 0) px(ctx, x + dx, baseY - height + y, 1, 1, light)
  }
  const topX = x + lean
  const topY = baseY - height
  const fronds = 7
  for (let f = 0; f < fronds; f += 1) {
    const dir = f < fronds / 2 ? -1 : 1
    const spread = (f % Math.ceil(fronds / 2)) / 2
    for (let t = 1; t <= 13; t += 1) {
      const fx = topX + dir * t * (0.8 + spread * 0.5)
      const fy = topY + Math.round(t * t * 0.085) - Math.round(spread * 5) - Math.round(t * 0.35)
      px(ctx, fx, fy, 2, 1, t > 8 ? light : color)
      // Folíolos pendurados.
      if (t % 3 === 0) px(ctx, fx, fy + 1, 1, 2, color)
    }
  }
}

function fern(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  size: number,
  color: string,
  light: string,
): void {
  const leaves = 5
  for (let i = 0; i < leaves; i += 1) {
    const dir = i - (leaves - 1) / 2
    const reach = size * (0.6 + 0.4 * (1 - Math.abs(dir) / leaves))
    for (let t = 1; t <= reach; t += 1) {
      const fx = x + dir * t * 0.55
      const fy = baseY - t + Math.round(t * t * 0.03)
      px(ctx, fx, fy, 1, 1, t > reach * 0.7 ? light : color)
    }
  }
}

function rocks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  width: number,
  height: number,
  color: string,
  light: string,
): void {
  blob(ctx, cx, baseY - height / 2, width / 2, height / 2, color)
  ctx.globalAlpha = 0.5
  blob(ctx, cx - width * 0.12, baseY - height * 0.7, width * 0.32, height * 0.16, light)
  ctx.globalAlpha = 1
}

// Maloca: telhado de palha em duas águas, parede de madeira e porta acesa.
function totem(ctx: CanvasRenderingContext2D, x: number, baseY: number, height: number): void {
  const w = 12
  px(ctx, x - w / 2, baseY - height, w, height, '#3b2818')
  px(ctx, x - w / 2, baseY - height, 2, height, '#5c4228')
  const faces = 3
  const fh = height / faces
  for (let i = 0; i < faces; i += 1) {
    const top = baseY - height + i * fh + 3
    // Olhos.
    px(ctx, x - 4, top + 2, 3, 2, '#0d0906')
    px(ctx, x + 2, top + 2, 3, 2, '#0d0906')
    px(ctx, x - 3, top + 2, 1, 1, i === 0 ? '#c9a15a' : '#a33a2a')
    px(ctx, x + 3, top + 2, 1, 1, i === 0 ? '#c9a15a' : '#a33a2a')
    // Boca/zigzag.
    for (let t = -4; t <= 4; t += 2) {
      px(ctx, x + t, top + fh - 6, 1, 2, '#c9a15a')
    }
    // Faixa pintada entre as faces.
    px(ctx, x - w / 2, top + fh - 3, w, 1, '#a33a2a')
  }
  px(ctx, x - w / 2 - 3, baseY - 3, w + 6, 3, '#2a1c11')
}

// Pirâmide de degraus com escadaria central e brilho de luar.
function pyramid(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  width: number,
  height: number,
  stone: string,
  stoneDark: string,
  stoneLight: string,
): void {
  const tiers = 6
  const tierH = height / tiers
  // Plataforma de base.
  px(ctx, cx - width / 2 - 8, baseY - 4, width + 16, 4, stoneDark)
  px(ctx, cx - width / 2 - 8, baseY - 4, width + 16, 1, stoneLight)

  for (let i = 0; i < tiers; i += 1) {
    const t = i / tiers
    const tw = width * (1 - t * 0.66)
    const y = baseY - (i + 1) * tierH
    const left = cx - tw / 2
    px(ctx, left, y, tw, tierH, stone)
    // Bevel: topo claro e base em sombra.
    px(ctx, left, y, tw, 1, stoneLight)
    px(ctx, left, y + tierH - 2, tw, 2, stoneDark)
    px(ctx, left, y, 2, tierH, stoneLight)
    px(ctx, left + tw - 2, y, 2, tierH, stoneDark)
    // Blocos e rachaduras.
    for (let b = 0; b < 7; b += 1) {
      const bx = left + 6 + b * ((tw - 12) / 7)
      px(ctx, bx, y + 2, 1, tierH - 4, stoneDark)
      if (hash(i * 11 + b * 3.7) > 0.66) {
        px(ctx, bx + 2, y + 3 + Math.floor(hash(i + b) * 4), 2, 1, stoneLight)
      }
    }
    // Musgo e folhagem nas quinas.
    if (i % 2 === 0) {
      px(ctx, left, y + tierH - 3, 5, 2, '#26331f')
      px(ctx, left + tw - 5, y + tierH - 2, 5, 2, '#1e2a1b')
      if (i > 1) {
        px(ctx, left + 2, y + tierH - 1, 1, 4, '#2f3d24')
      }
    }
    // Gravações geométricas.
    for (let g = 0; g < 3; g += 1) {
      const gx = left + tw * (0.18 + g * 0.3)
      const gy = y + tierH / 2
      px(ctx, gx, gy, 3, 1, stoneDark)
      px(ctx, gx + 1, gy - 1, 1, 3, stoneDark)
      px(ctx, gx, gy - 2, 3, 1, stoneLight)
    }
  }

  // Escadaria central.
  const stairW = Math.max(12, Math.round(width * 0.13))
  px(ctx, cx - stairW / 2, baseY - height, stairW, height, stoneDark)
  for (let y = baseY - height; y < baseY; y += 5) {
    px(ctx, cx - stairW / 2, y, stairW, 1, stone)
    px(ctx, cx - stairW / 2, y + 1, stairW, 1, stoneDark)
  }
  px(ctx, cx - stairW / 2 - 1, baseY - height, 1, height, stoneLight)
  px(ctx, cx + stairW / 2, baseY - height, 1, height, stoneLight)

  // Altar no topo com dois postes e uma fogueira apagada.
  const topY = baseY - height - 10
  px(ctx, cx - 16, topY, 32, 10, stoneDark)
  px(ctx, cx - 16, topY, 32, 1, stoneLight)
  px(ctx, cx - 16, topY + 8, 32, 2, '#1a1f1b')
  px(ctx, cx - 11, topY - 7, 2, 7, '#2a2018')
  px(ctx, cx + 9, topY - 7, 2, 7, '#2a2018')
  px(ctx, cx - 13, topY - 8, 26, 2, '#2a2018')
  px(ctx, cx - 4, topY - 3, 8, 3, '#0e0b08')
  px(ctx, cx - 1, topY - 5, 2, 2, '#c9a15a')
}

// Pedra em pé com grafismo marajoara.
function stela(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  width: number,
  height: number,
  stone: string,
  dark: string,
  light: string,
  accent: string,
): void {
  px(ctx, x - width / 2, baseY - height, width, height, stone)
  px(ctx, x - width / 2, baseY - height, 2, height, light)
  px(ctx, x + width / 2 - 1, baseY - height, 1, height, dark)
  // Espiral/voluta.
  const cx = x
  const cy = baseY - height * 0.66
  for (let a = 0; a < 12; a += 1) {
    const ang = a * 0.55
    px(ctx, cx + Math.cos(ang) * (2 + a * 0.7), cy + Math.sin(ang) * (2 + a * 0.7), 1, 1, accent)
  }
  // Losangos empilhados.
  for (let i = 0; i < 3; i += 1) {
    const dy = baseY - height * 0.4 + i * 6
    px(ctx, cx, dy, 1, 1, dark)
    px(ctx, cx - 2, dy + 1, 5, 1, dark)
    px(ctx, cx - 3, dy + 2, 7, 1, dark)
    px(ctx, cx - 2, dy + 3, 5, 1, dark)
    px(ctx, cx, dy + 4, 1, 1, dark)
  }
}

function canoe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color: string,
  light: string,
): void {
  const half = width / 2
  for (let i = 0; i < 4; i += 1) {
    const w = half * (1 - i * 0.18)
    px(ctx, x - w + i, y + i, w * 2 - i * 2, 1, i === 0 ? light : color)
  }
  // Proa e popa erguidas.
  px(ctx, x - half, y - 2, 2, 3, color)
  px(ctx, x + half - 1, y - 2, 2, 3, color)
  // Remo.
  for (let i = 0; i < 9; i += 1) {
    px(ctx, x + 3 + i, y - 6 + Math.round(i * 0.4), 1, 1, light)
  }
}

// ---------- cenas estáticas ----------

function paintVillage(ctx: CanvasRenderingContext2D): void {
  sky(ctx, '#06070b', '#150c12', '#3a1416')

  // Clarão de incêndio atrás da mata.
  const glow = ctx.createRadialGradient(160, 138, 8, 160, 138, 180)
  glow.addColorStop(0, 'rgba(255, 140, 40, 0.34)')
  glow.addColorStop(0.46, 'rgba(210, 60, 24, 0.13)')
  glow.addColorStop(1, 'rgba(70, 18, 10, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 20, W, GROUND_Y - 20)

  // Colunas de fumaça escuras subindo entre as árvores.
  for (let i = 0; i < 7; i += 1) {
    const sx = 18 + i * 48
    ctx.globalAlpha = 0.18
    blob(ctx, sx + Math.round(Math.sin(i) * 6), 48, 16 + (i % 3) * 7, 30, '#2b1d2a')
    ctx.globalAlpha = 1
  }

  // Muralha de fogo ao fundo: chamas de alturas diferentes, não colunas iguais.
  const fireWall = (x0: number, x1: number, seed: number): void => {
    const baseY = GROUND_Y - 2
    for (let x = x0; x < x1; x += 1) {
      const h = 14 + Math.floor(hash(x * 1.9 + seed) * 74)
      const topY = baseY - h
      for (let y = 0; y < h; y += 1) {
        const t = y / h
        const color =
          t > 0.82
            ? '#fff3c4'
            : t > 0.58
              ? '#ffb347'
              : t > 0.3
                ? '#f2611f'
                : '#a82718'
        px(ctx, x, topY + y, 1, 1, color)
      }
      // Língua de fogo mais alta de tempos em tempos.
      if (hash(x * 3.1 + seed) > 0.86) {
        const extra = 8 + Math.floor(hash(x * 5.7) * 18)
        for (let y = 0; y < extra; y += 1) {
          px(ctx, x, topY - extra + y, 1, 1, y > extra * 0.6 ? '#ffb347' : '#d8381d')
        }
      }
    }
    // Base contínua de fogo.
    px(ctx, x0, GROUND_Y - 8, x1 - x0, 8, '#e0481d')
    px(ctx, x0, GROUND_Y - 4, x1 - x0, 4, '#ff9a3c')
    px(ctx, x0, GROUND_Y - 1, x1 - x0, 1, '#fff0b0')
  }
  fireWall(0, W, 3)

  // Árvores em silhueta: copas em camadas, como pinheiros queimando.
  const pine = (
    cx: number,
    baseY: number,
    height: number,
    halfW: number,
    color: string,
    edge: string,
  ): void => {
    const topY = baseY - height
    // Tronco.
    px(ctx, cx - 2, topY + height * 0.55, 4, height * 0.45, color)
    px(ctx, cx - 2, topY + height * 0.55, 1, height * 0.45, edge)
    px(ctx, cx - 8, baseY - 3, 8, 2, color)
    px(ctx, cx + 1, baseY - 3, 7, 2, color)

    const tiers = 7
    for (let t = 0; t < tiers; t += 1) {
      const tierTop = topY + (t * height * 0.66) / tiers
      const tierH = (height * 0.66) / tiers + 1
      const w = halfW * (0.3 + (0.7 * (t + 1)) / tiers)
      for (let k = 0; k < tierH; k += 1) {
        const ww = Math.max(2, Math.round(w * (0.35 + (0.65 * k) / tierH)))
        px(ctx, cx - ww / 2, tierTop + k, ww, 1, color)
        px(ctx, cx - ww / 2, tierTop + k, 1, 1, edge)
        if (k > tierH * 0.6 && k % 2 === 0) {
          px(ctx, cx + ww / 2 - 2, tierTop + k, 2, 1, '#1f1220')
        }
      }
    }
  }

  pine(22, GROUND_Y, 104, 26, '#0a0910', '#3b1d26')
  pine(74, GROUND_Y, 84, 20, '#0c0a12', '#452030')
  pine(146, GROUND_Y, 120, 30, '#08080e', '#3a1b24')
  pine(222, GROUND_Y, 92, 22, '#0b0911', '#41202c')
  pine(298, GROUND_Y, 110, 27, '#090810', '#3c1d27')
  pine(186, GROUND_Y, 66, 16, '#110d15', '#4a2430')

  // Fogo na base, com núcleo quase branco.
  for (let i = 0; i < 9; i += 1) {
    const fx = 10 + i * 38
    const fw = 12 + (i % 3) * 6
    const fh = 18 + (i % 4) * 8
    const fy = GROUND_Y - fh
    for (let y = 0; y < fh; y += 1) {
      const t = y / fh
      const w = Math.max(1, Math.round(fw * (1 - t * 0.75)))
      const color = t > 0.78 ? '#fff3c4' : t > 0.52 ? '#ffb347' : '#ef5a1e'
      px(ctx, fx - w / 2, fy + y, w, 1, color)
    }
    blob(ctx, fx, GROUND_Y - 4, fw * 0.7, 4, '#ff8a2b')
  }

  // Brasas espalhadas no chão.
  for (let i = 0; i < 46; i += 1) {
    const x = Math.floor(hash(i * 3.7) * W)
    const y = GROUND_Y - 1 - Math.floor(hash(i * 5.1) * 5)
    px(ctx, x, y, 1 + (i % 2), 1, i % 3 === 0 ? '#ffe9a8' : '#ff7a2a')
  }

  px(ctx, 0, GROUND_Y, W, H - GROUND_Y, '#0a0705')
}

function paintWaterfall(ctx: CanvasRenderingContext2D): void {
  sky(ctx, '#07161b', '#132c30', '#1c3c39')
  farCanopy(ctx, 46, 36, 18, '#10251f', 23, 24)
  farCanopy(ctx, 72, 30, 14, '#0c1d19', 37, 20)

  // Véu de névoa pendurado sobre a garganta.
  for (let i = 0; i < 4; i += 1) {
    ctx.globalAlpha = 0.05 + i * 0.012
    px(ctx, 0, 34 + i * 13, W, 4, '#afc9c0')
    ctx.globalAlpha = 1
  }

  // Paredões: blocos sobrepostos com estratos, musgo e fendas.
  const cliff = (
    left: number,
    right: number,
    seed: number,
    color: string,
    light: string,
    dark: string,
  ): void => {
    for (let y = 20; y < GROUND_Y; y += 5) {
      const wobbleLeft = left + Math.round((hash(seed + y * 0.61) - 0.5) * 9)
      const wobbleRight = right + Math.round((hash(seed + y * 1.17 + 5) - 0.5) * 9)
      const w = wobbleRight - wobbleLeft
      px(ctx, wobbleLeft, y, w, 5, color)
      if (y % 15 === 0) {
        ctx.globalAlpha = 0.55
        px(ctx, wobbleLeft, y, w, 1, dark)
        px(ctx, wobbleLeft, y + 1, w, 1, light)
        ctx.globalAlpha = 1
      }
      if (y % 25 === 5) {
        const cx = wobbleLeft + 4 + Math.floor(hash(seed + y * 2.3) * Math.max(1, w - 8))
        px(ctx, cx, y, 1, 9, dark)
        px(ctx, cx + 2, y + 2, 1, 6, dark)
      }
      if (y % 20 === 10) {
        const mx = wobbleLeft + 3 + Math.floor(hash(seed + y) * Math.max(1, w - 8))
        ctx.globalAlpha = 0.55
        blob(ctx, mx, y + 2, 6, 2, '#27402c')
        ctx.globalAlpha = 1
      }
    }
  }
  cliff(-8, 108, 11, '#1a2624', '#31423a', '#0d1715')
  cliff(212, W + 8, 29, '#182320', '#2e3d34', '#0c1613')
  cliff(-8, 84, 41, '#202c28', '#3a4b3f', '#111b17')
  cliff(236, W + 8, 53, '#1d2824', '#35443a', '#101a16')

  // Laje de granito de onde despenca a água.
  px(ctx, 100, 22, 120, 8, '#26332d')
  px(ctx, 100, 22, 120, 2, '#415348')
  px(ctx, 104, 30, 112, 4, '#0f1c1a')
  for (let x = 104; x < 216; x += 9) px(ctx, x, 26, 2, 2, '#2f3f36')

  // Cachoeira em três quedas, com colunas de água e vãos escuros.
  const fall = (x0: number, x1: number, top: number, bottom: number, seed: number): void => {
    for (let x = x0; x < x1; x += 1) {
      const wobble = Math.round(Math.sin(x * 0.31 + seed) * 1.2)
      const end = bottom + Math.round(hash(x * 1.7 + seed) * 4)
      const dark = hash(x * 3.1 + seed) > 0.78
      px(ctx, x, top + wobble, 1, end - top - wobble, dark ? '#21383a' : '#345456')
      if (x % 5 === 0) px(ctx, x, top + wobble + 2, 1, end - top - 4, '#5d8180')
      if (x % 11 === 0) px(ctx, x, top + wobble + 1, 1, end - top - 3, '#aec7bf')
      if (x % 17 === 0) px(ctx, x, top + wobble, 1, end - top - 2, '#d6e4d9')
    }
  }
  fall(126, 196, 32, 74, 1.3)
  fall(116, 206, 74, 108, 2.7)
  fall(108, 214, 108, 132, 4.1)

  // Espuma nas quebras de nível.
  for (let tier = 0; tier < 2; tier += 1) {
    const y = tier === 0 ? 73 : 107
    for (let i = 0; i < 22; i += 1) {
      const x = 110 + Math.floor(hash(i * 4.3 + tier) * 104)
      const w = 2 + Math.floor(hash(i * 2.7 + tier) * 5)
      px(ctx, x, y + Math.floor(hash(i * 5.9) * 3), w, 1, i % 4 === 0 ? '#e2ece3' : '#a6c0b7')
    }
  }

  // Poço: reflexo do céu, ondulações e espuma onde a água bate.
  px(ctx, 90, 126, 148, 18, '#162e31')
  const pool = ctx.createLinearGradient(0, 126, 0, GROUND_Y)
  pool.addColorStop(0, '#365957')
  pool.addColorStop(1, '#102528')
  ctx.fillStyle = pool
  ctx.fillRect(90, 126, 148, 18)
  for (let i = 0; i < 26; i += 1) {
    const y = 128 + Math.floor(hash(i * 3.3) * 15)
    const x = 94 + Math.floor(hash(i * 7.1) * 138)
    const w = 4 + Math.floor(hash(i * 2.9) * 12)
    px(ctx, x, y, w, 1, i % 5 === 0 ? '#8ba9a1' : '#426760')
  }
  for (let i = 0; i < 20; i += 1) {
    const x = 112 + Math.floor(hash(i * 6.1) * 92)
    const y = 126 + Math.floor(hash(i * 4.7) * 8)
    blob(ctx, x, y, 3 + (i % 4), 2, i % 3 === 0 ? '#d8e7de' : '#9fbbb0')
  }

  // Rio correndo para a direita, com reflexos do céu.
  px(ctx, 0, GROUND_Y - 10, W, 10, '#14282b')
  for (let i = 0; i < 18; i += 1) {
    const y = GROUND_Y - 9 + Math.floor(hash(i * 5.3) * 9)
    const x = Math.floor(hash(i * 1.9) * W)
    px(ctx, x, y, 6 + (i % 5) * 3, 1, i % 3 === 0 ? '#5c7b74' : '#2b4846')
  }

  // Canoa amarrada na margem e pedras molhadas.
  canoe(ctx, 246, GROUND_Y - 12, 38, '#241b12', '#6d5230')
  rocks(ctx, 92, GROUND_Y + 2, 54, 28, '#1c2823', '#35453a')
  rocks(ctx, 232, GROUND_Y + 2, 58, 30, '#19241f', '#314036')

  // Mata emoldurando a cena.
  palm(ctx, 16, GROUND_Y, 96, 12, '#0b1810', '#1b2e1f')
  palm(ctx, 304, GROUND_Y, 88, -10, '#0a1610', '#192a1c')
  fern(ctx, 76, GROUND_Y - 2, 24, '#162a1b', '#33502d')
  fern(ctx, 258, GROUND_Y - 2, 26, '#142617', '#2e4829')
  fern(ctx, 46, GROUND_Y, 16, '#122214', '#294126')
  fern(ctx, 280, GROUND_Y, 16, '#112013', '#263d23')
  // Cipós pendurados no topo.
  for (let i = 0; i < 7; i += 1) {
    const vx = 24 + i * 46
    const len = 10 + Math.floor(hash(i * 3.7) * 22)
    for (let y = 0; y < len; y += 1) {
      px(ctx, vx + Math.round(Math.sin(y * 0.25 + i) * 1.5), y, 1, 1, y > len - 5 ? '#2b442c' : '#182a1d')
    }
  }

  px(ctx, 0, GROUND_Y, W, H - GROUND_Y, '#07100d')
}

// Floresta de pinheiros na névoa, com luz fria filtrada entre as copas.
function paintMistyForest(ctx: CanvasRenderingContext2D): void {
  sky(ctx, '#cfe8c8', '#a7cc9d', '#6f9a70')

  // Sol difuso no centro da clareira.
  const sun = ctx.createRadialGradient(160, 118, 8, 160, 118, 110)
  sun.addColorStop(0, 'rgba(255, 250, 202, 0.6)')
  sun.addColorStop(0.45, 'rgba(220, 240, 180, 0.22)')
  sun.addColorStop(1, 'rgba(180, 220, 170, 0)')
  ctx.fillStyle = sun
  ctx.fillRect(40, 10, 240, GROUND_Y)

  // Névoa em faixas largas, mais forte no meio.
  for (let i = 0; i < 7; i += 1) {
    ctx.globalAlpha = 0.07 + (i % 3) * 0.03
    px(ctx, 0, 34 + i * 15, W, 7, '#eaf5df')
    ctx.globalAlpha = 1
  }

  // Pinheiros distantes: verde-água, quase dissolvidos na névoa.
  for (let x = 6; x < W; x += 26) {
    const h = 40 + Math.floor(hash(x * 1.7) * 34)
    pineSilhouette(ctx, x, GROUND_Y - 6, h, 12, '#7a9c7d', '#9dbb98', 6)
  }

  // Camada média, mais escura.
  for (const x of [24, 62, 104, 146, 190, 232, 276, 312]) {
    const h = 72 + Math.floor(hash(x * 2.3) * 34)
    pineSilhouette(ctx, x, GROUND_Y - 4, h, 20, '#33553e', '#4d7052')
  }

  // Faixa de névoa baixa atravessando a mata.
  for (let i = 0; i < 4; i += 1) {
    ctx.globalAlpha = 0.1 - i * 0.015
    px(ctx, 0, 98 + i * 12, W, 9, '#dcefd2')
    ctx.globalAlpha = 1
  }

  // Pinheiros em primeiro plano: quase pretos, recortados pela luz.
  for (const [x, h, w] of [
    [12, 132, 34],
    [78, 104, 26],
    [154, 142, 36],
    [228, 112, 28],
    [304, 128, 33],
  ] as const) {
    pineSilhouette(ctx, x, GROUND_Y, h, w, '#0a1710', '#1b3021', 8)
  }

  // Capim e samambaias na base.
  for (let i = 0; i < 18; i += 1) {
    const x = Math.floor(hash(i * 4.1) * W)
    const h = 4 + Math.floor(hash(i * 2.7) * 7)
    for (let y = 0; y < h; y += 1) {
      px(ctx, x + Math.round(y * 0.2), GROUND_Y - y, 1, 1, i % 2 ? '#3d5a37' : '#6b8a4a')
    }
  }
  fern(ctx, 48, GROUND_Y, 20, '#1a2c1a', '#3c5530')
  fern(ctx, 268, GROUND_Y, 22, '#172615', '#35502c')

  px(ctx, 0, GROUND_Y, W, H - GROUND_Y, '#08100a')
}

function paintTempleNight(ctx: CanvasRenderingContext2D): void {
  sky(ctx, '#050714', '#0a0f22', '#131429')
  stars(ctx, 90, 17, 0.6)

  // Lua.
  ctx.globalAlpha = 0.18
  blob(ctx, 258, 38, 26, 26, '#c9d8e8')
  ctx.globalAlpha = 1
  blob(ctx, 258, 38, 12, 12, '#d9e2e6')
  blob(ctx, 254, 33, 9, 9, '#eef2ee')

  farCanopy(ctx, 64, 34, 18, '#080d13', 7, 22)
  farCanopy(ctx, 92, 26, 15, '#0a1110', 19, 18)

  // Pirâmide e estelas.
  pyramid(ctx, 154, GROUND_Y - 8, 170, 78, '#39413a', '#232a26', '#59635a')
  stela(ctx, 44, GROUND_Y - 4, 18, 74, '#3a4038', '#222823', '#5a6459', '#a33a2a')
  stela(ctx, 278, GROUND_Y - 4, 16, 64, '#343a34', '#1f2521', '#525c53', '#c9a15a')

  // Três tochas na escadaria e duas na base.
  for (const [x, y] of [
    [128, 128],
    [154, 112],
    [180, 128],
    [100, 142],
    [210, 142],
  ] as const) {
    px(ctx, x - 1, y, 2, 6, '#241a10')
    px(ctx, x - 2, y - 2, 4, 2, '#4a3320')
  }

  // Mata fechando as laterais.
  tree(ctx, 16, GROUND_Y, 74, 8, '#0a0907', '#191710', '#091310', '#132019', 31)
  tree(ctx, 306, GROUND_Y, 78, 8, '#090807', '#17150e', '#08120e', '#121e17', 37)
  palm(ctx, 34, GROUND_Y, 60, 8, '#08120c', '#142418')
  palm(ctx, 288, GROUND_Y, 66, -6, '#08110b', '#132216')

  px(ctx, 0, GROUND_Y, W, H - GROUND_Y, '#06090c')
}

function paintTempleSteps(ctx: CanvasRenderingContext2D): void {
  sky(ctx, '#07120e', '#10251b', '#1b3626')
  farCanopy(ctx, 40, 38, 20, '#0b1a13', 5, 24)
  farCanopy(ctx, 66, 30, 16, '#0a1711', 23, 20)

  // Templo distante no alto da escadaria.
  px(ctx, 130, 22, 60, 12, '#1d2a20')
  px(ctx, 136, 16, 48, 6, '#243327')
  px(ctx, 144, 11, 32, 5, '#1a261d')
  px(ctx, 158, 5, 4, 8, '#2a3a2b')
  px(ctx, 156, 4, 8, 1, '#2a3a2b')
  px(ctx, 150, 28, 20, 6, '#0d1510')
  ctx.globalAlpha = 0.5
  px(ctx, 156, 29, 8, 4, '#c9a15a')
  ctx.globalAlpha = 1

  // Escadaria em perspectiva: cada degrau é mais largo na base.
  const steps = 14
  const topY = 32
  const stepH = 8
  for (let i = 0; i < steps; i += 1) {
    const y = topY + i * stepH
    const t0 = i / steps
    const t1 = (i + 1) / steps
    for (let row = 0; row < stepH; row += 1) {
      const t = t0 + (row / stepH) * (t1 - t0)
      const half = 20 + t * 112
      const left = 160 - half
      const w = half * 2
      let color = '#2f3a30'
      if (row === 0) color = '#4d5c4b'
      else if (row === 1) color = '#3a483b'
      else if (row >= stepH - 2) color = '#1b241d'
      px(ctx, left, y + row, w, 1, color)
      // Juntas de pedra.
      if (row > 2 && row < stepH - 2) {
        const joint = left + 12 + Math.floor(hash(i * 7.1 + row) * Math.max(1, w - 24))
        px(ctx, joint, y + row, 1, 1, '#232d25')
      }
      // Musgo nas bordas.
      if (row >= 2 && row <= 4 && i % 2 === 0) {
        px(ctx, left, y + row, 4, 1, '#24351f')
        px(ctx, left + w - 4, y + row, 4, 1, '#20301c')
      }
    }
  }

  // Muros laterais em perspectiva com grafismos.
  for (let y = 28; y < GROUND_Y; y += 4) {
    const t = (y - 28) / (GROUND_Y - 28)
    const inner = 22 + t * 110
    const outer = inner + 14 + t * 12
    px(ctx, 160 - outer, y, outer - inner, 4, '#222b23')
    px(ctx, 160 + inner, y, outer - inner, 4, '#202820')
    px(ctx, 160 - outer, y, outer - inner, 1, '#39463a')
    px(ctx, 160 + inner, y, outer - inner, 1, '#39463a')
    // Losangos marajoara.
    if (y % 12 === 0) {
      const lx = 160 - outer + 3
      const rx = 160 + inner + 3
      px(ctx, lx + 4, y + 2, 4, 2, '#4b5a40')
      px(ctx, lx + 3, y + 4, 6, 1, '#4b5a40')
      px(ctx, lx + 4, y + 5, 4, 2, '#4b5a40')
      px(ctx, rx + 4, y + 2, 4, 2, '#4b5a40')
      px(ctx, rx + 3, y + 4, 6, 1, '#4b5a40')
      px(ctx, rx + 4, y + 5, 4, 2, '#4b5a40')
    }
  }

  // Dois postes/totens em primeiro plano.
  totem(ctx, 26, GROUND_Y - 2, 96)
  totem(ctx, 296, GROUND_Y - 2, 88)

  // Tochas nos cantos da escada.
  for (const [x, y] of [
    [56, 112],
    [264, 112],
    [48, 82],
    [272, 82],
  ] as const) {
    px(ctx, x - 1, y, 2, 7, '#20160d')
    px(ctx, x - 2, y - 2, 4, 2, '#4a3320')
  }

  // Copa fechando a cena por cima.
  blob(ctx, 60, 8, 90, 22, '#0a150f')
  blob(ctx, 250, 4, 110, 22, '#09130e')
  tree(ctx, 12, GROUND_Y, 82, 9, '#0a0806', '#18150e', '#08120d', '#111d16', 43)
  tree(ctx, 310, GROUND_Y, 84, 9, '#090706', '#17140d', '#07110c', '#101c15', 47)
  palm(ctx, 40, GROUND_Y, 54, 10, '#08120c', '#142418')
  palm(ctx, 282, GROUND_Y, 58, -8, '#07110b', '#132317')

  px(ctx, 0, GROUND_Y, W, H - GROUND_Y, '#060b08')
}

function paintForestDawn(ctx: CanvasRenderingContext2D): void {
  sky(ctx, '#1a2530', '#565248', '#a6744a')

  // Sol baixo, difuso, com halo largo.
  const sun = ctx.createRadialGradient(246, 92, 6, 246, 92, 76)
  sun.addColorStop(0, 'rgba(255, 226, 158, 0.55)')
  sun.addColorStop(0.35, 'rgba(232, 183, 106, 0.28)')
  sun.addColorStop(1, 'rgba(214, 150, 80, 0)')
  ctx.fillStyle = sun
  ctx.fillRect(160, 16, 160, 152)
  blob(ctx, 246, 92, 18, 12, '#f2cf8e')
  ctx.globalAlpha = 0.5
  blob(ctx, 246, 90, 26, 18, '#e8b76a')
  ctx.globalAlpha = 1

  // Névoa em faixas entre as camadas de mata.
  for (let i = 0; i < 5; i += 1) {
    ctx.globalAlpha = 0.06 + i * 0.012
    px(ctx, 0, 70 + i * 11, W, 5, '#d8c39a')
    ctx.globalAlpha = 1
  }

  farCanopy(ctx, 82, 26, 16, '#2a3329', 13, 22)
  farCanopy(ctx, 104, 22, 13, '#1d2a20', 29, 18)

  // Aldeia distante, pequena entre as árvores: o destino de Sandman.
  px(ctx, 214, 108, 34, 10, '#141d15')
  px(ctx, 216, 103, 30, 5, '#22301f')
  px(ctx, 222, 99, 18, 4, '#1a251a')
  px(ctx, 228, 96, 5, 3, '#2c3a25')
  for (let x = 216; x < 248; x += 4) px(ctx, x, 118, 2, 2, '#0f1710')
  ctx.globalAlpha = 0.35
  px(ctx, 236, 92, 1, 7, '#5a5f4c')
  px(ctx, 239, 88, 1, 5, '#4a5042')
  ctx.globalAlpha = 1

  // Árvores médias, com copas recortadas contra a luz.
  jungleTree(ctx, 70, GROUND_Y, 96, 10, '#181610', '#29251a', '#16271c', '#2b3f2a', 3)
  jungleTree(ctx, 170, GROUND_Y, 84, 8, '#161410', '#252217', '#132318', '#273b26', 17)
  jungleTree(ctx, 260, GROUND_Y, 104, 11, '#14120e', '#232016', '#112116', '#253925', 23)

  // Primeiro plano: troncos grossos e raízes.
  jungleTree(ctx, 18, GROUND_Y, 118, 16, '#0f0d0a', '#221e15', '#0d1a12', '#1f3321', 31)
  jungleTree(ctx, 306, GROUND_Y, 110, 14, '#0e0c09', '#201c14', '#0c180f', '#1d301f', 37)

  // Samambaias e capim na base.
  fern(ctx, 54, GROUND_Y, 24, '#1b2c18', '#3c5530')
  fern(ctx, 110, GROUND_Y, 19, '#182715', '#35502c')
  fern(ctx, 204, GROUND_Y, 21, '#172615', '#334d2a')
  fern(ctx, 266, GROUND_Y, 25, '#162413', '#314a28')
  for (let i = 0; i < 12; i += 1) {
    const x = 30 + Math.floor(hash(i * 4.3) * 260)
    const h = 5 + Math.floor(hash(i * 2.7) * 7)
    for (let y = 0; y < h; y += 1) {
      px(ctx, x + Math.round(y * 0.18), GROUND_Y - y, 1, 1, i % 2 ? '#4a5f33' : '#33492a')
    }
  }

  // Aves atravessando o clarão.
  for (const [bx, by] of [
    [198, 52],
    [206, 47],
    [214, 54],
  ] as const) {
    px(ctx, bx, by, 2, 1, '#1a2320')
    px(ctx, bx - 1, by - 1, 1, 1, '#1a2320')
    px(ctx, bx + 2, by - 1, 1, 1, '#1a2320')
  }

  px(ctx, 0, GROUND_Y, W, H - GROUND_Y, '#0b0e08')
}

function paintRiverDawn(ctx: CanvasRenderingContext2D): void {
  sky(ctx, '#1d2b35', '#4e4d46', '#9c7552')

  // Sol nascendo sobre a margem, com reflexo na água.
  const glow = ctx.createRadialGradient(74, 86, 6, 74, 86, 86)
  glow.addColorStop(0, 'rgba(255, 226, 162, 0.5)')
  glow.addColorStop(0.45, 'rgba(232, 183, 106, 0.2)')
  glow.addColorStop(1, 'rgba(214, 150, 80, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 10, 180, 132)
  blob(ctx, 74, 86, 16, 11, '#f6d79a')
  ctx.globalAlpha = 0.5
  blob(ctx, 74, 84, 24, 17, '#e8b76a')
  ctx.globalAlpha = 1

  farCanopy(ctx, 78, 32, 16, '#2b332b', 11, 24)
  farCanopy(ctx, 94, 26, 13, '#202c22', 29, 20)

  // Margem oposta: terra, capim e uma maloca distante.
  px(ctx, 0, 98, W, 12, '#162018')
  for (let x = 0; x < W; x += 2) {
    const h = 2 + Math.floor(hash(x * 0.9) * 6)
    px(ctx, x, 98 - h, 1, h, x % 3 === 0 ? '#2b3b27' : '#22301f')
  }
  px(ctx, 204, 88, 30, 10, '#141d15')
  px(ctx, 206, 84, 26, 4, '#22301f')
  px(ctx, 212, 80, 14, 4, '#1a251a')
  px(ctx, 216, 78, 2, 2, '#2c3a25')

  // Rio: água escura com faixas de corrente e reflexo do sol.
  px(ctx, 0, 110, W, GROUND_Y - 110, '#16282c')
  const water = ctx.createLinearGradient(0, 110, 0, GROUND_Y)
  water.addColorStop(0, '#33514d')
  water.addColorStop(1, '#102326')
  ctx.fillStyle = water
  ctx.fillRect(0, 110, W, GROUND_Y - 110)
  for (let i = 0; i < 22; i += 1) {
    const y = 112 + i * 1.5
    const x = Math.floor(hash(i * 1.7) * (W - 60))
    const w = 14 + Math.floor(hash(i * 3.1) * 44)
    px(ctx, x, y, w, 1, i % 4 === 0 ? '#7c9082' : '#34534f')
    px(ctx, x + w + 14, y, 10 + (i % 5) * 4, 1, '#29443f')
  }
  // Coluna de luz quebrada pela água.
  for (let i = 0; i < 12; i += 1) {
    const y = 112 + i * 3
    const w = 8 + i * 2
    px(ctx, 74 - w / 2, y, w, 1, i % 2 === 0 ? '#b8955e' : '#8a734c')
    if (i % 3 === 0) px(ctx, 74 + w / 2 + 4, y + 1, 3, 1, '#c9a15a')
  }
  // Folhas flutuando.
  for (let i = 0; i < 9; i += 1) {
    const x = 20 + Math.floor(hash(i * 4.3) * 280)
    const y = 116 + Math.floor(hash(i * 2.7) * 24)
    px(ctx, x, y, 2 + (i % 2), 1, i % 3 === 0 ? '#a3894c' : '#4b5f3a')
  }

  // Canoa com remador, na correnteza.
  canoe(ctx, 168, 124, 40, '#241b12', '#6d5230')
  px(ctx, 166, 118, 3, 5, '#5a3019')
  px(ctx, 165, 116, 5, 2, '#2a1c12')
  px(ctx, 171, 119, 12, 1, '#6d5230')

  // Névoa baixa sobre a água.
  for (let i = 0; i < 4; i += 1) {
    ctx.globalAlpha = 0.05 + i * 0.01
    px(ctx, 0, 106 + i * 6, W, 4, '#d8c39a')
    ctx.globalAlpha = 1
  }

  // Margem da frente: pedras, juncos e samambaias.
  px(ctx, 0, GROUND_Y - 10, W, 14, '#121a11')
  rocks(ctx, 44, GROUND_Y + 2, 46, 26, '#1c221a', '#333d2c')
  rocks(ctx, 284, GROUND_Y + 2, 54, 30, '#192018', '#2f3828')
  for (let i = 0; i < 22; i += 1) {
    const x = Math.floor(hash(i * 4.1) * W)
    const y = GROUND_Y - 9 + Math.floor(hash(i * 2.3) * 9)
    px(ctx, x, y, 1, 4 + (i % 5), i % 3 === 0 ? '#6a7541' : '#42502c')
  }
  fern(ctx, 94, GROUND_Y - 4, 22, '#1a2a17', '#39502c')
  fern(ctx, 238, GROUND_Y - 4, 20, '#182716', '#35502a')
  palm(ctx, 12, GROUND_Y, 70, 8, '#0d1810', '#1b2a1a')
  palm(ctx, 304, GROUND_Y, 64, -6, '#0c1710', '#1a2919')

  px(ctx, 0, GROUND_Y, W, H - GROUND_Y, '#090d08')
}

// ---------- animações ----------

const FLAME_LAYERS: ReadonlyArray<readonly [number, string]> = [
  [1, '#a8230f'],
  [0.82, '#d63f14'],
  [0.62, '#f57a17'],
  [0.42, '#ffb32e'],
  [0.22, '#ffe89a'],
]

function drawFlame(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  scale: number,
  time: number,
  seed: number,
): void {
  const sway = Math.sin(time * 5.2 + seed) * 1.7
  const halo = ctx.createRadialGradient(x, baseY - 5, 1, x, baseY - 5, 18 * scale)
  halo.addColorStop(0, 'rgba(255, 160, 52, 0.18)')
  halo.addColorStop(1, 'rgba(255, 90, 20, 0)')
  ctx.fillStyle = halo
  ctx.fillRect(x - 20 * scale, baseY - 24 * scale, 40 * scale, 28 * scale)

  for (let layer = 0; layer < FLAME_LAYERS.length; layer += 1) {
    const [k, color] = FLAME_LAYERS[layer]
    const height = Math.max(2, (10 + Math.sin(time * 9 + seed + layer) * 2.2) * scale * k)
    const half = 3 * scale * k * (1 + 0.1 * Math.sin(time * 7 + seed))
    ctx.fillStyle = color
    for (let i = 0; i < Math.ceil(height); i += 1) {
      const t = i / height
      const w = Math.max(1, Math.round(half * (1 - t * 0.9)))
      const fx = Math.round(x + sway * t + Math.sin(time * 8 + seed + i * 0.9) * t * 1.2)
      const fy = Math.round(baseY - i)
      ctx.fillRect(fx - w, fy, w * 2, 1)
    }
  }
}

function drawMist(ctx: CanvasRenderingContext2D, time: number, strength: number, top = 104): void {
  for (let i = 0; i < 6; i += 1) {
    const y = top + i * 7
    const drift = Math.sin(time * 0.24 + i * 1.8) * 20
    const w = 130 + i * 16
    const x = ((i * 71 + drift + W) % (W + w)) - w / 2
    const grad = ctx.createRadialGradient(x + w / 2, y, 2, x + w / 2, y, w / 2)
    grad.addColorStop(0, `rgba(205, 222, 214, ${(strength * 0.07).toFixed(3)})`)
    grad.addColorStop(1, 'rgba(205, 222, 214, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(x, y - 8, w, 16)
  }
}

function drawGodRays(ctx: CanvasRenderingContext2D, time: number, warm: boolean): void {
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.translate(214, -30)
  ctx.rotate(-0.3)
  for (let i = 0; i < 5; i += 1) {
    const width = 12 + i * 8
    const x = i * 30 - 40 + Math.sin(time * 0.16 + i) * 3
    const beam = ctx.createLinearGradient(x, 0, x, 280)
    const color = warm ? '255, 220, 164' : '190, 220, 208'
    beam.addColorStop(0, `rgba(${color}, ${(0.05 + i * 0.007).toFixed(3)})`)
    beam.addColorStop(0.6, `rgba(${color}, 0.012)`)
    beam.addColorStop(1, `rgba(${color}, 0)`)
    ctx.fillStyle = beam
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + width, 0)
    ctx.lineTo(x + width + 66, 280)
    ctx.lineTo(x + 40, 280)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function drawVillageFire(ctx: CanvasRenderingContext2D, time: number): void {
  // Clarão pulsante subindo pela mata.
  const heat = ctx.createLinearGradient(0, 40, 0, H)
  heat.addColorStop(0, 'rgba(255, 120, 28, 0)')
  heat.addColorStop(0.62, `rgba(255, 96, 22, ${(0.06 + 0.02 * (0.5 + 0.5 * Math.sin(time * 2.6))).toFixed(3)})`)
  heat.addColorStop(1, `rgba(255, 72, 12, ${(0.12 + 0.04 * (0.5 + 0.5 * Math.sin(time * 3.2))).toFixed(3)})`)
  ctx.fillStyle = heat
  ctx.fillRect(0, 0, W, H)

  // Chamas animadas ao longo de toda a base.
  const fires: ReadonlyArray<readonly [number, number, number, number]> = [
    [12, 136, 1.7, 0.4],
    [52, 140, 1.2, 1.7],
    [92, 138, 1.9, 3.1],
    [132, 140, 1.1, 4.6],
    [170, 140, 2.3, 6.2],
    [212, 138, 1.5, 7.9],
    [254, 140, 1.6, 9.4],
    [300, 138, 1.8, 10.8],
  ]
  for (const [x, y, scale, seed] of fires) {
    drawFlame(ctx, x, y, scale, time, seed)
  }

  // Fumaça subindo em blocos.
  ctx.globalAlpha = 0.17
  ctx.fillStyle = '#2b1a2c'
  for (let i = 0; i < 24; i += 1) {
    const base = fires[i % fires.length]
    const p = (time * 0.11 + i / 24) % 1
    const sx = base[0] + Math.sin(time * 0.9 + i * 1.7) * (3 + p * 16)
    const sy = base[1] - 10 - p * 84
    const size = 3 + p * 15
    ctx.fillRect(Math.round(sx), Math.round(sy), Math.round(size), Math.round(size * 0.75))
  }
  ctx.globalAlpha = 1

  // Brasas.
  for (let i = 0; i < 52; i += 1) {
    const bx = (i * 61 + 13) % W
    const by = H - 16 - ((time * (10 + (i % 5)) + i * 17) % 138)
    const flicker = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 6 + i * 1.3))
    ctx.globalAlpha = flicker
    ctx.fillStyle = i % 3 === 0 ? '#ffe066' : '#ff8c1a'
    const size = i % 4 === 0 ? 2 : 1
    ctx.fillRect(Math.round(bx), Math.round(by), size, size)
  }
  ctx.globalAlpha = 1
}

function drawMoonGlow(ctx: CanvasRenderingContext2D, time: number): void {
  const strength = 0.05 + 0.02 * (0.5 + 0.5 * Math.sin(time * 1.4))
  const glow = ctx.createRadialGradient(258, 38, 6, 258, 38, 80)
  glow.addColorStop(0, `rgba(170, 200, 225, ${strength.toFixed(3)})`)
  glow.addColorStop(1, 'rgba(90, 130, 200, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(150, 0, 170, 130)
}

function drawTorchGlow(ctx: CanvasRenderingContext2D, time: number, points: ReadonlyArray<readonly [number, number]>): void {
  for (let i = 0; i < points.length; i += 1) {
    const [x, y] = points[i]
    const flicker = 0.08 + 0.03 * (0.5 + 0.5 * Math.sin(time * 6 + i * 1.9))
    const glow = ctx.createRadialGradient(x, y, 1, x, y, 26)
    glow.addColorStop(0, `rgba(255, 170, 80, ${flicker.toFixed(3)})`)
    glow.addColorStop(1, 'rgba(255, 120, 40, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(x - 28, y - 28, 56, 56)
    drawFlame(ctx, x, y, 0.55, time, i * 2.3)
  }
}

// ---------- cache das artes estáticas ----------

const painters: Record<BgScene, (ctx: CanvasRenderingContext2D) => void> = {
  'village-fire': paintVillage,
  waterfall: paintWaterfall,
  'misty-forest': paintMistyForest,
  'temple-night': paintTempleNight,
  'temple-steps': paintTempleSteps,
  'forest-dawn': paintForestDawn,
  'river-dawn': paintRiverDawn,
}

const cache = new Map<BgScene, HTMLCanvasElement>()

function sceneCanvas(scene: BgScene): HTMLCanvasElement | undefined {
  const cached = cache.get(scene)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.imageSmoothingEnabled = false
  painters[scene](context)
  cache.set(scene, canvas)
  return canvas
}

// Copas em paralaxe: duas camadas de silhueta que deslizam devagar conforme
// a câmera. Dá profundidade sem repetir o cenário central nem custar sprites.
function drawParallaxCanopy(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  night: boolean,
): void {
  const layers = [
    { speed: 0.08, base: 56, step: 52, rx: 30, ry: 15, color: night ? '#101b27' : '#1b2916', alpha: 0.42 },
    { speed: 0.17, base: 84, step: 38, rx: 19, ry: 11, color: night ? '#142334' : '#24371f', alpha: 0.38 },
  ]
  for (const layer of layers) {
    ctx.globalAlpha = layer.alpha
    const offset = -((cameraX * layer.speed) % layer.step)
    for (let x = -layer.step; x < W + layer.step; x += layer.step) {
      const cx = x + offset
      const jitter = (hash(cx * 0.73) - 0.5) * 8
      blob(ctx, cx, layer.base + jitter, layer.rx, layer.ry, layer.color)
      px(ctx, Math.round(cx), layer.base + 6, 2, 34, layer.color)
    }
  }
  ctx.globalAlpha = 1
}

// Vagalumes: pontos de luz que piscam devagar sobre a floresta.
const FIREFLIES = Array.from({ length: 24 }, (_, i) => ({
  x: (i * 73 + 19) % W,
  y: 24 + ((i * 47) % 100),
  phase: i * 1.17,
}))

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  time: number,
  scene: BgScene = 'forest-dawn',
  night = false,
): void {
  ctx.fillStyle = '#070a08'
  ctx.fillRect(0, 0, W, H)
  const canvas = sceneCanvas(scene)
  if (canvas) ctx.drawImage(canvas, 0, 0)
  drawParallaxCanopy(ctx, cameraX, night)

  if (scene === 'village-fire') {
    drawVillageFire(ctx, time)
    drawMist(ctx, time, 0.32, 116)
  }
  if (scene === 'waterfall') {
    drawMist(ctx, time, 1, 100)
    // Brilho da água.
    const sheen = 0.05 + 0.02 * (0.5 + 0.5 * Math.sin(time * 1.2))
    const g = ctx.createLinearGradient(0, 40, 0, GROUND_Y)
    g.addColorStop(0, 'rgba(160, 210, 210, 0)')
    g.addColorStop(1, `rgba(160, 210, 210, ${sheen.toFixed(3)})`)
    ctx.fillStyle = g
    ctx.fillRect(120, 40, 86, GROUND_Y - 40)
  }
  if (scene === 'misty-forest') {
    drawMist(ctx, time, 0.9, 52)
    drawGodRays(ctx, time, false)
  }
  if (scene === 'temple-night') {
    drawMoonGlow(ctx, time)
    drawTorchGlow(ctx, time, [
      [128, 128],
      [154, 112],
      [180, 128],
      [100, 142],
      [210, 142],
    ])
    drawMist(ctx, time, 0.4, 116)
  }
  if (scene === 'temple-steps') {
    drawTorchGlow(ctx, time, [
      [56, 112],
      [264, 112],
      [48, 82],
      [272, 82],
    ])
    drawGodRays(ctx, time, false)
    drawMist(ctx, time, 0.5, 110)
  }
  if (scene === 'forest-dawn') {
    drawGodRays(ctx, time, true)
    drawMist(ctx, time, 0.55, 104)
  }
  if (scene === 'river-dawn') {
    drawGodRays(ctx, time, true)
    drawMist(ctx, time, 0.7, 102)
  }

  // Vagalumes discretos; a aldeia em chamas já tem brasas.
  if (scene !== 'village-fire' && scene !== 'river-dawn') {
    const alpha = night ? 0.45 : 0.18
    for (const fly of FIREFLIES) {
      const x = (fly.x - cameraX * 0.12 + W) % W
      const y = fly.y + Math.sin(time * 0.8 + fly.phase) * 6
      const glow = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 2 + fly.phase))
      ctx.globalAlpha = glow * alpha * 0.55
      ctx.fillStyle = '#ffe9a8'
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4)
      ctx.globalAlpha = glow * alpha
      ctx.fillStyle = '#fff6d0'
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
    }
    ctx.globalAlpha = 1
  }

  // Vinheta suave.
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.98)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,4,0.12)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, W, H)
}
