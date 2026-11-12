const HEART_COUNT = 3

export class Hud {
  private readonly root = document.querySelector<HTMLDivElement>('#hud')
  private readonly hearts = document.querySelector<HTMLDivElement>('#hearts')
  private readonly memories = document.querySelector<HTMLElement>('#memories')
  private readonly memoryTotal = document.querySelector<HTMLElement>('#memory-total')
  private readonly chapter = document.querySelector<HTMLElement>('#chapter')
  private readonly muteButton = document.querySelector<HTMLButtonElement>('#mute')
  private readonly chapterCard = document.querySelector<HTMLDivElement>('#chapter-card')
  private readonly chapterKicker = document.querySelector<HTMLElement>('#chapter-card .chapter-kicker')
  private readonly chapterTitle = document.querySelector<HTMLElement>('#chapter-title')
  private readonly chapterSubtitle = document.querySelector<HTMLElement>('#chapter-subtitle')
  private readonly controls = document.querySelector<HTMLDivElement>('#controls-hint')
  private readonly interact = document.querySelector<HTMLDivElement>('#interact')
  private readonly boss = document.querySelector<HTMLDivElement>('#boss')
  private readonly bossLabel = document.querySelector<HTMLElement>('#boss-label')
  private readonly bossPips = document.querySelector<HTMLDivElement>('#boss-pips')

  private readonly heartElements: HTMLSpanElement[] = []
  private readonly bossElements: HTMLSpanElement[] = []
  private lastHp = HEART_COUNT
  private lastCollected = 0
  private chapterTimer = 0
  private controlsTimer = 0
  private interactTimer = 0

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

  showBoss(label: string, hp: number, max: number): void {
    if (this.bossLabel) this.bossLabel.textContent = label
    this.bossElements.length = 0
    if (this.bossPips) {
      this.bossPips.textContent = ''
      for (let i = 0; i < max; i += 1) {
        const pip = document.createElement('span')
        pip.className = 'boss-pip'
        this.bossPips.append(pip)
        this.bossElements.push(pip)
      }
    }
    this.renderBoss(hp, max)
    this.boss?.classList.remove('is-hidden')
  }

  renderBoss(hp: number, max: number): void {
    this.bossElements.forEach((pip, index) => {
      pip.classList.toggle('empty', index >= hp)
    })
    this.boss?.classList.toggle('is-enraged', hp <= Math.ceil(max / 3))
  }

  hideBoss(): void {
    this.boss?.classList.add('is-hidden')
    this.bossElements.length = 0
  }

  show(): void {
    this.root?.classList.remove('is-hidden')
  }

  hide(): void {
    this.root?.classList.add('is-hidden')
    this.hideBoss()
  }

  render(hp: number, collected: number, total: number): void {
    if (hp < this.lastHp) {
      const lost = this.heartElements[hp]
      lost?.classList.add('lost')
      lost?.addEventListener('animationend', () => lost.classList.remove('lost'), { once: true })
    }
    this.lastHp = hp

    this.heartElements.forEach((heart, index) => {
      heart.classList.toggle('empty', index >= hp)
    })

    if (this.memories) this.memories.textContent = String(collected)
    if (this.memoryTotal) this.memoryTotal.textContent = `/ ${total}`

    if (collected > this.lastCollected) this.popMemory()
    this.lastCollected = collected
  }

  resetHp(): void {
    this.lastHp = HEART_COUNT
    this.lastCollected = 0
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
    window.clearTimeout(this.interactTimer)
    this.chapterCard?.classList.add('is-hidden')
    this.controls?.classList.add('is-hidden')
    this.interact?.classList.add('is-hidden')
  }

  showInteract(text = 'Entrar na cabana'): void {
    const element = this.interact
    if (!element) return
    const label = `E · ${text}`
    if (element.textContent !== label) element.textContent = label
    if (element.classList.contains('is-hidden')) element.classList.remove('is-hidden')
    if (!element.classList.contains('is-pulsing')) {
      element.classList.add('is-pulsing')
      window.clearTimeout(this.interactTimer)
      this.interactTimer = window.setTimeout(() => element.classList.remove('is-pulsing'), 1400)
    }
  }

  hideInteract(): void {
    this.interact?.classList.add('is-hidden')
  }

  private popMemory(): void {
    this.memories?.animate(
      [
        { color: '#ffd166', transform: 'scale(1)' },
        { color: '#fff6d0', transform: 'scale(1.4)' },
        { color: '#ffd166', transform: 'scale(1)' },
      ],
      { duration: 320, easing: 'ease-out' },
    )
    this.memoryTotal?.animate([{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }], {
      duration: 320,
      easing: 'ease-out',
    })
  }
}
