import React from 'react'
import { useNavigate } from 'react-router-dom'
import { RiPlayFill, RiLockFill, RiHeartLine, RiTimeLine } from 'react-icons/ri'

const formatDuration = (seconds) => {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}h ${m % 60}m`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

const TYPE_LABELS = {
  movie: 'Movie', video: 'Video', music: 'Music',
  tv_show: 'TV Show', comedy: 'Comedy', talk_show: 'Talk Show',
  podcast: 'Podcast', short: 'Short', live_event: '🔴 Live',
}

function isShortMedia(media) {
  const labels = [
    media.type,
    media.category,
    ...(media.categories || []),
    ...(media.navigationLabels || []),
    ...(media.homeSections || []),
  ].filter(Boolean).map((value) => String(value).toLowerCase())
  return media.type === 'short' || media.isShort || labels.includes('shorts') || labels.includes('short')
}

export default function MediaCard({ media, size = 'md' }) {
  const navigate = useNavigate()

  const sizes = {
    sm: 'w-36',
    md: 'w-48',
    lg: 'w-64',
    full: 'w-full',
  }

  const targetPath = isShortMedia(media)
    ? `/shorts?open=${media._id}`
    : `/watch/${media._id}`

  return (
    <div
      onClick={() => navigate(targetPath)}
      className={`${sizes[size]} flex-shrink-0 cursor-pointer group`}>

      {/* Thumbnail */}
      <div className="relative rounded-xl overflow-hidden mb-2"
        style={{ aspectRatio: '16/9', background: 'var(--color-surface)' }}>

        {media.thumbnailUrl ? (
          <img
            src={media.thumbnailUrl}
            alt={media.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-surface-high))' }}>
            <RiPlayFill className="text-4xl opacity-20" style={{ color: 'var(--color-primary)' }} />
          </div>
        )}

        {/* Overlay */}
        <div className="thumbnail-overlay" />

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-primary)', boxShadow: '0 4px 20px var(--glow-color)' }}>
            <RiPlayFill className="text-white text-xl ml-0.5" />
          </div>
        </div>

        {/* Lock badge */}
        {media.isLocked && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
            <RiLockFill className="text-xs text-yellow-400" />
          </div>
        )}

        {/* Live badge */}
        {media.isLive && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-xs font-bold text-white"
            style={{ background: '#EF4444' }}>
            LIVE
          </div>
        )}

        {/* Duration */}
        {media.duration > 0 && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-xs font-mono"
            style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
            {formatDuration(media.duration)}
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        <p className="font-medium text-sm truncate leading-tight"
          style={{ color: 'var(--color-text)' }}>
          {media.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {TYPE_LABELS[media.type] || media.type}
          </span>
          {media.likeCount > 0 && (
            <span className="text-xs flex items-center gap-0.5"
              style={{ color: 'var(--color-text-muted)' }}>
              <RiHeartLine className="text-xs" />
              {media.likeCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
