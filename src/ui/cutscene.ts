// Cutscene narrativa em DOM: fica sobre o canvas (que continua mostrando o
// cenário do capítulo) e usa a tipografia da interface. O jogo controla o
// avanço das falas; este módulo só desenha o estado.
export class CutsceneView {
  private readonly root = document.querySelector<HTMLDivElement>('#cutscene')
  private readonly kicker = document.querySelector<HTMLElement>('#cutscene-kicker')
  private readonly title = document.querySelector<HTMLElement>('#cutscene-title')
  private readonly line = document.querySelector<HTMLElement>('#cutscene-line')
  private readonly progress = document.querySelector<HTMLElement>('#cutscene-progress')
  private readonly hud = document.querySelector<HTMLDivElement>('#hud')

  private lines: string[] = []

  show(kicker: string, title: string, lines: string[]): void {
    this.lines = lines
    if (this.kicker) this.kicker.textContent = kicker
    if (this.title) this.title.textContent = title
    this.renderProgress()
    this.setLine(0)
    this.root?.classList.remove('is-hidden')
    this.hud?.classList.add('is-hidden')
    document.querySelector('#frame')?.classList.add('is-cutscene')
  }

  setLine(index: number): void {
    if (this.line) this.line.textContent = this.lines[index] ?? ''
    const dots = this.progress?.querySelectorAll<HTMLElement>('.cutscene-dot')
    dots?.forEach((dot, i) => dot.classList.toggle('is-current', i === index))
    if (this.line) {
      this.line.classList.remove('is-entering')
      void this.line.offsetWidth
      this.line.classList.add('is-entering')
    }
  }

  hide(): void {
    this.lines = []
    this.root?.classList.add('is-hidden')
    this.hud?.classList.remove('is-hidden')
    document.querySelector('#frame')?.classList.remove('is-cutscene')
  }

  private renderProgress(): void {
    const progress = this.progress
    if (!progress) return
    progress.textContent = ''
    this.lines.forEach(() => {
      const dot = document.createElement('span')
      dot.className = 'cutscene-dot'
      progress.append(dot)
    })
  }
}
