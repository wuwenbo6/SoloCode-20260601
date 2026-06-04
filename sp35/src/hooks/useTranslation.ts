import { useCallback } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { getTranslation } from '@/i18n/translations'
import type { Language } from '../../shared/types'

export function useTranslation() {
  const language = useGameStore((s) => s.language)
  const setLanguage = useGameStore((s) => s.setLanguage)

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    return getTranslation(language, key, params)
  }, [language])

  const changeLanguage = useCallback((lang: Language) => {
    setLanguage(lang)
  }, [setLanguage])

  return {
    t,
    language,
    changeLanguage,
  }
}
