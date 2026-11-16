// Cenário removido a pedido: só os inimigos devem aparecer.
// O mapa continua com colisão (tiles sólidos invisíveis) para ninguém cair.
import type { LevelTheme, TileMap } from './level'

export function drawScenery(
  _ctx: CanvasRenderingContext2D,
  _map: TileMap,
  _cameraX: number,
  _cameraY: number,
  _goalX: number,
  _goalBaseY: number,
  _time: number,
  _theme: LevelTheme,
  _goalLocked: boolean,
): void {
  // nada
}
