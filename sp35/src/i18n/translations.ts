import type { Language } from '../../shared/types'

export const translations: Record<Language, Record<string, string>> = {
  zh: {
    'app.title': '云游戏流媒体平台',
    'app.subtitle': '低延迟 · 高画质 · 即时玩',
    'game.select': '选择游戏',
    'game.start': '开始游戏',
    'game.loading': '正在加载...',
    'game.connecting': '正在连接游戏 {gameId}...',
    'game.exit': '退出',
    'game.score': '分数',
    'game.wave': '波次',
    'game.gameover': '游戏结束',
    'game.restart': '重新开始',

    'control.fullscreen': '全屏',
    'control.exitFullscreen': '退出全屏',
    'control.mute': '静音',
    'control.unmute': '取消静音',
    'control.settings': '设置',
    'control.record': '录制',
    'control.recording': '录制中',
    'control.stopRecording': '停止录制',
    'control.saveHighlight': '保存精彩时刻',
    'control.quality': '画质',
    'control.language': '语言',

    'quality.1080p': '1080p 高清',
    'quality.720p': '720p 标清',
    'quality.480p': '480p 流畅',

    'language.zh': '简体中文',
    'language.en': 'English',

    'stats.fps': 'FPS',
    'stats.bitrate': '码率',
    'stats.rtt': '延迟',
    'stats.packetLoss': '丢包率',
    'stats.fecRecovered': 'FEC恢复',
    'stats.nackRecovered': 'NACK恢复',
    'stats.inputLatency': '输入延迟',

    'connection.webrtc': '控制通道',
    'connection.webtransport': '视频通道',
    'connection.connected': '已连接',
    'connection.connecting': '连接中',
    'connection.disconnected': '已断开',

    'orientation.warning': '请旋转设备至横屏模式',
    'orientation.hint': '游戏体验在横屏下更佳',

    'touch.joystick': '虚拟摇杆',
    'touch.buttonA': '射击',
    'touch.buttonB': '技能',

    'recording.started': '录制已开始',
    'recording.stopped': '录制已停止',
    'recording.saved': '精彩时刻已保存',
    'recording.duration': '录制时长: {duration}s',
    'recording.bufferSize': '缓存帧数: {count}',

    'settings.title': '设置',
    'settings.video': '视频设置',
    'settings.audio': '音频设置',
    'settings.language': '语言设置',
    'settings.about': '关于',

    'toast.success': '操作成功',
    'toast.error': '操作失败',
    'toast.saved': '已保存',

    'back.home': '返回首页',
  },
  en: {
    'app.title': 'Cloud Gaming Platform',
    'app.subtitle': 'Low Latency · High Quality · Instant Play',
    'game.select': 'Select Game',
    'game.start': 'Start Game',
    'game.loading': 'Loading...',
    'game.connecting': 'Connecting to game {gameId}...',
    'game.exit': 'Exit',
    'game.score': 'Score',
    'game.wave': 'Wave',
    'game.gameover': 'Game Over',
    'game.restart': 'Restart',

    'control.fullscreen': 'Fullscreen',
    'control.exitFullscreen': 'Exit Fullscreen',
    'control.mute': 'Mute',
    'control.unmute': 'Unmute',
    'control.settings': 'Settings',
    'control.record': 'Record',
    'control.recording': 'Recording',
    'control.stopRecording': 'Stop Recording',
    'control.saveHighlight': 'Save Highlight',
    'control.quality': 'Quality',
    'control.language': 'Language',

    'quality.1080p': '1080p HD',
    'quality.720p': '720p SD',
    'quality.480p': '480p LD',

    'language.zh': '简体中文',
    'language.en': 'English',

    'stats.fps': 'FPS',
    'stats.bitrate': 'Bitrate',
    'stats.rtt': 'RTT',
    'stats.packetLoss': 'Packet Loss',
    'stats.fecRecovered': 'FEC Recovered',
    'stats.nackRecovered': 'NACK Recovered',
    'stats.inputLatency': 'Input Latency',

    'connection.webrtc': 'Control Channel',
    'connection.webtransport': 'Video Channel',
    'connection.connected': 'Connected',
    'connection.connecting': 'Connecting',
    'connection.disconnected': 'Disconnected',

    'orientation.warning': 'Please rotate to landscape mode',
    'orientation.hint': 'Better experience in landscape',

    'touch.joystick': 'Joystick',
    'touch.buttonA': 'Shoot',
    'touch.buttonB': 'Skill',

    'recording.started': 'Recording started',
    'recording.stopped': 'Recording stopped',
    'recording.saved': 'Highlight saved',
    'recording.duration': 'Duration: {duration}s',
    'recording.bufferSize': 'Buffer frames: {count}',

    'settings.title': 'Settings',
    'settings.video': 'Video Settings',
    'settings.audio': 'Audio Settings',
    'settings.language': 'Language Settings',
    'settings.about': 'About',

    'toast.success': 'Success',
    'toast.error': 'Error',
    'toast.saved': 'Saved',

    'back.home': 'Back to Home',
  },
}

export function getTranslation(lang: Language, key: string, params?: Record<string, string | number>): string {
  const text = translations[lang]?.[key] || key
  if (!params) return text
  return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), text)
}
