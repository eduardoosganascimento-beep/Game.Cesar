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
  private readonly tutorialPrompt = document.querySelector<HTMLDivElement>('#tutorial-prompt')
  private readonly boss = document.querySelector<HTMLDivElement>('#boss')
  private readonly bossLabel = document.querySelector<HTMLElement>('#boss-label')
  private readonly bossTrack = document.querySelector<HTMLDivElement>('#boss-track')
  private readonly bossFill = document.querySelector<HTMLDivElement>('#boss-fill')
  private readonly bossHp = document.querySelector<HTMLElement>('#boss-hp')

  private readonly heartElements: HTMLSpanElement[] = []
  private lastHp = HEART_COUNT
  private lastCollected = 0
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

  showBoss(label: string, hp: number, max: number): void {
    if (this.bossLabel) this.bossLabel.textContent = label
    this.boss?.classList.remove('is-hidden')
    if (this.bossTrack) {
      this.bossTrack.setAttribute('aria-valuemin', '0')
      this.bossTrack.setAttribute('aria-valuemax', String(max))
      this.bossTrack.setAttribute('aria-valuenow', String(hp))
    }
    if (this.bossFill) {
      this.bossFill.style.width = `${Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100))}%`
    }
    if (this.bossHp) this.bossHp.textContent = `${hp}/${max}`
    this.renderBoss(hp, max)
  }

  renderBoss(hp: number, max: number): void {
    if (this.bossFill) {
      this.bossFill.style.width = `${Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100))}%`
    }
    if (this.bossHp) this.bossHp.textContent = `${hp}/${max}`
    this.boss?.classList.toggle('is-enraged', hp <= Math.ceil(max / 3))
  }

  hideBoss(): void {
    this.boss?.classList.add('is-hidden')
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
