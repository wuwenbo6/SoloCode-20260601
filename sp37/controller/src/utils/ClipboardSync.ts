type ClipboardCallback = (text: string, direction: 'to-remote' | 'to-controller') => void

export class ClipboardSync {
  private lastLocalText: string = ''
  private lastRemoteText: string = ''
  private callback: ClipboardCallback | null = null
  private listening: boolean = false
  private pollIntervalId: number | null = null
  private pollIntervalMs: number = 500

  onClipboardUpdate(callback: ClipboardCallback) {
    this.callback = callback
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

    if (this.callback) {
      this.callback(text, 'to-controller')
    }
  }

  private handleCopy = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && text !== this.lastLocalText && text !== this.lastRemoteText) {
        this.lastLocalText = text
        if (this.callback) {
          this.callback(text, 'to-remote')
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
          if (this.callback) {
            this.callback(text, 'to-remote')
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
        if (this.callback) {
          this.callback(text, 'to-remote')
        }
      }
    } catch {}
  }

  dispose() {
    this.stopListening()
    this.callback = null
  }
}
