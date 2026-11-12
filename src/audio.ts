type ToneOptions = {
  freq: number
  endFreq?: number
  duration: number
  type?: OscillatorType
  volume?: number
  delay?: number
}

class Sfx {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  muted = false

  constructor() {
    try {
      this.muted = localStorage.getItem('sandman:muted') === '1'
    } catch {
      this.muted = false
    }
  }

  unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume()
      return
    }

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return

    try {
      this.context = new Ctor()
      this.master = this.context.createGain()
      this.master.gain.value = this.muted ? 0 : 0.2
      this.master.connect(this.context.destination)

      const length = Math.floor(this.context.sampleRate * 0.4)
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
      this.noiseBuffer = buffer
    } catch {
      this.context = null
    }
  }

  toggle(): boolean {
    this.muted = !this.muted
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.2, this.context.currentTime, 0.02)
    }
    try {
      localStorage.setItem('sandman:muted', this.muted ? '1' : '0')
    } catch {
      // sem localStorage: segue só na sessão
    }
    return this.muted
  }

  private tone(options: ToneOptions): void {
    if (!this.context || !this.master || this.muted) return
    const now = this.context.currentTime + (options.delay ?? 0)
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()
    osc.type = options.type ?? 'square'
    osc.frequency.setValueAtTime(options.freq, now)
    if (options.endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFreq), now + options.duration)
    }
    const volume = options.volume ?? 0.18
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + options.duration + 0.02)
  }

  private noise(duration: number, volume: number, cutoff = 1200): void {
    if (!this.context || !this.master || !this.noiseBuffer || this.muted) return
    const now = this.context.currentTime
    const source = this.context.createBufferSource()
    source.buffer = this.noiseBuffer
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(cutoff, now)
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.4), now + duration)
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start(now)
    source.stop(now + duration)
  }

  jump(): void {
    this.tone({ freq: 260, endFreq: 520, duration: 0.13, volume: 0.12 })
  }

  dash(): void {
    this.noise(0.16, 0.16, 1800)
    this.tone({ freq: 180, endFreq: 90, duration: 0.14, volume: 0.1 })
  }

  attack(): void {
    this.noise(0.07, 0.11, 2600)
    this.tone({ freq: 190, endFreq: 130, duration: 0.08, volume: 0.09 })
  }

  hit(): void {
    this.noise(0.18, 0.22, 700)
    this.tone({ freq: 150, endFreq: 60, duration: 0.2, type: 'sawtooth', volume: 0.16 })
  }

  stomp(): void {
    this.tone({ freq: 420, endFreq: 90, duration: 0.14, type: 'triangle', volume: 0.2 })
    this.noise(0.1, 0.12, 900)
  }

  collect(): void {
    this.tone({ freq: 660, duration: 0.1, type: 'triangle', volume: 0.14 })
    this.tone({ freq: 990, duration: 0.16, type: 'triangle', volume: 0.13, delay: 0.07 })
  }

  splash(): void {
    this.noise(0.28, 0.2, 800)
    this.tone({ freq: 240, endFreq: 80, duration: 0.22, type: 'sine', volume: 0.1 })
  }

  // Tiro dos colonos: estalo curto de pólvora, distinto do ruído do golpe.
  shot(): void {
    this.noise(0.09, 0.13, 3200)
    this.tone({ freq: 320, endFreq: 70, duration: 0.11, type: 'square', volume: 0.08 })
  }

  win(): void {
    const notes = [392, 494, 587, 784]
    notes.forEach((freq, index) => {
      this.tone({
        freq,
        duration: 0.28,
        type: 'triangle',
        volume: 0.12,
        delay: index * 0.12,
      })
    })
  }

  click(): void {
    this.tone({ freq: 520, endFreq: 620, duration: 0.05, type: 'triangle', volume: 0.08 })
  }
}

export const sfx = new Sfx()
