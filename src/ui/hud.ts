import { MAX_HP } from '../player'

const HEART_COUNT = MAX_HP

export class Hud {
  private readonly root = document.querySelector<HTMLDivElement>('#hud')
  private readonly hearts = document.querySelector<HTMLDivElement>('#hearts')
  private readonly chapter = document.querySelector<HTMLElement>('#chapter')
  private readonly difficulty = document.querySelector<HTMLElement>('#difficulty')
  private readonly bossBar = document.querySelector<HTMLDivElement>('#boss-bar')
  private readonly bossName = document.querySelector<HTMLElement>('#boss-name')
  private readonly bossSub = document.querySelector<HTMLElement>('#boss-sub')
  private readonly bossFill = document.querySelector<HTMLElement>('#boss-fill')
  private bossKey = ''
  private readonly muteButton = document.querySelector<HTMLButtonElement>('#mute')
  private readonly chapterCard = document.querySelector<HTMLDivElement>('#chapter-card')
  private readonly chapterKicker = document.querySelector<HTMLElement>('#chapter-card .chapter-kicker')
  private readonly chapterTitle = document.querySelector<HTMLElement>('#chapter-title')
  private readonly chapterSubtitle = document.querySelector<HTMLElement>('#chapter-subtitle')
  private readonly controls = document.querySelector<HTMLDivElement>('#controls-hint')
  private readonly tutorialPrompt = document.querySelector<HTMLDivElement>('#tutorial-prompt')

  private readonly heartElements: HTMLSpanElement[] = []
  private lastHp = HEART_COUNT
  private chapterTimer = 0
  private controlsTimer = 0

  constructor() {
    if (this.hearts) {
      for (let i = 0; i < HEART_COUNT; i += 1) {
        const heart = document.createElement('span')
        heart.className = 'heart'
        this.hearts.append(heart)
        this.heartElements.push(heart)
      }
    }
    this.muteButton?.addEventListener('click', () => {
      this.muteHandler?.()
    })
  }

  private muteHandler?: () => void

  onMute(handler: () => void): void {
    this.muteHandler = handler
  }

  setMuted(muted: boolean): void {
    this.muteButton?.classList.toggle('is-muted', muted)
    this.muteButton?.setAttribute('aria-label', muted ? 'Ligar o som' : 'Desligar o som')
    this.muteButton?.setAttribute('aria-pressed', String(muted))
  }

  setChapter(name: string): void {
    if (this.chapter) this.chapter.textContent = name
  }

  setDifficulty(label: string): void {
    if (this.difficulty) this.difficulty.textContent = label
  }

  setBoss(name: string, hp: number, maxHp: number, _title = '', enraged = false): void {
    if (!this.bossBar || !this.bossFill || !this.bossName) return
    const key = `${name}:${hp}:${maxHp}:${enraged}`
    if (key === this.bossKey) return
    this.bossKey = key
    this.bossBar.classList.remove('is-hidden')
    this.bossBar.classList.toggle('is-enraged', enraged)
    this.bossName.textContent = name.toUpperCase()
    // O título/tradução ("Mãe", "Pai", "Irmã") não aparece mais: a barra
    // mostra só o nome em tupi, como pedido.
    if (this.bossSub) {
      this.bossSub.textContent = ''
      this.bossSub.classList.add('is-hidden')
    }
    this.bossFill.style.width = `${Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100))}%`
  }

  hideBoss(): void {
    if (!this.bossBar || this.bossKey === '') return
    this.bossKey = ''
    this.bossBar.classList.add('is-hidden')
    this.bossBar.classList.remove('is-enraged')
  }

  show(): void {
    this.root?.classList.remove('is-hidden')
  }

  hide(): void {
    this.root?.classList.add('is-hidden')
  }

  render(hp: number): void {
    if (hp < this.lastHp) {
      const lost = this.heartElements[hp]
      lost?.classList.add('lost')
      lost?.addEventListener('animationend', () => lost.classList.remove('lost'), { once: true })
    }
    this.lastHp = hp
    this.heartElements.forEach((heart, index) => {
      heart.classList.toggle('empty', index >= hp)
    })
  }

  resetHp(): void {
    this.lastHp = HEART_COUNT
  }

  showChapterCard(kicker: string, title: string, subtitle: string): void {
    const card = this.chapterCard
    if (!card) return
    if (this.chapterKicker) this.chapterKicker.textContent = kicker
    if (this.chapterTitle) this.chapterTitle.textContent = title
    if (this.chapterSubtitle) this.chapterSubtitle.textContent = subtitle
    window.clearTimeout(this.chapterTimer)
    card.classList.remove('is-hidden')
    card.style.animation = 'none'
    void card.offsetWidth
    card.style.animation = ''
    this.chapterTimer = window.setTimeout(() => {
      card.classList.add('is-hidden')
    }, 3600)
  }

  showControlsHint(): void {
    const controls = this.controls
    if (!controls) return
    window.clearTimeout(this.controlsTimer)
    controls.classList.remove('is-hidden')
    controls.style.animation = 'none'
    void controls.offsetWidth
    controls.style.animation = ''
    this.controlsTimer = window.setTimeout(() => {
      controls.classList.add('is-hidden')
    }, 9000)
  }

  hideOverlays(): void {
    window.clearTimeout(this.chapterTimer)
    window.clearTimeout(this.controlsTimer)
    this.chapterCard?.classList.add('is-hidden')
    this.controls?.classList.add('is-hidden')
    this.hideTutorialPrompt()
  }

  showTutorialPrompt(text: string): void {
    const element = this.tutorialPrompt
    if (!element) return
    if (element.textContent !== text) element.textContent = text
    element.classList.remove('is-hidden')
  }

  hideTutorialPrompt(): void {
    this.tutorialPrompt?.classList.add('is-hidden')
  }
}
