import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { RiPlayFill, RiUploadLine, RiBroadcastFill } from 'react-icons/ri'
import { useInView } from 'react-intersection-observer'
import toast from 'react-hot-toast'
import { mediaService, novelService } from '../services/index'
import MediaRow from '../components/media/MediaRow'
import GoogleAdSlot from '../components/ads/GoogleAdSlot'
import useAuthStore from '../stores/authStore'

const CATEGORY_LABELS = {
  movie: 'Movies',
  music: 'Music',
  tv_show: 'TV Shows',
  podcast: 'Podcasts',
  comedy: 'Comedy',
  talk_show: 'Talk Shows',
  short: 'Shorts',
}
const CATEGORY_ORDER = ['movie', 'music', 'tv_show', 'podcast', 'comedy', 'talk_show', 'short']
const HOME_TABS = ['FightZone', 'Trending', 'Movie', 'TV', 'Anime', 'ShortTV']
const HOME_PAGE_LIMIT = 40
const SEARCH_PAGE_LIMIT = 20

function getCategoryLabel(type) {
  if (!type) return 'Other'
  return CATEGORY_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function shuffleItems(items) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[randomIndex]
    shuffled[randomIndex] = current
  }
  return shuffled
}

function getSearchText(item) {
  return [
    item.title, item.description, item.type, item.category, item.genre,
    item.language, item.country, item.contentRating, item.releaseStatus,
    ...(item.tags || []), ...(item.homeSections || []),
  ].filter(Boolean).join(' ').toLowerCase()
}

function matchesAny(item, terms) {
  if (!terms?.length) return true
  const text = getSearchText(item)
  return terms.some((term) => text.includes(term))
}

function byPopularity(items) {
  return [...items].sort((a, b) => (
    ((b.viewCount || 0) * 3 + (b.likeCount || 0) * 2 + (b.commentCount || 0))
    - ((a.viewCount || 0) * 3 + (a.likeCount || 0) * 2 + (a.commentCount || 0))
  ))
}

function groupMedia(items) {
  const grouped = {}
  const typeOrder = [
    ...CATEGORY_ORDER,
    ...Array.from(new Set(items.map((m) => m.type).filter((type) => type && !CATEGORY_ORDER.includes(type)))),
  ]
  typeOrder.forEach((type) => {
    const typeItems = items.filter((m) => m.type === type)
    if (typeItems.length > 0) grouped[getCategoryLabel(type)] = typeItems
  })
  return grouped
}

export default function HomePage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('search')

  const navigateMedia = (media) => {
    if (media?.type === 'short') {
      navigate(`/shorts?open=${media._id}`)
      return
    }
    navigate(`/watch/${media._id}`)
  }

  const [sections, setSections] = useState({})
  const [liveEvents, setLiveEvents] = useState([])
  const [allMedia, setAllMedia] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [mediaPage, setMediaPage] = useState(1)
  const [hasMoreMedia, setHasMoreMedia] = useState(false)
  const [loadingMoreMedia, setLoadingMoreMedia] = useState(false)
  const [searchPage, setSearchPage] = useState(1)
  const [hasMoreSearch, setHasMoreSearch] = useState(false)
  const [loadingMoreSearch, setLoadingMoreSearch] = useState(false)
  const [featuredItems, setFeaturedItems] = useState([])
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const movieSectionRef = useRef(null)
  const firstSectionRef = useRef(null)
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({ rootMargin: '320px' })

  useEffect(() => {
    fetchContent(1, false)
  }, [searchQuery])

  useEffect(() => {
    if (!loadMoreInView || loading) return
    if (searchQuery) loadMoreSearch()
    else loadMoreHomeMedia()
  }, [loadMoreInView, loading, searchQuery, hasMoreMedia, hasMoreSearch, mediaPage, searchPage])

  useEffect(() => {
    if (featuredItems.length <= 1 || searchQuery) return undefined
    const timer = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % featuredItems.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [featuredItems.length, searchQuery])

  const fetchContent = async (pageToLoad = 1, append = false) => {
    if (!append) setLoading(true)
    try {
      if (searchQuery) {
        const res = await mediaService.getAll({
          search: searchQuery,
          limit: SEARCH_PAGE_LIMIT,
          page: pageToLoad,
        })
        const nextMedia = res.data.data.media || []
        const pagination = res.data.data.pagination || {}
        setSections((current) => ({
          'Search Results': append ? [...(current['Search Results'] || []), ...nextMedia] : nextMedia,
        }))
        setSearchPage(pageToLoad)
        setHasMoreSearch(pageToLoad < (pagination.pages || 1))
      } else {
        const [allRes, liveRes, novelRes] = await Promise.all([
          mediaService.getAll({ limit: HOME_PAGE_LIMIT, page: pageToLoad }),
          mediaService.getLiveEvents({ limit: 6 }),
          novelService.getAll({ limit: 12 }),
        ])

        const nextMedia = allRes.data.data.media || []
        const pagination = allRes.data.data.pagination || {}
        const mergedMedia = append ? [...allMedia, ...nextMedia] : nextMedia
        setAllMedia(mergedMedia)
        setMediaPage(pageToLoad)
        setHasMoreMedia(pageToLoad < (pagination.pages || 1))
        setDocuments(novelRes.data.data.documents || [])
        const movies = mergedMedia.filter((item) => item.type === 'movie')
        const featured = mergedMedia
          .filter((item) => item.isFeatured || item.homeSections?.includes('banner'))
          .sort((a, b) => (a.featuredRank || 0) - (b.featuredRank || 0))
        setFeaturedItems(featured.length ? featured : shuffleItems(movies.length ? movies : mergedMedia))
        setFeaturedIndex(0)

        setSections(groupMedia(mergedMedia))
        setLiveEvents(liveRes.data.data.media)
      }
    } catch (err) {
      toast.error('Failed to load content')
    } finally {
      setLoading(false)
      setLoadingMoreMedia(false)
      setLoadingMoreSearch(false)
    }
  }

  const loadMoreHomeMedia = () => {
    if (loading || loadingMoreMedia || !hasMoreMedia) return
    setLoadingMoreMedia(true)
    fetchContent(mediaPage + 1, true)
  }

  const loadMoreSearch = () => {
    if (loading || loadingMoreSearch || !hasMoreSearch) return
    setLoadingMoreSearch(true)
    fetchContent(searchPage + 1, true)
  }

  const openMovieCategory = () => {
    const target = movieSectionRef.current || firstSectionRef.current
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const movies = allMedia.filter((item) => item.type === 'movie')
  const series = allMedia.filter((item) => item.type === 'tv_show')
  const shorts = allMedia.filter((item) => item.type === 'short' || item.isShort)
  const comedy = allMedia.filter((item) => item.type === 'comedy' || matchesAny(item, ['funny', 'comedy', 'buzz']))
  const nollywood = movies.filter((item) => matchesAny(item, ['nollywood', 'nigeria', 'naija']))
  const anime = allMedia.filter((item) => matchesAny(item, ['anime', 'dubbed']))
  const kDrama = allMedia.filter((item) => matchesAny(item, ['k-drama', 'kdrama', 'korean', 'korea']))
  const actionMovies = movies.filter((item) => matchesAny(item, ['action']))
  const trending = byPopularity(allMedia)

  return (
    <div className="animate-fade-in">
      {!searchQuery && (
        <div className="mb-5 flex gap-7 overflow-x-auto no-scrollbar text-lg font-semibold">
          {HOME_TABS.map((tab, index) => (
            <span
              key={tab}
              style={{ color: index === 1 ? 'var(--color-text)' : 'var(--color-text-muted)' }}
              className={index === 1 ? 'font-black' : ''}
            >
              {tab}
            </span>
          ))}
        </div>
      )}

      {/* Hero Banner */}
      {!searchQuery && featuredItems.length > 0 && (
        <div className="relative rounded-2xl overflow-hidden mb-8"
          role="button"
          tabIndex={0}
          onClick={openMovieCategory}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') openMovieCategory()
          }}
          style={{ height: '380px', cursor: 'pointer' }}>
          <div
            className="flex h-full transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${featuredIndex * 100}%)` }}
          >
            {featuredItems.map((media) => (
              <div key={media._id} className="relative h-full w-full flex-shrink-0">
                {media.thumbnailUrl ? (
                  <img src={media.thumbnailUrl} alt={media.title}
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full"
                    style={{ background: 'var(--gradient-hero)' }} />
                )}
              </div>
            ))}
          </div>

          {/* Overlay */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.85) 40%, transparent 100%)' }} />

          {/* Glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to top, var(--color-bg) 0%, transparent 50%)' }} />

          <div className="absolute inset-0 flex flex-col justify-end p-8">
            <div className="max-w-lg">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white mb-3"
                style={{ background: 'var(--color-primary)' }}>
                Featured
              </span>
              <h1 className="font-display font-black text-4xl text-white mb-2 leading-tight">
                {featuredItems[featuredIndex]?.title}
              </h1>
              {featuredItems[featuredIndex]?.description && (
                <p className="text-sm text-white/70 mb-4 line-clamp-2 max-w-sm">
                  {featuredItems[featuredIndex].description}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    openMovieCategory()
                  }}
                  className="btn-primary flex items-center gap-2">
                  <RiPlayFill /> View Movies
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    openMovieCategory()
                  }}
                  className="btn-ghost text-white border-white/20">
                  Movie Category
                </button>
              </div>
            </div>
          </div>

          {featuredItems.length > 1 && (
            <div className="absolute bottom-6 right-8 flex items-center gap-2">
              {featuredItems.map((media, index) => (
                <button
                  key={media._id}
                  onClick={(event) => {
                    event.stopPropagation()
                    setFeaturedIndex(index)
                  }}
                  className={`h-2 rounded-full transition-all ${
                    index === featuredIndex ? 'w-6 bg-white' : 'w-2 bg-white/40'
                  }`}
                  aria-label={`Show ${media.title}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!searchQuery && (
        <div className="mb-8">
          <GoogleAdSlot />
        </div>
      )}

      {/* Search heading */}
      {searchQuery && (
        <div className="mb-6">
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--color-text)' }}>
            Results for "{searchQuery}"
          </h1>
        </div>
      )}

      {/* Quick actions */}
      {!searchQuery && (
        <div className="mb-8">
          <h2 className="font-display font-bold text-lg mb-4" style={{ color: 'var(--color-text)' }}>
            Categories
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { icon: RiPlayFill, label: 'All', action: () => {} },
              { icon: RiPlayFill, label: 'Hollywood', action: () => {} },
              { icon: RiPlayFill, label: 'Nollywood', action: openMovieCategory },
              { icon: RiPlayFill, label: 'Anime', action: () => {} },
              { icon: RiUploadLine, label: 'Upload Media', action: () => navigate('/profile') },
            ].map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                onClick={action}
                className="flex items-center gap-3 p-4 rounded-xl text-left transition-all hover:scale-105"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--color-surface-high)', color: 'var(--color-primary)' }}>
                  <Icon />
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!searchQuery && (
        <>
          <MediaRow title="Series Rankings" items={byPopularity(series.length ? series : trending).slice(0, 12)} size="md" />
          <div ref={movieSectionRef}>
            <MediaRow title="Movie Rankings" items={byPopularity(movies.length ? movies : trending).slice(0, 12)} size="md" />
          </div>
          <MediaRow title="BuzzBox - Short & Funny" items={(comedy.length ? comedy : shorts).slice(0, 12)} size="md" />
          {liveEvents.length > 0 && <MediaRow title="Upcoming Calendar" items={liveEvents} size="md" />}
          <MediaRow title="Nollywood Movie" items={(nollywood.length ? nollywood : movies).slice(0, 12)} size="md" />
          <div
            onClick={() => navigate('/novelhub')}
            className="mb-8 flex cursor-pointer items-center gap-6 rounded-xl p-6"
            style={{ background: '#063F32' }}
          >
            <div className="flex h-24 w-28 items-center justify-center rounded-lg bg-white/10 text-sm font-black text-white">Books</div>
            <div className="flex-1">
              <h2 className="text-3xl font-black text-white">NovelHub</h2>
              <p className="mt-1 text-white/70">
                {documents.length ? `${documents.length} books, offline and daily updated` : 'Offline, free and daily updated'}
              </p>
            </div>
            <span className="text-4xl text-white/70">›</span>
          </div>
          <MediaRow title="Fight Zone Shorts" items={shorts.slice(0, 12)} size="md" />
          <MediaRow title="Anime [English Dubbed]" items={anime.slice(0, 12)} size="md" />
          <MediaRow title="K-Drama" items={kDrama.slice(0, 12)} size="md" />
          <MediaRow title="Action" items={actionMovies.slice(0, 12)} size="md" />
          <MediaRow title="More to Watch" items={allMedia} size="md" />
        </>
      )}

      {/* Content rows */}
      {loading ? (
        <>
          <MediaRow title="" items={[]} loading={true} />
          <MediaRow title="" items={[]} loading={true} />
          <MediaRow title="" items={[]} loading={true} />
        </>
      ) : (
        Object.entries(sections).filter(([title]) => ![
          'Movies', 'TV Shows', 'Shorts', 'Comedy',
        ].includes(title)).map(([title, items], index) => (
          <div
            key={title}
            ref={(element) => {
              if (index === 0) firstSectionRef.current = element
            }}
          >
            <MediaRow title={title} items={items} size="md" />
          </div>
        ))
      )}

      {/* Empty state */}
      {!loading && Object.keys(sections).length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
            <RiPlayFill className="text-2xl" />
          </div>
          <p className="font-display font-bold text-xl mb-2" style={{ color: 'var(--color-text)' }}>
            {searchQuery ? 'No results found' : 'No content yet'}
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {searchQuery ? 'Try a different search term' : 'Be the first to upload content'}
          </p>
        </div>
      )}

      <div ref={loadMoreRef} className="flex items-center justify-center py-8">
        {(loadingMoreMedia || loadingMoreSearch) && (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        )}
      </div>
    </div>
  )
}
