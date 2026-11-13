// Gera os JSONs dos capítulos. Fonte de verdade do level design.
// Uso: node scripts/build-levels.mjs
import fs from 'node:fs'
import path from 'node:path'

const ROWS = 12
const GROUND = 9

function makeLevel(config) {
  const {
    width: baseWidth,
    theme,
    name,
    subtitle,
    spawn,
    water = [],
    holes = [],
    blocks = [],
    platforms = [],
    spikes = [],
    bg = [],
    entities = [],
    tail,
  } = config
  const width = tail ? tail.width : baseWidth

  // Trecho extra: plataformas, espinhos, colonos, memórias e marcos.
  if (tail) {
    const {
      from,
      kinds = ['capanga'],
      enemyEvery = 12,
      memoryEvery = 13,
      platformEvery = 8,
      spikeEvery = 21,
      checkpointEvery = 28,
      safe = [],
    } = tail
    const isSafe = (x) => safe.some((value) => Math.abs(value - x) <= 4)
    let enemyTimer = 7
    let memoryTimer = 5
    let checkpointTimer = 14
    let step = 0

    for (let x = from; x < width - 7; x += 1) {
      step += 1

      if (step % platformEvery === 0 && !isSafe(x)) {
        platforms.push({ x, y: 6 + (step % 3), w: 3 })
      }

      if (step % spikeEvery === 0 && !isSafe(x)) {
        spikes.push({ x, y: 8, w: 2 })
      }

      enemyTimer -= 1
      if (enemyTimer <= 0) {
        enemyTimer = enemyEvery
        if (!isSafe(x)) {
          const kind = kinds[Math.floor(step / enemyEvery) % kinds.length]
          entities.push({ type: 'enemy', kind, x, y: 8, left: x - 3, right: x + 6 })
        }
      }

      memoryTimer -= 1
      if (memoryTimer <= 0) {
        memoryTimer = memoryEvery
        entities.push({ type: 'memory', x, y: 5 })
      }

      checkpointTimer -= 1
      if (checkpointTimer <= 0) {
        checkpointTimer = checkpointEvery
        if (!isSafe(x)) entities.push({ type: 'checkpoint', x, y: 8 })
      }
    }
  }

  const grid = Array.from({ length: ROWS }, (_, y) => Array(width).fill(y >= GROUND ? '#' : '.'))

  const fill = (x, y, w, h, char) => {
    for (let ty = y; ty < y + h; ty += 1) {
      for (let tx = x; tx < x + w; tx += 1) {
        if (tx < 0 || tx >= width || ty < 0 || ty >= ROWS) continue
        grid[ty][tx] = char
      }
    }
  }

  for (const [x0, x1] of water) fill(x0, GROUND, x1 - x0 + 1, ROWS - GROUND, '~')
  for (const [x0, x1] of holes) fill(x0, GROUND, x1 - x0 + 1, ROWS - GROUND, '.')
  for (const block of blocks) fill(block.x, block.y, block.w, block.h, '#')
  for (const platform of platforms) fill(platform.x, platform.y, platform.w, 1, '-')
  for (const spike of spikes) fill(spike.x, spike.y, spike.w, 1, '^')
  for (const [x, y, w, h] of bg) fill(x, y, w, h, '+')

  const rows = grid.map((row) => row.join(''))
  const goalX = width - 4
  const problems = []

  rows.forEach((row, index) => {
    if (row.length !== width) problems.push(`linha ${index} tem ${row.length} colunas (esperado ${width})`)
  })

  const at = (x, y) => (grid[y] && grid[y][x]) || '.'

  if (at(spawn.x, spawn.y + 1) !== '#') problems.push(`spawn ${spawn.x},${spawn.y} sem chão logo abaixo`)

  for (const entity of entities) {
    if (entity.x < 0 || entity.x >= width || entity.y < 0 || entity.y >= ROWS) {
      problems.push(`entidade fora do mapa: ${JSON.stringify(entity)}`)
      continue
    }
    if (entity.type === 'enemy' || entity.type === 'checkpoint') {
      const below = at(entity.x, entity.y + 1)
      if (below !== '#' && below !== '-') {
        problems.push(`${entity.type} ${entity.kind ?? ''} ${entity.x},${entity.y} está sem chão (abaixo: ${below})`)
      }
    }
    if (entity.type === 'memory') {
      if (at(entity.x, entity.y) !== '.') {
        problems.push(`memória ${entity.x},${entity.y} dentro de tile ${at(entity.x, entity.y)}`)
      }
    }
  }

  for (let x = goalX; x < width; x += 1) {
    for (let y = GROUND; y < ROWS; y += 1) {
      if (at(x, y) !== '#') problems.push(`chão do objetivo quebrado em ${x},${y}`)
    }
  }

  let goalY = GROUND
  for (let y = 0; y < ROWS; y += 1) {
    if (at(goalX, y) === '#') {
      goalY = y
      break
    }
  }

  if (problems.length) {
    console.error(`\n${name}:`)
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exitCode = 1
  }

  return {
    name,
    subtitle,
    theme,
    goal: goalX,
    goalY,
    spawn,
    rows,
    entities,
  }
}

// Estende o capítulo com um trecho novo: plataformas, espinhos, colonos,
// memórias e marcos. Deixa o mapa maior sem perder a curva de dificuldade.
const chapters = [
  makeLevel({
    width: 72,
    theme: 'village',
    name: 'Capítulo 1 — A Aldeia',
    subtitle: 'A floresta guarda o que a aldeia perdeu.',
    spawn: { x: 2, y: 8 },
    water: [
      [27, 29],
      [52, 54],
    ],
    blocks: [
      { x: 27, y: 8, w: 1, h: 1 },
      { x: 29, y: 8, w: 1, h: 1 },
      { x: 36, y: 7, w: 6, h: 2 },
      { x: 53, y: 8, w: 1, h: 1 },
    ],
    platforms: [
      { x: 9, y: 7, w: 3 },
      { x: 17, y: 6, w: 3 },
      { x: 24, y: 7, w: 2 },
      { x: 33, y: 7, w: 3 },
      { x: 44, y: 6, w: 4 },
      { x: 58, y: 7, w: 3 },
    ],
    spikes: [{ x: 47, y: 8, w: 2 }],
    bg: [
      [10, 0, 40, 4],
      [60, 0, 30, 4],
    ],
    entities: [
      { type: 'memory', x: 10, y: 6 },
      { type: 'memory', x: 18, y: 5 },
      { type: 'memory', x: 34, y: 6 },
      { type: 'memory', x: 45, y: 5 },
      { type: 'memory', x: 59, y: 6 },
      { type: 'checkpoint', x: 8, y: 8 },
      { type: 'checkpoint', x: 40, y: 6 },
      { type: 'checkpoint', x: 57, y: 8 },
      { type: 'enemy', kind: 'capanga', x: 20, y: 8, left: 17, right: 24 },
      { type: 'enemy', kind: 'capanga', x: 31, y: 8, left: 30, right: 35 },
      { type: 'enemy', kind: 'capanga', x: 50, y: 8, left: 46, right: 51 },
      { type: 'enemy', kind: 'capanga', x: 64, y: 8, left: 60, right: 67 },
    ],
    tail: {
      width: 132,
      from: 72,
      kinds: ['capanga', 'soldado', 'capanga'],
      enemyEvery: 9,
      memoryEvery: 9,
      platformEvery: 6,
      spikeEvery: 16,
      checkpointEvery: 20,
      safe: [80, 320],
    },
  }),

  makeLevel({
    width: 88,
    theme: 'river',
    name: 'Capítulo 2 — O Rio Escuro',
    subtitle: 'A correnteza leva tudo — menos a teimosia de voltar.',
    spawn: { x: 2, y: 8 },
    water: [
      [16, 22],
      [35, 43],
      [56, 62],
      [72, 77],
      [46, 48],
    ],
    blocks: [
      { x: 18, y: 8, w: 2, h: 1 },
      { x: 21, y: 8, w: 1, h: 1 },
      { x: 26, y: 8, w: 5, h: 1 },
      { x: 37, y: 8, w: 2, h: 1 },
      { x: 41, y: 8, w: 2, h: 1 },
      { x: 49, y: 7, w: 5, h: 2 },
      { x: 58, y: 8, w: 2, h: 1 },
      { x: 61, y: 8, w: 1, h: 1 },
      { x: 73, y: 8, w: 1, h: 1 },
      { x: 76, y: 8, w: 2, h: 1 },
      { x: 79, y: 8, w: 5, h: 1 },
    ],
    platforms: [
      { x: 7, y: 6, w: 3 },
      { x: 24, y: 5, w: 3 },
      { x: 32, y: 6, w: 3 },
      { x: 46, y: 5, w: 3 },
      { x: 54, y: 7, w: 2 },
      { x: 66, y: 6, w: 4 },
      { x: 82, y: 5, w: 3 },
    ],
    spikes: [
      { x: 30, y: 8, w: 2 },
      { x: 68, y: 8, w: 2 },
    ],
    bg: [
      [20, 0, 60, 4],
      [90, 0, 60, 4],
      [150, 0, 50, 4],
    ],
    entities: [
      { type: 'memory', x: 8, y: 5 },
      { type: 'memory', x: 25, y: 4 },
      { type: 'memory', x: 33, y: 5 },
      { type: 'memory', x: 47, y: 4 },
      { type: 'memory', x: 67, y: 5 },
      { type: 'memory', x: 83, y: 4 },
      { type: 'checkpoint', x: 6, y: 8 },
      { type: 'checkpoint', x: 45, y: 8 },
      { type: 'checkpoint', x: 70, y: 8 },
      { type: 'enemy', kind: 'capanga', x: 12, y: 8, left: 9, right: 15 },
      { type: 'enemy', kind: 'soldado', x: 28, y: 7, left: 26, right: 30 },
      { type: 'enemy', kind: 'capanga', x: 34, y: 8, left: 31, right: 34 },
      { type: 'enemy', kind: 'soldado', x: 50, y: 6, left: 49, right: 53 },
      { type: 'enemy', kind: 'soldado', x: 66, y: 8, left: 63, right: 67 },
      { type: 'enemy', kind: 'capanga', x: 80, y: 7, left: 79, right: 83 },
      { type: 'enemy', kind: 'soldado', x: 86, y: 8, left: 85, right: 87 },
    ],
    tail: {
      width: 156,
      from: 88,
      kinds: ['capanga', 'soldado', 'feitor'],
      enemyEvery: 9,
      memoryEvery: 9,
      platformEvery: 6,
      spikeEvery: 16,
      checkpointEvery: 20,
      safe: [90, 360],
    },
  }),

  makeLevel({
    width: 96,
    theme: 'camp',
    name: 'Capítulo 3 — O Acampamento',
    subtitle: 'Onde o ferro corta a mata, a fumaça esconde os cativos.',
    spawn: { x: 2, y: 8 },
    water: [
      [24, 26],
      [58, 60],
      [76, 78],
      [64, 66],
    ],
    blocks: [
      { x: 18, y: 8, w: 1, h: 1 },
      { x: 25, y: 8, w: 1, h: 1 },
      { x: 34, y: 7, w: 2, h: 2 },
      { x: 42, y: 8, w: 6, h: 1 },
      { x: 59, y: 8, w: 1, h: 1 },
      { x: 66, y: 8, w: 2, h: 1 },
      { x: 77, y: 8, w: 1, h: 1 },
      { x: 84, y: 7, w: 6, h: 2 },
    ],
    platforms: [
      { x: 6, y: 6, w: 3 },
      { x: 13, y: 5, w: 4 },
      { x: 20, y: 7, w: 3 },
      { x: 29, y: 5, w: 4 },
      { x: 38, y: 6, w: 3 },
      { x: 48, y: 4, w: 4 },
      { x: 54, y: 6, w: 4 },
      { x: 62, y: 5, w: 3 },
      { x: 70, y: 6, w: 4 },
      { x: 80, y: 5, w: 3 },
      { x: 88, y: 6, w: 3 },
    ],
    spikes: [
      { x: 16, y: 8, w: 2 },
      { x: 36, y: 8, w: 2 },
      { x: 52, y: 8, w: 2 },
      { x: 72, y: 8, w: 2 },
    ],
    bg: [
      [10, 0, 30, 4],
      [60, 0, 25, 4],
      [140, 0, 24, 4],
    ],
    entities: [
      { type: 'memory', x: 7, y: 5 },
      { type: 'memory', x: 14, y: 4 },
      { type: 'memory', x: 30, y: 4 },
      { type: 'memory', x: 49, y: 3 },
      { type: 'memory', x: 63, y: 4 },
      { type: 'memory', x: 81, y: 4 },
      { type: 'memory', x: 90, y: 5 },
      { type: 'checkpoint', x: 6, y: 8 },
      { type: 'checkpoint', x: 44, y: 7 },
      { type: 'checkpoint', x: 74, y: 8 },
      { type: 'checkpoint', x: 80, y: 8 },
      { type: 'enemy', kind: 'capanga', x: 12, y: 8, left: 9, right: 15 },
      { type: 'enemy', kind: 'soldado', x: 22, y: 8, left: 20, right: 23 },
      { type: 'enemy', kind: 'capanga', x: 31, y: 8, left: 28, right: 33 },
      { type: 'enemy', kind: 'soldado', x: 50, y: 8, left: 48, right: 53 },
      { type: 'enemy', kind: 'soldado', x: 56, y: 8, left: 53, right: 57 },
      { type: 'enemy', kind: 'capanga', x: 68, y: 8, left: 64, right: 71 },
      { type: 'enemy', kind: 'feitor', x: 86, y: 6, left: 84, right: 89 },
      { type: 'enemy', kind: 'soldado', x: 91, y: 8, left: 90, right: 94 },
    ],
    tail: {
      width: 176,
      from: 96,
      kinds: ['capanga', 'soldado', 'feitor'],
      enemyEvery: 9,
      memoryEvery: 9,
      platformEvery: 6,
      spikeEvery: 16,
      checkpointEvery: 20,
      safe: [110, 420],
    },
  }),

  makeLevel({
    width: 104,
    theme: 'night',
    name: 'Capítulo 4 — O Reencontro',
    subtitle: 'No coração da mata, o cativeiro tem nome e rosto.',
    spawn: { x: 2, y: 8 },
    water: [
      [20, 23],
      [48, 52],
      [70, 74],
      [88, 90],
      [112, 114],
    ],
    blocks: [
      { x: 21, y: 8, w: 1, h: 1 },
      { x: 23, y: 8, w: 1, h: 1 },
      { x: 30, y: 8, w: 5, h: 1 },
      { x: 49, y: 8, w: 2, h: 1 },
      { x: 52, y: 8, w: 1, h: 1 },
      { x: 56, y: 7, w: 6, h: 2 },
      { x: 71, y: 8, w: 2, h: 1 },
      { x: 74, y: 8, w: 1, h: 1 },
      { x: 78, y: 8, w: 5, h: 1 },
      { x: 88, y: 8, w: 1, h: 1 },
      { x: 90, y: 8, w: 1, h: 1 },
    ],
    platforms: [
      { x: 7, y: 6, w: 3 },
      { x: 14, y: 5, w: 4 },
      { x: 25, y: 7, w: 3 },
      { x: 36, y: 5, w: 4 },
      { x: 44, y: 6, w: 3 },
      { x: 53, y: 7, w: 3 },
      { x: 60, y: 5, w: 4 },
      { x: 66, y: 6, w: 3 },
      { x: 75, y: 7, w: 3 },
      { x: 84, y: 5, w: 3 },
      { x: 94, y: 6, w: 3 },
      { x: 98, y: 7, w: 3 },
    ],
    spikes: [
      { x: 32, y: 8, w: 2 },
      { x: 64, y: 8, w: 2 },
    ],
    bg: [
      [30, 0, 60, 4],
      [90, 0, 60, 4],
      [150, 0, 40, 4],
    ],
    entities: [
      { type: 'memory', x: 8, y: 5 },
      { type: 'memory', x: 15, y: 4 },
      { type: 'memory', x: 37, y: 4 },
      { type: 'memory', x: 45, y: 5 },
      { type: 'memory', x: 61, y: 4 },
      { type: 'memory', x: 67, y: 5 },
      { type: 'memory', x: 85, y: 4 },
      { type: 'checkpoint', x: 6, y: 8 },
      { type: 'checkpoint', x: 40, y: 8 },
      { type: 'checkpoint', x: 76, y: 8 },
      { type: 'checkpoint', x: 91, y: 8 },
      { type: 'enemy', kind: 'capanga', x: 11, y: 8, left: 8, right: 14 },
      { type: 'enemy', kind: 'soldado', x: 27, y: 8, left: 24, right: 29 },
      { type: 'enemy', kind: 'capanga', x: 37, y: 8, left: 35, right: 40 },
      { type: 'enemy', kind: 'soldado', x: 46, y: 8, left: 44, right: 47 },
      { type: 'enemy', kind: 'soldado', x: 60, y: 6, left: 56, right: 62 },
      { type: 'enemy', kind: 'soldado', x: 80, y: 7, left: 78, right: 83 },
      { type: 'enemy', kind: 'capanga', x: 86, y: 8, left: 83, right: 87 },
    ],
    tail: {
      width: 196,
      from: 104,
      kinds: ['soldado', 'feitor', 'capanga'],
      enemyEvery: 9,
      memoryEvery: 9,
      platformEvery: 6,
      spikeEvery: 16,
      checkpointEvery: 20,
      safe: [130, 460],
    },
  }),
]

const outDir = path.join('src', 'data', 'levels')
fs.mkdirSync(outDir, { recursive: true })

chapters.forEach((chapter, index) => {
  const { goalY, goal, ...data } = chapter
  const file = path.join(outDir, `cap${index + 1}.json`)
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
  console.log(
    `cap${index + 1}: ${data.name} · ${data.rows[0].length} colunas · objetivo x=${goal} y=${goalY} · ${data.entities.length} entidades`,
  )
})

if (process.exitCode) process.exit(process.exitCode)
