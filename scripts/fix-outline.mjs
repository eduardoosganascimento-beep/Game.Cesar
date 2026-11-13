import fs from 'node:fs'
const p = 'src/main.ts'
let s = fs.readFileSync(p, 'utf8')
s = s.replace('this.drawSprite(sprite, -sprite.ax * scale, dy, scale, 0.42)', 'this.drawSprite(sprite, -sprite.ax * scale, dy, scale, 0.26)')
s = s.replace('this.drawSprite(sprite, dx, dy, scale, 0.42)', 'this.drawSprite(sprite, dx, dy, scale, 0.26)')
fs.writeFileSync(p, s)
console.log('contorno do inimigo ajustado')
