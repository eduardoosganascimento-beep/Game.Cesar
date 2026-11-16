import fs from 'node:fs'
import path from 'node:path'

const dir = 'src/data/levels'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
const solid = '#'
const platform = '-'
const spike = '^'
const water = '~'

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
  const rows = data.rows
  const cols = Math.max(...rows.map((r) => r.length))
  const issues = []

  rows.forEach((row, y) => {
    if (row.length !== cols) issues.push(`linha ${y} tem ${row.length} colunas (esperado ${cols})`)
  })

  const at = (x, y) => {
    if (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length) return '.'
    return rows[y][x]
  }

  const spawn = data.spawn
  if (!spawn) issues.push('sem spawn')
  else {
    const t = at(spawn.x, spawn.y)
    if (t === solid) issues.push(`spawn (${spawn.x},${spawn.y}) dentro de bloco sólido`)
    if (t === water) issues.push(`spawn (${spawn.x},${spawn.y}) dentro da água`)
    if (t === spike) issues.push(`spawn (${spawn.x},${spawn.y}) sobre espinhos`)
  }

  for (const [index, e] of (data.entities ?? []).entries()) {
    const label = `${e.type}${e.kind ? '/' + e.kind : ''} #${index} (${e.x},${e.y})`
    if (e.x < 0 || e.x >= cols || e.y < 0 || e.y >= rows.length) {
      issues.push(`${label} fora do mapa`)
      continue
    }
    const here = at(e.x, e.y)
    if (e.type === 'checkpoint') {
      if (here === water || here === spike) issues.push(`${label} em tile perigoso`)
      if (at(e.x, e.y + 1) !== solid && at(e.x, e.y + 1) !== platform) {
        issues.push(`${label} sem chão embaixo (${at(e.x, e.y + 1)})`)
      }
    }
    if (e.type === 'enemy') {
      if (here === water) issues.push(`${label} dentro da água`)
      if (at(e.x, e.y + 1) !== solid && at(e.x, e.y + 1) !== platform) {
        issues.push(`${label} sem chão embaixo (${at(e.x, e.y + 1)})`)
      }
      if (e.left !== undefined && e.right !== undefined && e.right <= e.left) {
        issues.push(`${label} com left>=right`)
      }
    }
    if (e.type === 'memory' && here === solid) {
      issues.push(`${label} dentro de bloco sólido`)
    }
  }

  const counts = {}
  for (const e of data.entities ?? []) counts[e.type] = (counts[e.type] ?? 0) + 1
  const summary = `mem=${counts.memory ?? 0} chk=${counts.checkpoint ?? 0} enemies=${counts.enemy ?? 0} cols=${cols} rows=${rows.length}`
  console.log(`${issues.length ? 'ERROS ' : 'OK    '} ${file} (${summary})`)
  for (const issue of issues) console.log(`        - ${issue}`)
}
