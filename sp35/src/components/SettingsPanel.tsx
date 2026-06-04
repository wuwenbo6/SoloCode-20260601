import { useCallback, useState } from 'react'
import { Settings, Monitor, Globe, X } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { useTranslation } from '@/hooks/useTranslation'
import type { QualityLevel, Language } from '../../shared/types'
import { QUALITY_PRESETS } from '../../shared/types'

interface SettingsPanelProps {
  onQualityChange?: (quality: QualityLevel) => void
}

export default function SettingsPanel({ onQualityChange }: SettingsPanelProps) {
  const { t, language, changeLanguage } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const quality = useGameStore((s) => s.quality)
  const setQuality = useGameStore((s) => s.setQuality)

  const handleQualityChange = useCallback((newQuality: QualityLevel) => {
    setQuality(newQuality)
    onQualityChange?.(newQuality)
  }, [setQuality, onQualityChange])

  const handleLanguageChange = useCallback((newLanguage: Language) => {
    changeLanguage(newLanguage)
  }, [changeLanguage])

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:border-[var(--cyan)] hover:text-[var(--cyan)]"
        title={t('control.settings')}
      >
        <Settings size={16} />
        <span className="hidden sm:inline">{t('control.settings')}</span>
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 w-64 rounded-lg border border-white/10 bg-[var(--bg-dark)]/95 p-4 shadow-xl backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-sm text-[var(--cyan)]">{t('settings.title')}</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 transition-colors hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
              <Monitor size={12} />
              {t('control.quality')}
            </div>
            <div className="flex flex-col gap-1">
              {(Object.keys(QUALITY_PRESETS) as QualityLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => handleQualityChange(level)}
                  className={`flex items-center justify-between rounded px-2 py-1.5 text-xs transition-colors ${
                    quality === level
                      ? 'bg-[var(--cyan)]/20 text-[var(--cyan)]'
                      : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <span>{t(`quality.${level}`)}</span>
                  <span className="text-gray-500">
                    {QUALITY_PRESETS[level].width}x{QUALITY_PRESETS[level].height}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
              <Globe size={12} />
              {t('control.language')}
            </div>
            <div className="flex gap-1">
              {(['zh', 'en'] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleLanguageChange(lang)}
                  className={`flex-1 rounded px-2 py-1.5 text-xs transition-colors ${
                    language === lang
                      ? 'bg-[var(--cyan)]/20 text-[var(--cyan)]'
                      : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  {t(`language.${lang}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
