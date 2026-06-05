// src/stores/themeStore.js
// Manages the active color theme.
// Theme is persisted to localStorage so it survives page refresh.

import { create } from 'zustand'

export const THEMES = [
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep purple dark',
    preview: ['#07071A', '#7C3AED', '#A78BFA'],
    isDark: true,
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Electric blue dark',
    preview: ['#020B18', '#0EA5E9', '#38BDF8'],
    isDark: true,
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Hot pink dark',
    preview: ['#080010', '#EC4899', '#F472B6'],
    isDark: true,
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Emerald dark',
    preview: ['#020F08', '#10B981', '#34D399'],
    isDark: true,
  },
  {
    id: 'solar',
    name: 'Solar',
    description: 'Warm amber light',
    preview: ['#FFFBF0', '#F59E0B', '#FBBF24'],
    isDark: false,
  },
  {
    id: 'arctic',
    name: 'Arctic',
    description: 'Cool indigo light',
    preview: ['#F0F4FF', '#6366F1', '#818CF8'],
    isDark: false,
  },
]

const getSavedTheme = () => {
  try {
    return localStorage.getItem('nendplay-theme') || 'midnight'
  } catch {
    return 'midnight'
  }
}

const applyTheme = (themeId) => {
  document.documentElement.setAttribute('data-theme', themeId)
  try {
    localStorage.setItem('nendplay-theme', themeId)
  } catch {}
}

const useThemeStore = create((set) => {
  const savedTheme = getSavedTheme()
  applyTheme(savedTheme)

  return {
    activeTheme: savedTheme,
    themes: THEMES,

    setTheme: (themeId) => {
      applyTheme(themeId)
      set({ activeTheme: themeId })
    },

    getActiveThemeData: () => {
      return THEMES.find((t) => t.id === savedTheme) || THEMES[0]
    },
  }
})

export default useThemeStore
