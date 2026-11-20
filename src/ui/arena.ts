// Enquadramento visual da arena do chefe. Fica fora do loop principal para
// que a renderização do duelo possa evoluir sem inflar `main.ts`. Tudo é
// determinístico no tempo: sem estado por quadro e sem efeitos criados no
// render, o desenho é idêntico em 60 fps, no pause e nos testes.

import { VIEW_W, type Camera } from '../engine'
import type { Enemy } from '../enemy'

function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

export function paintBossArena(
  ctx: CanvasRenderingContext2D,
  enemies: Enemy[],
  camera: Camera,
  time: number,
): void {
  const boss = enemies.find((enemy) => enemy.isBoss && enemy.alive && enemy.visible)
  if (!boss) return

  const arena = boss.bossArena
  const left = Math.round(arena.left - camera.px)
  const right = Math.round(arena.right - camera.px)
  if (right < 0 || left > VIEW_W) return

  const groundY = Math.round(boss.y + boss.h - camera.py)
  const centerX = Math.round(boss.x + boss.w / 2 - camera.px)
  const enraged = boss.isEnraged
  const strength = enraged ? 1 : 0.62

  ctx.save()

  // Sem moldura escura nas bordas: a arena agora é um espaço aberto de
  // combate, não uma caixa. O ritual fica só no chão e nas brasas.

  // Círculo ritual no chão: três faixas finas e marcas simétricas.
  const radiusX = Math.min(84, Math.max(24, (right - left) / 2 - 10))
  ctx.globalAlpha = 0.5 * strength
  ctx.strokeStyle = boss.bossRim
  ctx.lineWidth = 1
  for (let ring = 0; ring < 3; ring += 1) {
    const rx = radiusX - ring * 9
    const ry = 6 - ring
    if (rx <= 2 || ry <= 0) continue
    ctx.beginPath()
    ctx.ellipse(centerX, groundY - 1, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = rgba(boss.bossAura, 0.35 * strength)
  for (let mark = -3; mark <= 3; mark += 1) {
    const mx = Math.round(centerX + mark * 13)
    if (mx < left || mx > right) continue
    ctx.fillRect(mx, groundY - 3 + (Math.abs(mark) % 2), 3, 1)
  }

  // Tochas rituais nas bordas da arena.
  for (const postX of [left + 9, right - 9]) {
    if (postX < -8 || postX > VIEW_W + 8) continue
    const flameY = groundY - 22 + Math.round(Math.sin(time * 9 + postX) * 1.5)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#241a10'
    ctx.fillRect(Math.round(postX) - 1, groundY - 18, 2, 18)
    const glow = ctx.createRadialGradient(postX, flameY, 0.5, postX, flameY, 11)
    glow.addColorStop(0, rgba('#ffd166', 0.6 * strength))
    glow.addColorStop(0.5, rgba('#ff8b3d', 0.24 * strength))
    glow.addColorStop(1, 'rgba(255, 139, 61, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(Math.round(postX) - 11, flameY - 11, 22, 22)
    ctx.fillStyle = '#ffcf8a'
    ctx.fillRect(Math.round(postX), flameY, 2, 3)
  }

  // Brasas suspensas: deriva lenta, sem partículas persistentes.
  const span = Math.max(1, right - left)
  for (let i = 0; i < 14; i += 1) {
    const seed = i * 17.3
    const px = left + ((seed * 13 + time * (7 + (i % 3))) % span)
    const py = groundY - 16 - ((seed * 7 + time * 11) % 58)
    ctx.globalAlpha = Math.max(0.05, 0.12 + Math.sin(time * 2 + i) * 0.1) * strength
    ctx.fillStyle = enraged ? '#ff9f43' : boss.bossRim
    ctx.fillRect(Math.round(px), Math.round(py), 1, 1)
  }

  ctx.restore()
}
