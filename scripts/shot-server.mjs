// Servidor mínimo para receber capturas do canvas do jogo.
// Uso: node scripts/shot-server.mjs [porta]
// Depois, no console da página:
//   fetch('http://localhost:8787/shot', { method: 'POST', body: canvas.toDataURL() })

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const port = Number(process.argv[2] ?? 8787)
const outFile = path.resolve('raw/shot.png')

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(405)
    res.end('use POST')
    return
  }

  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8')
    const base64 = body.replace(/^data:image\/png;base64,/, '')
    fs.writeFileSync(outFile, Buffer.from(base64, 'base64'))
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(path.relative(process.cwd(), outFile))
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`servidor de captura em http://127.0.0.1:${port}`)
  console.log(`gravando em ${outFile}`)
})
