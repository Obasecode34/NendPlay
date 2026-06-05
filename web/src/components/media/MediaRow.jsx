import React, { useRef } from 'react'
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri'
import MediaCard from './MediaCard'

export default function MediaRow({ title, items = [], size = 'md', loading = false }) {
  const scrollRef = useRef(null)

  const scroll = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' })
    }
  }

  if (loading) {
    return (
      <div className="mb-8">
        <div className="h-6 w-48 skeleton rounded-lg mb-4" />
        <div className="flex gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-48">
              <div className="skeleton rounded-xl mb-2" style={{ aspectRatio: '16/9' }} />
              <div className="h-4 skeleton rounded mb-1" />
              <div className="h-3 w-20 skeleton rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!items.length) return null

  return (
    <div className="mb-8 group/row">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--color-text)' }}>
          {title}
        </h2>
        <div className="flex gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <button onClick={() => scroll(-1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
            <RiArrowLeftSLine />
          </button>
          <button onClick={() => scroll(1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
            <RiArrowRightSLine />
          </button>
        </div>
      </div>

      <div ref={scrollRef}
        className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
        {items.map((item) => (
          <MediaCard key={item._id} media={item} size={size} />
        ))}
      </div>
    </div>
  )
}
