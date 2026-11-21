// Sandman Database — API leve sem dependências externas.
// Guarda recordes, progresso por jogador e a configuração publicada do jogo.
// Persiste em JSON no disco (volume efêmero do Render + backup via Git).

'use strict'

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const PORT = Number(process.env.PORT) || 10000
const DATA_FILE = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.join(__dirname, 'data', 'db.json')
const MAX_SCORES = 200
const MAX_BODY = 16 * 1024

const EMPTY = { scores: [], progress: {}, createdAt: new Date().toISOString() }

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    return {
      scores: Array.isArray(raw.scores) ? raw.scores : [],
      progress: raw.progress && typeof raw.progress === 'object' ? raw.progress : {},
      createdAt: raw.createdAt || EMPTY.createdAt,
    }
  } catch {
    return { ...EMPTY, scores: [], progress: {} }
  }
}

let state = load()

function persist() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  const tmp = `${DATA_FILE}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
  fs.renameSync(tmp, DATA_FILE)
}

function json(res, status, body, req) {
  const origin = req && req.headers.origin
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('Corpo muito grande'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch {
        reject(new Error('JSON inválido'))
      }
    })
    req.on('error', reject)
  })
}

const text = (value, max = 40) =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''
const number = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback

const CONFIG = {
  version: '1.7',
  player: { maxHp: 6, damage: { colonist: 1, zombie: 1, trap: 1, boss: 2 } },
  parry: { window: 0.36, perfect: 0.16 },
  boss: { enragedAt: 0.4, arenaMinWidth: 320 },
  platforms: { dropThrough: 0.22 },
}

const ROUTES = {
  'GET /health': () => ({ ok: true, uptime: process.uptime(), records: state.scores.length }),
  'GET /api/config': () => CONFIG,
  'GET /api/stats': () => ({
    scores: state.scores.length,
    players: Object.keys(state.progress).length,
    bestTime: state.scores.length ? Math.min(...state.scores.map((s) => s.seconds)) : null,
  }),
}

function routeScores(url, res, req) {
  if (req.method === 'GET') {
    const limit = Math.max(1, Math.min(50, number(url.searchParams.get('limit'), 10)))
    const sorted = [...state.scores].sort((a, b) => a.seconds - b.seconds).slice(0, limit)
    return json(res, 200, { scores: sorted }, req)
  }
  if (req.method === 'POST') {
    return readBody(req).then((body) => {
      const player = text(body.player) || 'sem-nome'
      const score = {
        id: crypto.randomUUID(),
        player,
        chapter: Math.max(1, Math.min(5, number(body.chapter, 1))),
        seconds: Math.max(0, number(body.seconds)),
        difficulty: ['facil', 'normal', 'dificil'].includes(body.difficulty)
          ? body.difficulty
          : 'normal',
        createdAt: new Date().toISOString(),
      }
      state.scores.push(score)
      state.scores = state.scores.slice(-MAX_SCORES)
      persist()
      return json(res, 201, { score }, req)
    })
  }
  return json(res, 405, { error: 'Método não permitido' }, req)
}

function routeProgress(url, res, req) {
  const match = url.pathname.match(/^\/api\/progress\/([A-Za-z0-9_-]{1,32})$/)
  if (!match) return json(res, 400, { error: 'Jogador inválido' }, req)
  const key = match[1]
  if (req.method === 'GET') {
    return json(res, 200, { player: key, ...(state.progress[key] || {}) }, req)
  }
  if (req.method === 'PUT') {
    return readBody(req).then((body) => {
      state.progress[key] = {
        chapter: Math.max(0, Math.min(4, number(body.chapter, 0))),
        difficulty: ['facil', 'normal', 'dificil'].includes(body.difficulty)
          ? body.difficulty
          : 'normal',
        updatedAt: new Date().toISOString(),
      }
      persist()
      return json(res, 200, { player: key, ...state.progress[key] }, req)
    })
  }
  return json(res, 405, { error: 'Método não permitido' }, req)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'OPTIONS') return json(res, 204, {}, req)

  const simple = ROUTES[`${req.method} ${url.pathname}`]
  if (simple) {
    try {
      return json(res, 200, simple(), req)
    } catch (error) {
      return json(res, 500, { error: String(error.message || error) }, req)
    }
  }

  if (url.pathname === '/api/scores') {
    return Promise.resolve(routeScores(url, res, req)).catch((error) =>
      json(res, 400, { error: String(error.message || error) }, req),
    )
  }

  if (url.pathname.startsWith('/api/progress/')) {
    return Promise.resolve(routeProgress(url, res, req)).catch((error) =>
      json(res, 400, { error: String(error.message || error) }, req),
    )
  }

  return json(res, 404, { error: 'Rota não encontrada' }, req)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[sandman-db] ouvindo na porta ${PORT} · ${DATA_FILE}`)
})
