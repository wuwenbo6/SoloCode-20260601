type ClipboardDirection = 'to-remote' | 'to-controller'

type ClipboardCallback = (text: string, direction: ClipboardDirection) => void

export class ClipboardSync {
  private lastLocalText: string = ''
  private lastRemoteText: string = ''
  private onRemoteClipboard: ClipboardCallback | null = null
  private listening: boolean = false
  private pollIntervalId: number | null = null
  private pollIntervalMs: number = 500

  onRemoteClipboardUpdate(callback: ClipboardCallback) {
    this.onRemoteClipboard = callback
  }

  startListening() {
    if (this.listening) return
    this.listening = true

    document.addEventListener('copy', this.handleCopy)
    document.addEventListener('cut', this.handleCut)
    this.pollIntervalId = window.setInterval(() => this.pollLocalClipboard(), this.pollIntervalMs)
  }

  stopListening() {
    if (!this.listening) return
    this.listening = false

    document.removeEventListener('copy', this.handleCopy)
    document.removeEventListener('cut', this.handleCut)

    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId)
      this.pollIntervalId = null
    }
  }

  getLocalClipboardText(): string | null {
    try {
      return null
    } catch {
      return null
    }
  }

  async setLocalClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      this.lastLocalText = text
      return true
    } catch {
      return false
    }
  }

  handleRemoteClipboard(text: string) {
    if (text === this.lastRemoteText) return
    this.lastRemoteText = text

    this.setLocalClipboard(text)

    if (this.onRemoteClipboard) {
      this.onRemoteClipboard(text, 'to-controller')
    }
  }

  private handleCopy = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && text !== this.lastLocalText && text !== this.lastRemoteText) {
        this.lastLocalText = text
        if (this.onRemoteClipboard) {
          this.onRemoteClipboard(text, 'to-remote')
        }
      }
    } catch {}
  }

  private handleCut = async () => {
    setTimeout(async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (text && text !== this.lastLocalText && text !== this.lastRemoteText) {
          this.lastLocalText = text
          if (this.onRemoteClipboard) {
            this.onRemoteClipboard(text, 'to-remote')
          }
        }
      } catch {}
    }, 100)
  }

  private pollLocalClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && text !== this.lastLocalText && text !== this.lastRemoteText) {
        this.lastLocalText = text
        if (this.onRemoteClipboard) {
          this.onRemoteClipboard(text, 'to-remote')
        }
      }
    } catch {}
  }

  sendClipboardText(text: string) {
    if (text === this.lastLocalText) return
    this.lastLocalText = text
  }

  dispose() {
    this.stopListening()
    this.onRemoteClipboard = null
  }
}
