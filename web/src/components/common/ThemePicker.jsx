import React from 'react'
import { RiCloseFill, RiCheckFill } from 'react-icons/ri'
import useThemeStore, { THEMES } from '../../stores/themeStore'

export default function ThemePicker({ onClose }) {
  const { activeTheme, setTheme } = useThemeStore()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-6 animate-slide-up"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display font-bold text-xl" style={{ color: 'var(--color-text)' }}>
              Choose Theme
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Personalise your NendPlay experience
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: 'var(--color-surface-high)', color: 'var(--color-text-muted)' }}>
            <RiCloseFill className="text-lg" />
          </button>
        </div>

        {/* Dark themes */}
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--color-text-muted)' }}>
            Dark Themes
          </p>
          <div className="grid grid-cols-2 gap-3">
            {THEMES.filter(t => t.isDark).map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isActive={activeTheme === theme.id}
                onSelect={() => setTheme(theme.id)}
              />
            ))}
          </div>
        </div>

        {/* Light themes */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--color-text-muted)' }}>
            Light Themes
          </p>
          <div className="grid grid-cols-2 gap-3">
            {THEMES.filter(t => !t.isDark).map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isActive={activeTheme === theme.id}
                onSelect={() => setTheme(theme.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ThemeCard({ theme, isActive, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="relative p-3 rounded-xl text-left transition-all duration-200"
      style={{
        background: theme.preview[0],
        border: isActive ? `2px solid ${theme.preview[1]}` : '2px solid transparent',
        boxShadow: isActive ? `0 0 20px ${theme.preview[1]}44` : 'none',
      }}>

      {/* Color swatches */}
      <div className="flex gap-1.5 mb-2">
        {theme.preview.map((color, i) => (
          <div key={i} className="w-5 h-5 rounded-full"
            style={{ background: color, border: '1px solid rgba(255,255,255,0.2)' }} />
        ))}
      </div>

      <p className="text-xs font-bold" style={{ color: theme.preview[2] }}>
        {theme.name}
      </p>
      <p className="text-xs opacity-60" style={{ color: theme.preview[2] }}>
        {theme.description}
      </p>

      {/* Active checkmark */}
      {isActive && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: theme.preview[1] }}>
          <RiCheckFill className="text-white text-xs" />
        </div>
      )}
    </button>
  )
}
