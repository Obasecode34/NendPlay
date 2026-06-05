import React from 'react'
import { useNavigate } from 'react-router-dom'
import { RiPlayFill, RiPauseFill, RiCloseFill, RiExpandDiagonalFill } from 'react-icons/ri'
import usePlayerStore from '../../stores/playerStore'

export default function MiniPlayer() {
  const navigate = useNavigate()
  const { currentMedia, isPlaying, progress, duration, isMiniPlayer,
    togglePlay, clearMedia, setProgress } = usePlayerStore()

  if (!currentMedia || !isMiniPlayer) return null

  const percent = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl overflow-hidden animate-slide-up"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>

      {/* Progress bar */}
      <div className="h-1 w-full" style={{ background: 'var(--color-surface-high)' }}>
        <div className="h-full transition-all duration-300"
          style={{ width: `${percent}%`, background: 'var(--color-primary)' }} />
      </div>

      <div className="flex items-center gap-3 p-3">
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
          style={{ background: 'var(--color-surface-high)' }}>
          {currentMedia.thumbnailUrl ? (
            <img src={currentMedia.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <RiPlayFill style={{ color: 'var(--color-primary)' }} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
            {currentMedia.title}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
            {currentMedia.type}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button onClick={togglePlay}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-primary)', color: 'white' }}>
            {isPlaying ? <RiPauseFill /> : <RiPlayFill className="ml-0.5" />}
          </button>

          <button onClick={() => navigate(`/watch/${currentMedia._id}`)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-muted)' }}>
            <RiExpandDiagonalFill className="text-sm" />
          </button>

          <button onClick={clearMedia}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--color-text-muted)' }}>
            <RiCloseFill className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  )
}
