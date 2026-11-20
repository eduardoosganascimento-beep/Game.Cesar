// Chão desenhado no próprio jogo: terra, capim, raízes, pedras, água e
// estacas. Cada capítulo tem sua paleta, mas todos seguem a mesma direção:
// mata úmida, terra escura e pouca cor — nada de tiles de desenho infantil.
import { TILE, VIEW_H, VIEW_W } from './engine'
import { Tile, type LevelTheme, type TerrainSet, type TileMap } from './level'

type Palette = {
  cap: string
  capLight: string
  capDark: string
  soil: string
  soilDark: string
  soilDeep: string
  soilLight: string
  root: string
  stone: string
  stoneLight: string
  water: string
  waterDeep: string
  waterLight: string
  waterFoam: string
  spike: string
  spikeLight: string
  spikeTip: string
}

const PALETTES: Record<TerrainSet, Palette> = {
  jungle: {
    cap: '#4b5b2c',
    capLight: '#6f823f',
    capDark: '#303c1b',
    soil: '#332516',
    soilDark: '#241a0f',
    soilDeep: '#191109',
    soilLight: '#46311d',
    root: '#6a4a28',
    stone: '#5f5c4a',
    stoneLight: '#807b63',
    water: '#1b3d3f',
    waterDeep: '#0b2427',
    waterLight: '#4d786e',
    waterFoam: '#c9d8c6',
    spike: '#5a4024',
    spikeLight: '#8a6536',
    spikeTip: '#d9d0b2',
  },
  moss: {
    cap: '#52643a',
    capLight: '#788c4f',
    capDark: '#354427',
    soil: '#2f3528',
    soilDark: '#23281d',
    soilDeep: '#181c14',
    soilLight: '#414a36',
    root: '#5f5738',
    stone: '#55584a',
    stoneLight: '#787c64',
    water: '#1b4448',
    waterDeep: '#0c2a2e',
    waterLight: '#5c8a80',
    waterFoam: '#cfe0cf',
    spike: '#4f4129',
    spikeLight: '#7d6740',
    spikeTip: '#cfcbb0',
  },
  mud: {
    cap: '#5d4d2c',
    capLight: '#837040',
    capDark: '#41351f',
    soil: '#38291a',
    soilDark: '#281d12',
    soilDeep: '#1c140b',
    soilLight: '#4c3922',
    root: '#6b5030',
    stone: '#5a5344',
    stoneLight: '#7c725b',
    water: '#26332f',
    waterDeep: '#121c1a',
    waterLight: '#587066',
    waterFoam: '#b8c4ae',
    spike: '#4a3620',
    spikeLight: '#75582f',
    spikeTip: '#c9bd9f',
  },
  temple: {
    cap: '#526739',
    capLight: '#7b904e',
    capDark: '#354522',
    soil: '#3f4237',
    soilDark: '#2b2e26',
    soilDeep: '#1f221c',
    soilLight: '#525748',
    root: '#5d5638',
    stone: '#4c4f42',
    stoneLight: '#6b6f5c',
    water: '#1b3238',
    waterDeep: '#0c2024',
    waterLight: '#557a74',
    waterFoam: '#c5d4c8',
    spike: '#4d4431',
    spikeLight: '#7a6c4b',
    spikeTip: '#d6cfb4',
  },
  bog: {
    cap: '#3b4b2b',
    capLight: '#617640',
    capDark: '#26331b',
    soil: '#222a1a',
    soilDark: '#171d10',
    soilDeep: '#0e130a',
    soilLight: '#303922',
    root: '#4e472c',
    stone: '#454b3b',
    stoneLight: '#616a53',
    water: '#1a2f2b',
    waterDeep: '#0a1a18',
    waterLight: '#456e63',
    waterFoam: '#a9c1b3',
    spike: '#47351f',
    spikeLight: '#6d522e',
    spikeTip: '#c3b899',
  },
}

const THEME_TERRAIN: Record<LevelTheme, TerrainSet> = {
  village: 'jungle',
  river: 'moss',
  camp: 'mud',
  grove: 'jungle',
  night: 'bog',
}

// Terraços de pedra do templo usam blocos em vez de terra.
const STONE_TERRAIN: ReadonlySet<TerrainSet> = new Set<TerrainSet>(['temple'])

function hash(value: number): number {
  const x = Math.sin(value * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  if (w <= 0 || h <= 0) return
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
}

function isSolid(map: TileMap, tx: number, ty: number): boolean {
  return map.tileAt(tx, ty) === Tile.Solid
}

// Elipse em faixas de 1 px, sem antialiasing.
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

// ---------- água ----------

function drawWater(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  cameraX: number,
  cameraY: number,
  time: number,
  palette: Palette,
): void {
  const x0 = Math.floor(cameraX / TILE) - 1
  const x1 = Math.ceil((cameraX + VIEW_W) / TILE) + 1
  const y0 = Math.floor(cameraY / TILE) - 1
  const y1 = Math.ceil((cameraY + VIEW_H) / TILE) + 1

  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (map.tileAt(tx, ty) !== Tile.Water) continue
      const dx = tx * TILE - cameraX
      const dy = ty * TILE - cameraY
      const wx = tx * TILE

      // Fundo: mais escuro conforme desce.
      px(ctx, dx, dy, TILE, TILE, palette.water)
      const depth = Math.min(0.5, Math.max(0, (ty * TILE - 132) / 90))
      if (depth > 0.01) {
        ctx.globalAlpha = depth
        px(ctx, dx, dy, TILE, TILE, palette.waterDeep)
        ctx.globalAlpha = 1
      }

      // Correntes horizontais, alinhadas entre os tiles.
      ctx.globalAlpha = 0.3
      for (let k = 0; k < 2; k += 1) {
        const lineY = dy + 7 + k * 6 + Math.round(hash(tx * 2.3 + ty * 7.9 + k) * 2)
        const speed = 5 + k * 3
        const lineX = dx - 4 + ((time * speed + hash(tx * 1.9 + ty * 3.1 + k) * 30) % 24)
        px(ctx, lineX, lineY, 5 + (k % 2) * 4, 1, palette.waterLight)
      }
      ctx.globalAlpha = 1

      const above = map.tileAt(tx, ty - 1)
      if (above !== Tile.Water) {
        // Superfície: uma linha de 1 px por coluna, com onda contínua.
        for (let x = 0; x < TILE; x += 1) {
          const worldX = wx + x
          const wave = Math.round(Math.sin(time * 2.4 + worldX * 0.32) * 1.15)
          px(ctx, dx + x, dy + wave, 1, 2, palette.waterLight)
          px(ctx, dx + x, dy + wave + 2, 1, 1, palette.water)
          const glint = Math.sin(time * 3.1 + worldX * 0.9)
          if (glint > 0.72) px(ctx, dx + x, dy + wave, 1, 1, palette.waterFoam)
        }
        // Reflexos verticais e espuma, para a água não virar um bloco chapado.
        ctx.globalAlpha = 0.2
        for (let k = 0; k < 2; k += 1) {
          const sx = dx + 3 + Math.floor(hash(tx * 6.1 + ty * 2.7 + k) * 11)
          const len = 4 + Math.floor(hash(tx * 3.3 + k) * 9)
          px(ctx, sx, dy + 2, 1, len, palette.waterLight)
        }
        ctx.globalAlpha = 1

        // Espuma e junco nas margens.
        const leftSolid = isSolid(map, tx - 1, ty)
        const rightSolid = isSolid(map, tx + 1, ty)
        if (leftSolid) {
          px(ctx, dx, dy, 2, TILE, palette.waterDeep)
          ctx.globalAlpha = 0.5
          px(ctx, dx + 1, dy + 1, 1, 4, palette.waterFoam)
          ctx.globalAlpha = 1
        }
        if (rightSolid) {
          px(ctx, dx + TILE - 2, dy, 2, TILE, palette.waterDeep)
          ctx.globalAlpha = 0.5
          px(ctx, dx + TILE - 2, dy + 1, 1, 4, palette.waterFoam)
          ctx.globalAlpha = 1
        }

        const reedSeed = hash(tx * 5.3 + ty * 2.7)
        if ((leftSolid || rightSolid) && reedSeed < 0.58) {
          const baseX = leftSolid ? dx + 1 : dx + TILE - 1
          const count = 2 + Math.floor(reedSeed * 4)
          for (let r = 0; r < count; r += 1) {
            const sway = Math.round(Math.sin(time * 0.9 + tx + r * 1.7) * 1)
            const height = 5 + Math.floor(hash(tx * 3.7 + r * 5.1) * 6)
            const rx = baseX + (leftSolid ? r : -r)
            for (let h = 0; h < height; h += 1) {
              const bend = h > height - 3 ? sway : 0
              px(ctx, rx + bend, dy - h, 1, 1, h === height - 1 ? palette.capLight : palette.capDark)
            }
          }
        }
      }
    }
  }
}

// ---------- detalhes do chão ----------

function drawGrassBlades(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  height: number,
  color: string,
  tip: string,
  lean: number,
): void {
  for (let i = 0; i < height; i += 1) {
    const dx = i === height - 1 ? lean : 0
    px(ctx, x + dx, baseY - i, 1, 1, i === height - 1 ? tip : color)
  }
}

function drawTuft(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  seed: number,
  palette: Palette,
): void {
  const blades = 3 + Math.floor(hash(seed * 2.7) * 3)
  for (let i = 0; i < blades; i += 1) {
    const bx = x + i - Math.floor(blades / 2)
    const h = 2 + Math.floor(hash(seed + i * 3.1) * 4)
    const lean = hash(seed + i * 7.7) > 0.5 ? 1 : -1
    drawGrassBlades(ctx, bx, baseY, h, palette.cap, palette.capLight, lean)
  }
}

function drawFern(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  seed: number,
  palette: Palette,
): void {
  const fronds = 4
  for (let f = 0; f < fronds; f += 1) {
    const dir = f - (fronds - 1) / 2
    const reach = 4 + Math.floor(hash(seed + f * 1.9) * 4)
    for (let t = 1; t <= reach; t += 1) {
      const fx = x + dir * t * 0.55
      const fy = baseY - t - Math.round(t * t * 0.05)
      px(ctx, fx, fy, 1, 1, t > reach - 2 ? palette.capLight : palette.capDark)
      if (t % 2 === 0) px(ctx, fx + (dir < 0 ? -1 : 1), fy, 1, 1, palette.cap)
    }
  }
}

function drawPebble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
  palette: Palette,
): void {
  const w = 2 + Math.floor(hash(seed) * 2)
  px(ctx, x, y, w, 2, palette.stone)
  px(ctx, x, y, w, 1, palette.stoneLight)
}

// Planta de folha larga: três ou quatro hastes com folhas curtas.
function drawLeafyPlant(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  seed: number,
  palette: Palette,
): void {
  const stems = 3 + Math.floor(hash(seed * 1.7) * 2)
  for (let i = 0; i < stems; i += 1) {
    const sx = x + i - Math.floor(stems / 2)
    const h = 3 + Math.floor(hash(seed + i * 2.9) * 4)
    for (let y = 0; y < h; y += 1) {
      px(ctx, sx, baseY - y, 1, 1, palette.capDark)
    }
    const dir = i % 2 === 0 ? -1 : 1
    px(ctx, sx + dir, baseY - h, 2, 1, palette.cap)
    px(ctx, sx + dir * 2, baseY - h + 1, 1, 1, palette.capLight)
  }
}

// Tufos de capim, samambaias e pedrinhas apoiados na superfície.
function drawSurfaceDetails(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
  time: number,
  palette: Palette,
): void {
  const seed = tx * 3.7 + ty * 8.3
  const roll = hash(seed)

  if (roll > 0.34) {
    const x = dx + 2 + Math.floor(hash(seed + 1.7) * 11)
    drawTuft(ctx, x, dy, seed + 4.1, palette)
  }
  if (roll > 0.68) {
    drawTuft(ctx, dx + 3 + Math.floor(hash(seed + 2.3) * 9), dy, seed + 8.7, palette)
  }
  if (roll > 0.82) {
    drawFern(ctx, dx + 3 + Math.floor(hash(seed + 3.3) * 9), dy, seed + 12.9, palette)
  }
  if (roll > 0.9) {
    drawLeafyPlant(ctx, dx + 5 + Math.floor(hash(seed + 6.1) * 7), dy, seed + 16.3, palette)
  }
  if (hash(seed + 12.1) > 0.7) {
    drawPebble(ctx, dx + 2 + Math.floor(hash(seed + 5.9) * 11), dy - 1, seed + 2.3, palette)
  }

  // Raízes finas descendo da beira do barranco.
  if (!isSolid(map, tx - 1, ty) && hash(seed + 7.1) > 0.5) {
    const len = 5 + Math.floor(hash(seed + 2.9) * 8)
    for (let i = 0; i < len; i += 1) {
      const wobble = Math.round(Math.sin(time * 0.5 + i * 0.5) * 0.6)
      px(ctx, dx + wobble, dy + i + 2, 1, 1, i > len - 3 ? palette.capLight : palette.capDark)
    }
  }
  if (!isSolid(map, tx + 1, ty) && hash(seed + 9.4) > 0.58) {
    const len = 4 + Math.floor(hash(seed + 4.7) * 7)
    for (let i = 0; i < len; i += 1) {
      const wobble = Math.round(Math.sin(time * 0.55 + i * 0.45 + 2) * 0.6)
      px(ctx, dx + TILE - 1 + wobble, dy + i + 2, 1, 1, i > len - 3 ? palette.capLight : palette.capDark)
    }
  }
}

// Vines e musgo pendurados nas plataformas suspensas.
function drawHanging(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
  time: number,
  palette: Palette,
): void {
  const seed = tx * 4.9 + ty * 2.3
  if (hash(seed) < 0.42) {
    const vx = dx + 2 + Math.floor(hash(seed + 1.3) * 12)
    const len = 3 + Math.floor(hash(seed + 3.9) * 8)
    const sway = Math.round(Math.sin(time * 0.8 + tx * 1.7) * 1)
    for (let i = 0; i < len; i += 1) {
      const bend = i > len * 0.55 ? sway : 0
      px(ctx, vx + bend, dy + TILE - 1 + i, 1, 1, i === len - 1 ? palette.capLight : palette.root)
    }
    if (len > 6) px(ctx, vx + sway + 1, dy + TILE + len, 1, 1, palette.cap)
  }

  // Musgo curto na testa do barranco.
  if (hash(seed + 6.7) > 0.36) {
    const mx = dx + 1 + Math.floor(hash(seed + 8.1) * 10)
    const mw = 2 + Math.floor(hash(seed + 2.2) * 4)
    px(ctx, mx, dy + TILE - 1, mw, 2, palette.capDark)
    px(ctx, mx, dy + TILE + 1, Math.max(1, mw - 1), 1, palette.cap)
  }
}

// ---------- terra ----------

function drawSoil(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
  time: number,
  palette: Palette,
): void {
  const top = !isSolid(map, tx, ty - 1)
  const bottom = !isSolid(map, tx, ty + 1)
  const left = !isSolid(map, tx - 1, ty)
  const right = !isSolid(map, tx + 1, ty)
  const seed = tx * 7.3 + ty * 13.1

  // Base com manchas largas de terra clara e escura.
  px(ctx, dx, dy, TILE, TILE, palette.soil)
  ctx.save()
  ctx.beginPath()
  ctx.rect(dx, dy, TILE, TILE)
  ctx.clip()
  for (let i = 0; i < 3; i += 1) {
    const bx = dx + hash(seed + i * 4.7) * TILE
    const by = dy + 3 + hash(seed + i * 7.1) * (TILE - 4)
    const rx = 2 + hash(seed + i * 2.3) * 4
    const ry = 1 + hash(seed + i * 5.9) * 3
    ctx.globalAlpha = 0.22
    blob(ctx, bx, by, rx, ry, i % 2 === 0 ? palette.soilLight : palette.soilDark)
  }
  ctx.globalAlpha = 1

  // Estratos e veios de argila contínuos no mundo inteiro.
  for (let y = 0; y < TILE; y += 1) {
    const wy = ty * TILE + y
    ctx.globalAlpha = wy % 9 === 3 ? 0.55 : 0.28
    if (wy % 9 === 3) px(ctx, dx, dy + y, TILE, 1, palette.soilDark)
    else if (wy % 14 === 8) px(ctx, dx, dy + y, TILE, 1, palette.soilLight)
  }
  ctx.globalAlpha = 1

  // Rachaduras.
  if (hash(seed + 16.7) > 0.52) {
    const cx = dx + 3 + Math.floor(hash(seed + 2.1) * 10)
    let cy = dy + 4 + Math.floor(hash(seed + 8.9) * 6)
    const len = 3 + Math.floor(hash(seed + 4.3) * 5)
    for (let i = 0; i < len; i += 1) {
      px(ctx, cx + Math.round(Math.sin(i * 1.6) * 1.4), cy + i, 1, 1, palette.soilDeep)
    }
  }

  // Pedra enterrada: massa de 4 a 7 px com topo iluminado.
  if (hash(seed + 21.3) > 0.42) {
    const rx = dx + 1 + Math.floor(hash(seed + 3.3) * 9)
    const ry = dy + 5 + Math.floor(hash(seed + 6.1) * 7)
    const rw = 3 + Math.floor(hash(seed + 1.9) * 4)
    const rh = 2 + Math.floor(hash(seed + 9.7) * 3)
    px(ctx, rx + 1, ry + 1, rw, rh, palette.soilDeep)
    px(ctx, rx, ry, rw, rh, palette.stone)
    px(ctx, rx, ry, rw, 1, palette.stoneLight)
    px(ctx, rx, ry + rh - 1, rw, 1, palette.stoneLight)
  }

  // Raízes grossas atravessando a terra.
  if (hash(seed + 31.7) > 0.48) {
    const ry = dy + 7 + Math.floor(hash(seed + 11.3) * 6)
    const baseX = tx * TILE
    for (let x = 0; x < TILE; x += 1) {
      const yy = ry + Math.round(Math.sin((baseX + x) * 0.24 + seed) * 1.4)
      px(ctx, dx + x, yy, 1, 2, palette.root)
      if ((x + tx) % 5 === 0) {
        px(ctx, dx + x, yy + 2, 1, 1 + Math.floor(hash(seed + x) * 3), palette.root)
      }
    }
  }
  ctx.restore()

  // Bordas expostas: sombra e lascas.
  if (left) {
    px(ctx, dx, dy, 1, TILE, palette.soilDeep)
    ctx.globalAlpha = 0.4
    px(ctx, dx + 1, dy, 1, TILE, palette.soilLight)
    ctx.globalAlpha = 1
    for (let y = 2; y < TILE; y += 5) {
      px(ctx, dx, dy + y, 2, 1, palette.soilDeep)
    }
  }
  if (right) {
    px(ctx, dx + TILE - 1, dy, 1, TILE, palette.soilDeep)
    ctx.globalAlpha = 0.3
    px(ctx, dx + TILE - 2, dy, 1, TILE, palette.soilLight)
    ctx.globalAlpha = 1
  }
  if (bottom) {
    px(ctx, dx, dy + TILE - 2, TILE, 2, palette.soilDeep)
    drawHanging(ctx, tx, ty, dx, dy, time, palette)
  }

  if (!top) return

  // Superfície irregular de capim, com silhueta quebrada acima da linha.
  const capBottom = 5 + Math.floor(hash(seed + 1.1) * 2)
  px(ctx, dx, dy, TILE, capBottom, palette.cap)
  for (let x = 0; x < TILE; x += 1) {
    const edge = hash(seed + x * 2.9)
    if (edge > 0.72) px(ctx, dx + x, dy + capBottom - 1, 1, 1, palette.soilDark)
    if (edge > 0.42) px(ctx, dx + x, dy + capBottom, 1, 1, palette.capDark)
    if (edge > 0.58) px(ctx, dx + x, dy, 1, 1, palette.capLight)
    if (edge < 0.16) px(ctx, dx + x, dy + 1, 1, 1, palette.capDark)
    if (edge > 0.76) px(ctx, dx + x, dy - 1, 1, 1, edge > 0.92 ? palette.cap : palette.capDark)
    if (edge > 0.93) px(ctx, dx + x, dy - 2, 1, 1, palette.cap)
  }

  // Faixa de terra revolvida logo abaixo do capim.
  ctx.globalAlpha = 0.55
  px(ctx, dx, dy + capBottom + 1, TILE, 2, palette.soilLight)
  ctx.globalAlpha = 1

  // Lâminas acima da linha do chão.
  for (let x = 0; x < TILE; x += 1) {
    const blade = hash(seed + x * 5.3)
    if (blade > 0.8) {
      const h = 1 + Math.floor(hash(seed + x * 1.7) * 3)
      const lean = blade > 0.93 ? 1 : 0
      drawGrassBlades(ctx, dx + x, dy, h, palette.capDark, palette.capLight, lean)
    }
  }

  // Raízes descem do capim para dentro da terra.
  const roots = 1 + Math.floor(hash(seed + 8.1) * 3)
  for (let r = 0; r < roots; r += 1) {
    const rx = dx + 2 + Math.floor(hash(seed + r * 6.7) * 11)
    const len = 3 + Math.floor(hash(seed + r * 3.3) * 6)
    for (let i = 0; i < len; i += 1) {
      px(
        ctx,
        rx + Math.round(Math.sin(i * 1.1) * 1.2),
        dy + capBottom + i,
        1,
        1,
        i > len - 2 ? palette.root : palette.soilDark,
      )
    }
  }

  drawSurfaceDetails(ctx, map, tx, ty, dx, dy, time, palette)
}

// ---------- pedra do templo ----------

function drawStone(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
  time: number,
  palette: Palette,
): void {
  const top = !isSolid(map, tx, ty - 1)
  const bottom = !isSolid(map, tx, ty + 1)
  const left = !isSolid(map, tx - 1, ty)
  const right = !isSolid(map, tx + 1, ty)
  const seed = tx * 9.1 + ty * 4.7

  px(ctx, dx, dy, TILE, TILE, palette.soil)

  // Manchas e desgaste dentro do bloco.
  ctx.save()
  ctx.beginPath()
  ctx.rect(dx, dy, TILE, TILE)
  ctx.clip()
  for (let i = 0; i < 2; i += 1) {
    const bx = dx + hash(seed + i * 3.7) * TILE
    const by = dy + hash(seed + i * 8.3) * TILE
    ctx.globalAlpha = 0.2
    blob(ctx, bx, by, 2 + hash(seed + i * 2.1) * 4, 1 + hash(seed + i * 5.3) * 2, palette.soilLight)
  }
  ctx.globalAlpha = 1

  // Fiadas de 8 px com bevel: topo iluminado, base em sombra.
  for (let course = 0; course < 2; course += 1) {
    const y = course * 8
    px(ctx, dx, dy + y, TILE, 1, palette.soilDark)
    px(ctx, dx, dy + y + 1, TILE, 1, palette.soilLight)
    px(ctx, dx, dy + y + 7, TILE, 1, palette.soilDeep)
    const worldCourse = Math.floor((ty * TILE) / 8) + course
    const jointWorld = ((worldCourse % 2) * 8 + 4) % 16
    for (let x = 0; x < TILE; x += 1) {
      const wx = ((tx * TILE + x) % 16 + 16) % 16
      if (wx === jointWorld) {
        px(ctx, dx + x, dy + y + 1, 1, 7, palette.soilDeep)
        px(ctx, dx + x + 1, dy + y + 1, 1, 7, palette.soilLight)
      }
    }
    // Musgo crescendo nas juntas.
    if (hash(seed + course * 6.1) > 0.4) {
      const mx = dx + Math.floor(hash(seed + course * 3.3) * 12)
      const mw = 2 + Math.floor(hash(seed + course * 4.9) * 4)
      px(ctx, mx, dy + y + 7, mw, 1, palette.capDark)
      px(ctx, mx + 1, dy + y + 6, Math.max(1, mw - 2), 1, palette.cap)
    }
  }

  // Rachaduras e lascas.
  if (hash(seed + 1.7) > 0.42) {
    const cx = dx + 3 + Math.floor(hash(seed + 4.1) * 9)
    const cy = dy + 2 + Math.floor(hash(seed + 2.3) * 9)
    const len = 2 + Math.floor(hash(seed + 6.9) * 4)
    for (let i = 0; i < len; i += 1) {
      px(ctx, cx + Math.round(Math.sin(i * 1.7) * 1.4), cy + i, 1, 1, palette.soilDeep)
    }
  }
  if (hash(seed + 8.3) > 0.62) {
    drawPebble(ctx, dx + 2 + Math.floor(hash(seed + 3.1) * 10), dy + 3, seed + 5.7, palette)
  }
  ctx.restore()

  if (left) {
    px(ctx, dx, dy, 1, TILE, palette.soilDeep)
    ctx.globalAlpha = 0.4
    px(ctx, dx + 1, dy, 1, TILE, palette.stoneLight)
    ctx.globalAlpha = 1
  }
  if (right) px(ctx, dx + TILE - 1, dy, 1, TILE, palette.soilDeep)
  if (bottom) {
    px(ctx, dx, dy + TILE - 2, TILE, 2, palette.soilDeep)
    drawHanging(ctx, tx, ty, dx, dy, time, palette)
  }

  if (!top) return

  // Musgo grosso sobre os blocos, com barra de terra na testa.
  const capBottom = 4 + Math.floor(hash(seed + 2.9) * 2)
  px(ctx, dx, dy, TILE, capBottom, palette.cap)
  for (let x = 0; x < TILE; x += 1) {
    const edge = hash(seed + x * 3.3)
    if (edge > 0.56) px(ctx, dx + x, dy + capBottom, 1, 1, palette.capDark)
    if (edge > 0.76) px(ctx, dx + x, dy, 1, 1, palette.capLight)
    if (edge < 0.14) px(ctx, dx + x, dy + capBottom - 1, 1, 1, palette.soilDark)
    if (edge > 0.86) px(ctx, dx + x, dy - 1, 1, 1, palette.capDark)
  }
  // Vines descendo pela parede.
  if (hash(seed + 15.1) > 0.55) {
    const vx = dx + 2 + Math.floor(hash(seed + 6.3) * 11)
    const len = 4 + Math.floor(hash(seed + 7.9) * 8)
    const sway = Math.round(Math.sin(time * 0.7 + tx) * 1)
    for (let i = 0; i < len; i += 1) {
      px(ctx, vx + (i > len - 4 ? sway : 0), dy + i, 1, 1, i > len - 2 ? palette.cap : palette.capDark)
    }
  }
  for (let x = 0; x < TILE; x += 1) {
    if (hash(seed + x * 6.1) > 0.84) {
      drawGrassBlades(ctx, dx + x, dy, 1 + Math.floor(hash(seed + x) * 3), palette.capDark, palette.capLight, 0)
    }
  }
  if (hash(seed + 11.3) > 0.4) drawTuft(ctx, dx + 3 + Math.floor(hash(seed + 7.7) * 9), dy, seed + 4.9, palette)
  if (hash(seed + 13.7) > 0.62) drawFern(ctx, dx + 4 + Math.floor(hash(seed + 2.1) * 8), dy, seed + 9.1, palette)
  if (hash(seed + 17.3) > 0.78) drawLeafyPlant(ctx, dx + 4 + Math.floor(hash(seed + 5.7) * 8), dy, seed + 12.7, palette)

  drawSurfaceDetails(ctx, map, tx, ty, dx, dy, time, palette)
}

// Plataformas de madeira ou pedra, conforme o terreno do capítulo. São
// decorativas no mapa (a colisão é one-way), então a cara tem que dizer ao
// jogador onde ele pode pisar.
function drawPlatform(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
  palette: Palette,
  stone: boolean,
): void {
  const seed = tx * 5.1 + ty * 3.7
  if (stone) {
    px(ctx, dx, dy, TILE, 1, palette.stoneLight)
    px(ctx, dx, dy + 1, TILE, 4, palette.stone)
    px(ctx, dx, dy + 5, TILE, 1, palette.soilDeep)
    px(ctx, dx + 5, dy + 1, 1, 4, palette.soilDark)
    px(ctx, dx + 12, dy + 1, 1, 4, palette.soilDark)
    if (hash(seed) > 0.5) {
      px(ctx, dx + 2, dy, 4, 1, palette.cap)
      px(ctx, dx + 10, dy, 3, 1, palette.capDark)
    }
  } else {
    px(ctx, dx, dy, TILE, 1, palette.root)
    px(ctx, dx, dy + 1, TILE, 3, palette.soil)
    px(ctx, dx, dy + 4, TILE, 1, palette.soilDeep)
    // Amarrações de cipó.
    px(ctx, dx + 3, dy, 1, 5, palette.capDark)
    px(ctx, dx + 12, dy, 1, 5, palette.capDark)
    px(ctx, dx + 3, dy + 1, 1, 1, palette.capLight)
    px(ctx, dx + 12, dy + 1, 1, 1, palette.capLight)
    // Musgo e folhas sobre a prancha.
    if (hash(seed) > 0.35) {
      const mx = dx + 4 + Math.floor(hash(seed + 2.1) * 7)
      px(ctx, mx, dy - 1, 2 + Math.floor(hash(seed + 4.7) * 2), 1, palette.cap)
      px(ctx, mx, dy, 1, 1, palette.capLight)
    }
    if (hash(seed + 7.3) > 0.72) drawTuft(ctx, dx + 6, dy, seed + 1.9, palette)
  }
}

// ---------- estacas ----------

function drawSpikes(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  cameraX: number,
  cameraY: number,
  palette: Palette,
): void {
  const x0 = Math.floor(cameraX / TILE) - 1
  const x1 = Math.ceil((cameraX + VIEW_W) / TILE) + 1
  const y0 = Math.floor(cameraY / TILE) - 1
  const y1 = Math.ceil((cameraY + VIEW_H) / TILE) + 1

  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (map.tileAt(tx, ty) !== Tile.Spike) continue
      const dx = tx * TILE - cameraX
      const dy = ty * TILE - cameraY
      const seed = tx * 4.3 + ty * 6.1

      // Sombra rente ao chão.
      ctx.globalAlpha = 0.4
      px(ctx, dx + 1, dy + TILE - 2, TILE - 2, 2, palette.soilDeep)
      ctx.globalAlpha = 1

      for (let i = 0; i < 4; i += 1) {
        const sx = dx + 1 + i * 4
        const h = 9 + Math.floor(hash(seed + i * 3.7) * 4)
        const top = dy + TILE - h
        // Haste.
        px(ctx, sx, top + 3, 2, h - 3, i % 2 === 0 ? palette.spike : palette.spikeLight)
        px(ctx, sx, top + 3, 1, h - 3, palette.spikeLight)
        // Ponta lascada.
        px(ctx, sx, top, 1, 1, palette.spikeTip)
        px(ctx, sx, top + 1, 2, 1, palette.spikeLight)
        px(ctx, sx, top + 2, 2, 1, palette.spike)
        // Amarração.
        if (i % 2 === 0) px(ctx, sx, dy + TILE - 4, 2, 1, palette.soilDeep)
      }
    }
  }
}

// ---------- entrada ----------

export function drawScenery(
  ctx: CanvasRenderingContext2D,
  map: TileMap,
  cameraX: number,
  cameraY: number,
  _goalX: number,
  _goalBaseY: number,
  time: number,
  theme: LevelTheme,
  _goalLocked: boolean,
  terrain?: TerrainSet,
): void {
  const set = terrain ?? THEME_TERRAIN[theme] ?? 'jungle'
  const palette = PALETTES[set] ?? PALETTES.jungle
  const stone = STONE_TERRAIN.has(set)

  drawWater(ctx, map, cameraX, cameraY, time, palette)

  const x0 = Math.floor(cameraX / TILE) - 1
  const x1 = Math.ceil((cameraX + VIEW_W) / TILE) + 1
  const y0 = Math.floor(cameraY / TILE) - 1
  const y1 = Math.ceil((cameraY + VIEW_H) / TILE) + 1

  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (map.tileAt(tx, ty) !== Tile.Platform) continue
      drawPlatform(ctx, tx, ty, tx * TILE - cameraX, ty * TILE - cameraY, palette, stone)
    }
  }

  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (map.tileAt(tx, ty) !== Tile.Solid) continue
      const dx = tx * TILE - cameraX
      const dy = ty * TILE - cameraY
      if (stone) drawStone(ctx, map, tx, ty, dx, dy, time, palette)
      else drawSoil(ctx, map, tx, ty, dx, dy, time, palette)
    }
  }

  // Filete contínuo na borda do chão: costura os tiles e tira o aspecto de
  // "tijolos soltos" que o capim parecia ter quando visto de longe.
  ctx.globalAlpha = 0.3
  for (let tx = x0; tx <= x1; tx += 1) {
    for (let ty = y0; ty <= y1; ty += 1) {
      if (map.tileAt(tx, ty) !== Tile.Solid || isSolid(map, tx, ty - 1)) continue
      px(ctx, tx * TILE - cameraX, ty * TILE - cameraY, TILE, 1, palette.capLight)
    }
  }
  ctx.globalAlpha = 1

  drawSpikes(ctx, map, cameraX, cameraY, palette)

  // O subsolo escurece para a base da tela: dá peso ao chão e fecha a cena.
  const depth = ctx.createLinearGradient(0, VIEW_H - 46, 0, VIEW_H)
  depth.addColorStop(0, 'rgba(0, 0, 0, 0)')
  depth.addColorStop(1, 'rgba(0, 0, 0, 0.34)')
  ctx.fillStyle = depth
  ctx.fillRect(0, VIEW_H - 46, VIEW_W, 46)
}
