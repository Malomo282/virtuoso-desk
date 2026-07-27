'use client'
import { useEffect, useState } from 'react'

export const THEMES = [
  {
    id: 'dark',
    label: 'Dark — Modern Luxury',
    desc: 'Deep charcoal with the Virtuoso gold. The default.',
    swatch: ['#0D0D12', '#16161D', '#C8A94A'],
  },
  {
    id: 'midnight',
    label: 'Midnight — Pure Black',
    desc: 'True black surfaces. Highest contrast, best for OLED screens.',
    swatch: ['#000000', '#121212', '#D4B45C'],
  },
  {
    id: 'light',
    label: 'Light — Clean & Bright',
    desc: 'White surfaces with a deepened gold for readability in daylight.',
    swatch: ['#F4F4F7', '#FFFFFF', '#7C5F0C'],
  },
  {
    id: 'slate',
    label: 'Slate — Softer Dark',
    desc: 'Warmer, lower-glare dark tones. Easier for long sessions.',
    swatch: ['#1D2333', '#2A3040', '#D2B463'],
  },
] as const

export type ThemeId = (typeof THEMES)[number]['id']
export const STORAGE_KEY = 've-theme'

export function applyTheme(id: string) {
  document.documentElement.setAttribute('data-theme', id)
}

export function useTheme() {
  const [theme, setThemeState] = useState<string>('light')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && THEMES.some(t => t.id === saved)) {
      setThemeState(saved)
      applyTheme(saved)
    }
  }, [])

  function setTheme(id: string) {
    setThemeState(id)
    localStorage.setItem(STORAGE_KEY, id)
    applyTheme(id)
  }

  return { theme, setTheme }
}
