export type RunStats = {
  memories: number
  total: number
  seconds: number
  allMemories: boolean
  chapterIndex: number
  chapterName: string
  endText: string
  nextChapter: boolean
}

export type ChapterOption = {
  name: string
  shortTitle: string
  tag: string
  subtitle: string
}

export type ScreenHandlers = {
  onChapter: (index: number) => void
  onNext: () => void
  onResume: () => void
  onRestart: () => void
  onMenu: () => void
}

type ScreenName = 'main' | 'chapters' | 'how' | 'credits'
type Visible = 'menu' | 'pause' | 'end' | 'none'

export class Screens {
  private readonly menu = document.querySelector<HTMLDivElement>('#overlay')
  private readonly pause = document.querySelector<HTMLDivElement>('#pause')
  private readonly end = document.querySelector<HTMLDivElement>('#end')
  private readonly endKicker = document.querySelector<HTMLElement>('#end-kicker')
  private readonly endTitle = document.querySelector<HTMLElement>('#end-title')
  private readonly endText = document.querySelector<HTMLElement>('#end-text')
  private readonly endStats = document.querySelector<HTMLElement>('#end-stats')
  private readonly endNext = document.querySelector<HTMLButtonElement>('#end-next')
  private readonly chapterList = document.querySelector<HTMLElement>('#chapter-list')

  private buttons: HTMLButtonElement[] = []
  private readonly bound = new WeakSet<HTMLButtonElement>()
  private visible: Visible = 'menu'
  private screen: ScreenName = 'main'
  private selected = 0

  constructor(private readonly handlers: ScreenHandlers) {
    this.bindButtons()
    window.addEventListener('keydown', (event) => this.onKeyDown(event))
    this.showMenu()
  }

  setChapters(chapters: ChapterOption[]): void {
    const list = this.chapterList
    if (!list) return
    list.textContent = ''

    chapters.forEach((chapter, index) => {
      const button = document.createElement('button')
      button.className = 'chapter-item'
      button.type = 'button'
      button.dataset.action = 'chapter'
      button.dataset.chapter = String(index)

      const number = document.createElement('span')
      number.className = 'chapter-number'
      number.textContent = String(index + 1).padStart(2, '0')

      const copy = document.createElement('span')
      copy.className = 'chapter-copy'
      const title = document.createElement('b')
      title.textContent = chapter.shortTitle
      const subtitle = document.createElement('small')
      subtitle.textContent = chapter.subtitle
      copy.append(title, subtitle)

      const tag = document.createElement('span')
      tag.className = 'chapter-tag'
      tag.textContent = chapter.tag

      button.append(number, copy, tag)
      list.append(button)
    })

    this.bindButtons()
    if (this.visible === 'menu' && this.screen === 'chapters') this.select(0)
  }

  showMenu(): void {
    this.visible = 'menu'
    this.menu?.classList.remove('is-hidden')
    this.pause?.classList.add('is-hidden')
    this.end?.classList.add('is-hidden')
    this.setScreen('main')
  }

  showChapters(): void {
    this.visible = 'menu'
    this.menu?.classList.remove('is-hidden')
    this.pause?.classList.add('is-hidden')
    this.end?.classList.add('is-hidden')
    this.setScreen('chapters')
  }

  showPause(): void {
    this.visible = 'pause'
    this.menu?.classList.add('is-hidden')
    this.pause?.classList.remove('is-hidden')
    this.end?.classList.add('is-hidden')
    this.select(0)
  }

  showEnd(stats: RunStats): void {
    this.visible = 'end'
    this.menu?.classList.add('is-hidden')
    this.pause?.classList.add('is-hidden')
    this.end?.classList.remove('is-hidden')

    if (this.endKicker) {
      this.endKicker.textContent = stats.nextChapter
        ? `Capítulo ${stats.chapterIndex + 1} concluído`
        : 'Fim da jornada'
    }
    if (this.endTitle) this.endTitle.textContent = stats.chapterName
    if (this.endText) this.endText.textContent = stats.endText

    if (this.endStats) {
      this.endStats.textContent = ''
      this.addStat('Memórias', `${stats.memories}/${stats.total}`)
      this.addStat('Tempo', formatTime(stats.seconds))
      if (stats.allMemories) this.addStat('Trilha', 'completa')
    }

    this.endNext?.classList.toggle('is-hidden', !stats.nextChapter)
    this.select(0)
  }

  hideAll(): void {
    this.visible = 'none'
    this.menu?.classList.add('is-hidden')
    this.pause?.classList.add('is-hidden')
    this.end?.classList.add('is-hidden')
    this.clearSelection()
  }

  back(): boolean {
    if (this.visible !== 'menu' || this.screen === 'main') return false
    this.setScreen('main')
    return true
  }

  private bindButtons(): void {
    this.buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('#overlay button, #pause button, #end button'),
    )

    for (const button of this.buttons) {
      if (this.bound.has(button)) continue
      this.bound.add(button)
      button.addEventListener('click', () => this.activate(button))
      button.addEventListener('mouseenter', () => {
        const active = this.activeButtons()
        const index = active.indexOf(button)
        if (index >= 0) this.select(index)
      })
    }
  }

  private addStat(label: string, value: string): void {
    if (!this.endStats) return
    const card = document.createElement('div')
    card.className = 'stat-card'
    const strong = document.createElement('b')
    strong.textContent = value
    card.append(strong, document.createTextNode(label))
    this.endStats.append(card)
  }

  private setScreen(screen: ScreenName): void {
    this.screen = screen
    const screens = this.menu?.querySelectorAll<HTMLElement>('[data-screen]')
    screens?.forEach((element) => {
      element.classList.toggle('is-hidden', element.dataset.screen !== screen)
    })
    this.select(0)
  }

  private activeButtons(): HTMLButtonElement[] {
    if (this.visible === 'pause') {
      return Array.from(this.pause?.querySelectorAll<HTMLButtonElement>('.menu-item') ?? [])
    }
    if (this.visible === 'end') {
      return Array.from(
        this.end?.querySelectorAll<HTMLButtonElement>('.menu-back:not(.is-hidden)') ?? [],
      )
    }
    if (this.visible === 'menu') {
      return Array.from(
        this.menu?.querySelectorAll<HTMLButtonElement>(
          '.menu-screen:not(.is-hidden) .menu-item, .menu-screen:not(.is-hidden) .chapter-item, .menu-screen:not(.is-hidden) .menu-back',
        ) ?? [],
      )
    }
    return []
  }

  private select(index: number): void {
    this.clearSelection()
    this.selected = index
    const active = this.activeButtons()
    if (!active.length) return
    const normalized = ((index % active.length) + active.length) % active.length
    this.selected = normalized
    active[normalized]?.classList.add('is-selected')
  }

  private clearSelection(): void {
    for (const button of this.buttons) button.classList.remove('is-selected')
  }

  private activate(button: HTMLButtonElement): void {
    button.blur()
    const action = button.dataset.action

    switch (action) {
      case 'chapters':
        this.showChapters()
        break
      case 'chapter': {
        const index = Number(button.dataset.chapter ?? 0)
        this.handlers.onChapter(index)
        break
      }
      case 'next':
        this.handlers.onNext()
        break
      case 'how':
        this.setScreen('how')
        break
      case 'credits':
        this.setScreen('credits')
        break
      case 'back':
        this.setScreen('main')
        break
      case 'resume':
        this.handlers.onResume()
        break
      case 'restart':
      case 'replay':
        this.handlers.onRestart()
        break
      case 'menu':
        this.handlers.onMenu()
        break
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.visible === 'none') return
    if (event.repeat) {
      if (event.code === 'ArrowUp' || event.code === 'ArrowDown') event.preventDefault()
      return
    }

    const isMoveUp = event.code === 'ArrowUp' || event.code === 'KeyW'
    const isMoveDown = event.code === 'ArrowDown' || event.code === 'KeyS'
    const isConfirm = event.code === 'Enter' || event.code === 'Space'

    if (!isMoveUp && !isMoveDown && !isConfirm) return
    if (
      this.visible === 'menu' &&
      this.screen !== 'main' &&
      this.screen !== 'chapters' &&
      (isMoveUp || isMoveDown)
    ) {
      event.preventDefault()
      return
    }

    event.preventDefault()

    if (isMoveUp) this.select(this.selected - 1)
    else if (isMoveDown) this.select(this.selected + 1)
    else {
      const active = this.activeButtons()
      const button = active[this.selected]
      button?.click()
    }
  }
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
