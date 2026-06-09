import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { RiPlayFill, RiBroadcastFill } from 'react-icons/ri'
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
const HOME_TABS = ['Shorts', 'Trending', 'Movie', 'Anime', 'Cartoon', 'Sports', 'WWE']
const HOME_CATEGORIES = [
  { label: 'All', terms: [] },
  { label: 'Hollywood', terms: ['hollywood'] },
  { label: 'Nollywood', terms: ['nollywood', 'nigeria', 'naija'] },
  { label: 'Bollywood', terms: ['bollywood', 'india', 'hindi'] },
  { label: 'Western', terms: ['western', 'america', 'usa', 'united states'] },
  { label: 'K-Drama', terms: ['k-drama', 'kdrama', 'korean', 'korea'] },
  { label: 'Chinese Cinema', terms: ['chinese cinema', 'china', 'chinese', 'mandarin'] },
  { label: 'Hong Kong Cinema', terms: ['hong kong cinema', 'hong kong', 'cantonese'] },
  { label: 'Japanese Cinema', terms: ['japanese cinema', 'japan', 'japanese'] },
  { label: 'European Cinema', terms: ['european cinema', 'europe', 'british', 'french', 'german', 'italian', 'spanish'] },
]
const MOVIE_GENRES = [
  'Action', 'Adventure', 'Sports', 'Martial Arts', 'Comedy', 'Drama', 'Romance',
  'Horror', 'Mystery', 'Crime', 'Fantasy', 'Science Fiction', 'Animation',
  'Family', 'Musical', 'Documentary', 'War', 'Western', 'Biography', 'WWE',
]
const HOME_PAGE_LIMIT = 120
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
    item.parentTitle, item.episodeTitle, item.collectionType,
    item.language, item.country, item.contentRating, item.releaseStatus,
    ...(item.genres || []), ...(item.categories || []), ...(item.navigationLabels || []),
    ...(item.tags || []), ...(item.homeSections || []),
  ].filter(Boolean).join(' ').toLowerCase()
}

function getNormalizedLabels(item, fields) {
  return fields
    .flatMap((field) => {
      const value = item[field]
      return Array.isArray(value) ? value : [value]
    })
    .filter(Boolean)
    .map((value) => normalizeGenre(value))
}

function hasLabel(item, label, fields) {
  return getNormalizedLabels(item, fields).includes(normalizeGenre(label))
}

function matchesAny(item, terms) {
  if (!terms?.length) return true
  const text = getSearchText(item)
  return terms.some((term) => text.includes(term))
}

function isShortMedia(item) {
  const labels = [
    item.type,
    item.category,
    ...(item.categories || []),
    ...(item.navigationLabels || []),
    ...(item.homeSections || []),
  ].filter(Boolean).map((value) => String(value).toLowerCase())
  return item.type === 'short' || item.isShort || labels.includes('shorts') || labels.includes('short')
}

function matchesHomeTab(item, tab) {
  if (tab === 'Shorts') return isShortMedia(item)
  if (hasLabel(item, tab, ['navigationLabels', 'homeSections'])) return true
  if (tab === 'Movie') return item.type === 'movie'
  if (tab === 'Anime') return matchesAny(item, ['anime'])
  if (tab === 'Cartoon') return matchesAny(item, ['cartoon', 'animation', 'animated'])
  if (tab === 'Sports') return hasMovieGenre(item, 'Sports') || matchesAny(item, ['sports', 'sport', 'football', 'soccer', 'basketball', 'tennis', 'boxing', 'wrestling'])
  if (tab === 'WWE') return hasMovieGenre(item, 'WWE') || matchesAny(item, ['wwe', 'wrestling', 'wrestlemania', 'raw', 'smackdown'])
  return true
}

function normalizeGenre(value = '') {
  return String(value).trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()
}

function getMediaGenres(item) {
  const values = [
    ...(item.genres || []),
    ...String(item.genre || '').split(','),
  ]
  return values.map(normalizeGenre).filter(Boolean)
}

function hasMovieGenre(item, genre) {
  return getMediaGenres(item).includes(normalizeGenre(genre))
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
    if (isShortMedia(media)) {
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
  const [activeHomeTab, setActiveHomeTab] = useState('Trending')
  const [activeCategory, setActiveCategory] = useState(HOME_CATEGORIES[0])
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

  const tabMedia = allMedia.filter((item) => matchesHomeTab(item, activeHomeTab))
  const visibleMedia = tabMedia.filter((item) => (
    activeCategory.label === 'All'
    || hasLabel(item, activeCategory.label, ['category', 'categories'])
    || matchesAny(item, activeCategory.terms)
  ))
  const visibleSections = groupMedia(visibleMedia)
  const shorts = visibleMedia.filter(isShortMedia)
  const genreMovies = visibleMedia.filter((item) => !isShortMedia(item) && MOVIE_GENRES.some((genre) => hasMovieGenre(item, genre)))
  const genreSections = MOVIE_GENRES.map((genre) => ({
    genre,
    items: genreMovies.filter((item) => hasMovieGenre(item, genre)),
  })).filter((section) => section.items.length > 0)

  return (
    <div className="animate-fade-in">
      {!searchQuery && (
        <div className="mb-5 flex gap-7 overflow-x-auto no-scrollbar text-lg font-semibold">
          {HOME_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveHomeTab(tab)}
              style={{ color: activeHomeTab === tab ? 'var(--color-text)' : 'var(--color-text-muted)' }}
              className={`whitespace-nowrap ${activeHomeTab === tab ? 'font-black' : ''}`}
            >
              {tab}
            </button>
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
            {HOME_CATEGORIES.map((category) => (
              <button
                key={category.label}
                onClick={() => setActiveCategory(category)}
                className="flex items-center gap-3 p-4 rounded-xl text-left transition-all hover:scale-105"
                style={{
                  background: activeCategory.label === category.label ? 'var(--color-primary)' : 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: activeCategory.label === category.label ? 'rgba(255,255,255,0.16)' : 'var(--color-surface-high)',
                    color: activeCategory.label === category.label ? '#FFFFFF' : 'var(--color-primary)',
                  }}>
                  <RiPlayFill />
                </div>
                <span
                  className="text-sm font-medium"
                  style={{ color: activeCategory.label === category.label ? '#FFFFFF' : 'var(--color-text)' }}>
                  {category.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!searchQuery && (
        <>
          {activeHomeTab === 'Shorts' && (
            <>
              <MediaRow title="Shorts Videos" items={byPopularity(shorts).slice(0, 24)} size="md" />
              <MediaRow title="More Shorts" items={shorts} size="md" />
            </>
          )}
          {activeHomeTab !== 'Shorts' && (
            <>
              <div ref={movieSectionRef}>
                {genreSections.map((section, index) => (
                  <div key={section.genre} ref={(element) => {
                    if (index === 0) firstSectionRef.current = element
                  }}>
                    <MediaRow title={section.genre} items={byPopularity(section.items).slice(0, 24)} size="md" />
                  </div>
                ))}
              </div>
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
            </>
          )}
          {activeHomeTab !== 'Shorts' && genreSections.length === 0 && (
            <div className="mb-8 rounded-xl p-6 text-center" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
              No movies found with the selected category and approved genres.
            </div>
          )}
          {activeHomeTab === 'Shorts' && visibleMedia.length === 0 && (
            <div className="mb-8 rounded-xl p-6 text-center" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
              No media found for {activeCategory.label} Shorts.
            </div>
          )}
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
        searchQuery && Object.entries(sections).filter(([title]) => ![
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
