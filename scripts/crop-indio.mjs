import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const SRC = 'raw/sandman-poses.png'
const OUT = 'public/assets/sprites/indio'
const TARGET_W = 32   // largura alvo igual aos colonos
const TARGET_H = 42   // altura alvo igual aos colonos

// Grid estimado de sandman-poses.png (700x700)
// Cada linha tem um estado de animacao; colunas variam por linha.
// Formato: [linha, colunas, xInicial, yInicial, wCelula, hCelula]
const GRID = [
  { row: 'idle',   cols: 5, x: 0,  y: 0,   cw: 140, ch: 140 }, // Idling
  { row: 'jump',   cols: 4, x: 0,  y: 140, cw: 140, ch: 140 }, // Jumping
  { row: 'slash',  cols: 5, x: 0,  y: 280, cw: 140, ch: 140 }, // Action (arco/flecha + corpo a corpo)
  { row: 'run',    cols: 5, x: 0,  y: 420, cw: 140, ch: 140 }, // Corrida
  { row: 'death',  cols: 5, x: 0,  y: 560, cw: 140, ch: 140 }, // Morte / dano
]

fs.mkdirSync(OUT, { recursive: true })

const frames: any[] = []
let idx = 0

for (const g of GRID) {
  for (let c = 0; c < g.cols; c += 1) {
    const name = `${g.row}-${c + 1}`
    const file = `${name}.png`
    const left = g.x + c * g.cw
    const top = g.y
    await sharp(SRC)
      .extract({ left, top, width: g.cw, height: g.ch })
      .resize(TARGET_W, TARGET_H, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(OUT, file))

    frames.push({
      file,
      name,
      w: TARGET_W,
      h: TARGET_H,
      anchor: { x: Math.floor(TARGET_W / 2), y: TARGET_H },
      source: { x: left, y: top, w: g.cw, h: g.ch },
    })
    idx += 1
  }
}

const atlas = {
  source: 'indio-source.png',
  scale: 5,
  clips: {
    idle:   { frames: frames.filter(f => f.name.startsWith('idle-')).map(f => f.name.replace('.png','')), fps: 2.4, loop: true },
    walk:   { frames: frames.filter(f => f.name.startsWith('run-')).map(f => f.name.replace('.png','')), fps: 9, loop: true },
    shoot:  { frames: frames.filter(f => f.name.startsWith('slash-')).slice(0, 3).map(f => f.name.replace('.png','')), fps: 9, loop: false },
    slash:  { frames: frames.filter(f => f.name.startsWith('slash-')).map(f => f.name.replace('.png','')), fps: 12, loop: false },
    hurt:   { frames: frames.filter(f => f.name.startsWith('death-')).slice(0, 1).map(f => f.name.replace('.png','')), fps: 1, loop: false },
    death:  { frames: frames.filter(f => f.name.startsWith('death-')).map(f => f.name.replace('.png','')), fps: 6, loop: false },
  },
  frames,
}

fs.writeFileSync(path.join(OUT, 'atlas.json'), JSON.stringify(atlas, null, 2))
console.log(`Recortados ${idx} quadros do indio em ${OUT}`)
