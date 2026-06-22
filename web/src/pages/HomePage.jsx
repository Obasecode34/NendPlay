import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  RiAddLine,
  RiBookOpenLine,
  RiBroadcastLine,
  RiGiftLine,
  RiGlobalLine,
  RiMovie2Line,
  RiMusic2Line,
  RiNewspaperLine,
  RiPlayFill,
  RiTv2Line,
  RiVideoLine,
} from 'react-icons/ri'
import { useInView } from 'react-intersection-observer'
import toast from 'react-hot-toast'
import { mediaService, novelService } from '../services/index'
import MediaRow from '../components/media/MediaRow'
import GoogleAdSlot from '../components/ads/GoogleAdSlot'

const HOME_TABS = [
  { label: 'All', icon: RiGlobalLine },
  { label: 'Movies', icon: RiMovie2Line },
  { label: 'Series', icon: RiTv2Line },
  { label: 'Shorts', icon: RiVideoLine },
  { label: 'Live', icon: RiBroadcastLine },
  { label: 'News', icon: RiNewspaperLine, route: '/news' },
  { label: 'NovelHub', icon: RiBookOpenLine, route: '/novelhub' },
  { label: 'Music', icon: RiMusic2Line },
]

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
  { label: 'Australian Cinema', terms: ['australian cinema', 'australia', 'australian', 'aussie'] },
  { label: 'Philippine Cinema', terms: ['philippine cinema', 'philippines', 'philippine', 'filipino', 'tagalog'] },
  { label: 'European Cinema', terms: ['european cinema', 'europe', 'british', 'french', 'german', 'italian', 'spanish'] },
]

const MOVIE_GENRES = [
  'Action', 'Adventure', 'Sports', 'Martial Arts', 'Comedy', 'Drama', 'Romance',
  'Horror', 'Mystery', 'Crime', 'Fantasy', 'Science Fiction', 'Animation',
  'Family', 'Musical', 'Documentary', 'War', 'Western', 'Biography', 'WWE',
]

const HOME_PAGE_LIMIT = 120
const SEARCH_PAGE_LIMIT = 20

function normalizeGenre(value = '') {
  return String(value).trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()
}

function hashText(value = '') {
  return String(value).split('').reduce((hash, char) => (
    ((hash << 5) - hash + char.charCodeAt(0)) | 0
  ), 0)
}

function seededRandom(seed) {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function shuffleItems(items, seed = Date.now()) {
  const shuffled = [...items]
  const random = seededRandom(Math.abs(seed) + 1)
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1))
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

function getMediaGenres(item) {
  return [
    ...(item.genres || []),
    ...String(item.genre || '').split(','),
  ].map(normalizeGenre).filter(Boolean)
}

function hasMovieGenre(item, genre) {
  return getMediaGenres(item).includes(normalizeGenre(genre))
}

function matchesHomeTab(item, tab) {
  if (tab === 'All') return true
  if (tab === 'Shorts') return isShortMedia(item)
  if (hasLabel(item, tab, ['navigationLabels', 'homeSections'])) return true
  if (tab === 'Movies') return item.type === 'movie'
  if (tab === 'Series') return ['series', 'tv_show'].includes(item.type) || item.collectionType === 'series'
  if (tab === 'Live') return item.isLive || item.type === 'live'
  if (tab === 'Music') return ['music', 'audio'].includes(item.type)
  return true
}

function getGenrePinPosition(item, genre) {
  const pins = item.genrePins || {}
  const key = normalizeGenre(genre)
  const value = pins instanceof Map ? pins.get(key) : pins[key]
  const position = Number(value)
  return Number.isInteger(position) && position >= 1 && position <= 4 ? position : null
}

function orderGenreItems(items, genre, seed) {
  const pinned = []
  const unpinned = []
  items.forEach((item) => {
    const pinPosition = getGenrePinPosition(item, genre)
    if (pinPosition) pinned.push({ item, pinPosition })
    else unpinned.push(item)
  })

  return [
    ...pinned
      .sort((a, b) => a.pinPosition - b.pinPosition || (a.item.featuredRank || 0) - (b.item.featuredRank || 0))
      .map(({ item }) => item),
    ...shuffleItems(unpinned, seed + hashText(genre)),
  ]
}

function byPopularity(items) {
  return [...items].sort((a, b) => (
    ((b.viewCount || 0) * 3 + (b.likeCount || 0) * 2 + (b.commentCount || 0))
    - ((a.viewCount || 0) * 3 + (a.likeCount || 0) * 2 + (a.commentCount || 0))
  ))
}

function getMediaImage(item) {
  return item.thumbnailUrl || item.thumbnail || item.posterUrl || item.coverUrl || item.imageUrl || ''
}

function displayTitle(item) {
  return item.title || item.name || 'Untitled'
}

function SectionHeader({ title, accent, onSeeAll }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-lg font-black text-white sm:text-xl">
        {title} {accent && <span>{accent}</span>}
      </h2>
      {onSeeAll && (
        <button
          type="button"
          onClick={onSeeAll}
          className="text-sm font-semibold text-white/70 transition-colors hover:text-white"
        >
          See All
        </button>
      )}
    </div>
  )
}

function ImageFallback({ title, className = '' }) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-950 via-neutral-950 to-amber-950 p-4 text-center text-sm font-black uppercase tracking-wide text-white/80 ${className}`}
    >
      {title}
    </div>
  )
}

function LandscapeCard({ item, onClick, progress }) {
  const image = getMediaImage(item)
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="group w-[250px] flex-none overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] text-left transition-transform hover:-translate-y-1 sm:w-[290px]"
    >
      <div className="relative aspect-video overflow-hidden">
        {image ? (
          <img src={image} alt={displayTitle(item)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <ImageFallback title={displayTitle(item)} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
          <RiPlayFill />
        </span>
        {typeof progress === 'number' && (
          <div className="absolute bottom-0 left-3 right-3 h-1 rounded-full bg-white/20">
            <div className="h-full rounded-full bg-purple-500" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-1 text-sm font-bold text-white">{displayTitle(item)}</p>
        <p className="mt-1 text-xs text-white/55">{item.type || 'Media'} {progress ? `- ${progress}%` : ''}</p>
      </div>
    </button>
  )
}

function PosterCard({ item, onClick }) {
  const image = getMediaImage(item)
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="group w-[150px] flex-none text-left sm:w-[170px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
        {image ? (
          <img src={image} alt={displayTitle(item)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <ImageFallback title={displayTitle(item)} />
        )}
        <div className="absolute inset-x-0 bottom-0 p-2">
          <span className="rounded bg-black/65 px-2 py-1 text-[10px] font-bold capitalize text-white/90">
            {item.type || 'Movie'}
          </span>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-white">{displayTitle(item)}</p>
    </button>
  )
}

function LiveCard({ item, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="group w-[260px] flex-none overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] text-left sm:w-[300px]"
    >
      <div className="relative aspect-video">
        {getMediaImage(item) ? (
          <img src={getMediaImage(item)} alt={displayTitle(item)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <ImageFallback title={displayTitle(item)} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="line-clamp-2 text-sm font-black uppercase text-white">{displayTitle(item)}</p>
          <p className="mt-1 text-xs text-white/75"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />{item.viewerCount || item.viewCount || 'Live'} watching</p>
        </div>
      </div>
    </button>
  )
}

function NovelCard({ item, onClick }) {
  const image = item.coverImage || item.coverUrl || item.thumbnailUrl || ''
  return (
    <button type="button" onClick={onClick} className="w-[150px] flex-none text-left sm:w-[170px]">
      <div className="aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
        {image ? <img src={image} alt={item.title} className="h-full w-full object-cover" /> : <ImageFallback title={item.title || 'NovelHub'} />}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-bold text-white">{item.title || 'NovelHub book'}</p>
      <p className="mt-1 line-clamp-1 text-xs text-white/55">{item.author || item.genre || 'NovelHub'}</p>
    </button>
  )
}

function NewsMiniCard({ title, label, image }) {
  return (
    <button type="button" className="flex w-[260px] flex-none gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left transition-colors hover:bg-white/[0.08]">
      <div className="h-16 w-20 flex-none overflow-hidden rounded-lg bg-white/10">
        {image ? <img src={image} alt={title} className="h-full w-full object-cover" /> : <ImageFallback title="" />}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-bold text-white">{title}</p>
        <p className="mt-1 text-xs text-white/55">{label}</p>
      </div>
    </button>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('search')

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
  const [shuffleSeed, setShuffleSeed] = useState(Date.now())
  const [activeHomeTab, setActiveHomeTab] = useState('All')
  const [activeCategory, setActiveCategory] = useState(HOME_CATEGORIES[0])
  const movieSectionRef = useRef(null)
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({ rootMargin: '320px' })

  const navigateMedia = (media) => {
    if (isShortMedia(media)) navigate(`/shorts?open=${media._id}`)
    else navigate(`/watch/${media._id}`)
  }

  const fetchContent = async (pageToLoad = 1, append = false) => {
    if (!append) setLoading(true)
    try {
      if (searchQuery) {
        const res = await mediaService.getAll({ search: searchQuery, limit: SEARCH_PAGE_LIMIT, page: pageToLoad })
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
          mediaService.getLiveEvents({ limit: 8 }),
          novelService.getAll({ limit: 12 }),
        ])
        const nextMedia = allRes.data.data.media || []
        const pagination = allRes.data.data.pagination || {}
        const mergedMedia = append ? [...allMedia, ...nextMedia] : nextMedia
        const featured = mergedMedia
          .filter((item) => item.isFeatured || item.homeSections?.includes('banner'))
          .sort((a, b) => (a.featuredRank || 0) - (b.featuredRank || 0))

        setAllMedia(mergedMedia)
        setMediaPage(pageToLoad)
        setHasMoreMedia(pageToLoad < (pagination.pages || 1))
        setDocuments(novelRes.data.data.documents || [])
        setFeaturedItems(featured.length ? featured : shuffleItems(mergedMedia.filter((item) => !isShortMedia(item)), Date.now()))
        setFeaturedIndex(0)
        setSections({ Home: mergedMedia })
        setLiveEvents(liveRes.data.data.media || [])
        if (!append) setShuffleSeed(Date.now())
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

  useEffect(() => {
    if (searchQuery) return undefined
    const timer = setInterval(() => setShuffleSeed(Date.now()), 120000)
    return () => clearInterval(timer)
  }, [searchQuery])

  const tabMedia = useMemo(() => allMedia.filter((item) => matchesHomeTab(item, activeHomeTab)), [allMedia, activeHomeTab])
  const visibleMedia = useMemo(() => tabMedia.filter((item) => (
    activeCategory.label === 'All'
    || hasLabel(item, activeCategory.label, ['category', 'categories'])
    || matchesAny(item, activeCategory.terms)
  )), [tabMedia, activeCategory])

  const rankedMedia = useMemo(() => byPopularity(visibleMedia), [visibleMedia])
  const shorts = useMemo(() => byPopularity(visibleMedia.filter(isShortMedia)), [visibleMedia])
  const genreMovies = useMemo(() => visibleMedia.filter((item) => !isShortMedia(item) && MOVIE_GENRES.some((genre) => hasMovieGenre(item, genre))), [visibleMedia])
  const genreSections = useMemo(() => MOVIE_GENRES.map((genre) => ({
    genre,
    items: orderGenreItems(genreMovies.filter((item) => hasMovieGenre(item, genre)), genre, shuffleSeed),
  })).filter((section) => section.items.length > 0), [genreMovies, shuffleSeed])

  const continueWatching = rankedMedia.slice(0, 6)
  const trendingMedia = rankedMedia.filter((item) => !isShortMedia(item)).slice(0, 16)
  const liveSectionItems = liveEvents.length ? liveEvents : rankedMedia.filter((item) => item.isLive || item.type === 'live').slice(0, 8)
  const musicItems = allMedia.filter((item) => ['music', 'audio'].includes(item.type)).slice(0, 12)
  const hero = featuredItems[featuredIndex] || rankedMedia[0]
  const heroImage = hero ? getMediaImage(hero) : ''
  const newsHighlights = [
    ['Global Leaders Meet for Peace Summit', '2h ago'],
    ['Tech Innovation Changing the World', '5h ago'],
    ['Sports Update: Local Team Wins Again', '1h ago'],
    ['Economy Shows Signs of Recovery', '3h ago'],
  ]

  const openTab = (tab) => {
    if (tab.route) {
      navigate(tab.route)
      return
    }
    setActiveHomeTab(tab.label)
  }

  if (searchQuery) {
    return (
      <div className="animate-fade-in pb-20">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-white">Results for "{searchQuery}"</h1>
        </div>
        {loading ? (
          <>
            <MediaRow title="" items={[]} loading />
            <MediaRow title="" items={[]} loading />
          </>
        ) : (
          Object.entries(sections).map(([title, items]) => (
            <MediaRow key={title} title={title} items={items} size="md" />
          ))
        )}
        {!loading && Object.keys(sections).length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-2xl text-white/50">
              <RiPlayFill />
            </div>
            <p className="mb-2 text-xl font-bold text-white">No results found</p>
            <p className="text-sm text-white/55">Try a different search term</p>
          </div>
        )}
        <div ref={loadMoreRef} className="flex items-center justify-center py-8">
          {loadingMoreSearch && <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />}
        </div>
      </div>
    )
  }

  return (
    <div className="relative animate-fade-in pb-24">
      <div className="mb-5 flex gap-3 overflow-x-auto no-scrollbar">
        {HOME_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeHomeTab === tab.label
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => openTab(tab)}
              className={`flex flex-none items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                isActive ? 'border-purple-500 bg-purple-600 text-white shadow-lg shadow-purple-900/30' : 'border-white/10 bg-black/30 text-white hover:bg-white/10'
              }`}
            >
              <Icon className="text-base" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {hero && (
        <section className="relative mb-7 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
          <button
            type="button"
            onClick={() => navigateMedia(hero)}
            className="block h-[310px] w-full text-left md:h-[390px]"
          >
            {heroImage ? (
              <img src={heroImage} alt={displayTitle(hero)} className="h-full w-full object-cover" />
            ) : (
              <ImageFallback title={displayTitle(hero)} />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/55 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 to-transparent" />
            <div className="absolute left-5 top-5 rounded-md border border-white/35 px-2 py-1 text-xs font-bold text-white md:right-5 md:left-auto">
              {hero.contentRating || 'PG-13'}
            </div>
            <div className="absolute bottom-8 left-6 max-w-xl md:left-10">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-purple-300">NendPlay Exclusive</p>
              <h1 className="mb-3 line-clamp-2 text-4xl font-black uppercase leading-none text-white md:text-6xl">
                {displayTitle(hero)}
              </h1>
              <p className="mb-5 line-clamp-2 max-w-md text-sm font-semibold text-white/85 md:text-base">
                {hero.description || 'Stream premium movies, shows, shorts, music, news, and stories.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-black text-white">
                  <RiPlayFill /> Watch Now
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur">
                  <RiAddLine /> My List
                </span>
              </div>
            </div>
          </button>
          {featuredItems.length > 1 && (
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3">
              {featuredItems.slice(0, 6).map((item, index) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => setFeaturedIndex(index)}
                  className={`h-3 rounded-full transition-all ${index === featuredIndex ? 'w-3 bg-purple-500' : 'w-3 bg-white/70'}`}
                  aria-label={`Show ${displayTitle(item)}`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mb-7">
        <SectionHeader title="Continue Watching" onSeeAll={() => movieSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} />
        <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
          {continueWatching.map((item, index) => (
            <LandscapeCard key={item._id} item={item} onClick={navigateMedia} progress={[65, 40, 78, 30, 55, 82][index % 6]} />
          ))}
        </div>
      </section>

      <section className="mb-7">
        <SectionHeader title="Trending Now" accent="🔥" onSeeAll={() => movieSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} />
        <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
          {trendingMedia.map((item) => <PosterCard key={item._id} item={item} onClick={navigateMedia} />)}
        </div>
      </section>

      <div className="mb-7">
        <GoogleAdSlot placement="home" />
      </div>

      {liveSectionItems.length > 0 && (
        <section className="mb-7">
          <SectionHeader title="Live Events" accent={<span className="text-sm text-red-500">● LIVE</span>} onSeeAll={() => setActiveHomeTab('Live')} />
          <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
            {liveSectionItems.map((item) => <LiveCard key={item._id} item={item} onClick={navigateMedia} />)}
          </div>
        </section>
      )}

      {documents.length > 0 && (
        <section className="mb-7">
          <SectionHeader title="NovelHub" accent="📖" onSeeAll={() => navigate('/novelhub')} />
          <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
            {documents.map((item) => <NovelCard key={item._id} item={item} onClick={() => navigate('/novelhub')} />)}
          </div>
        </section>
      )}

      <section className="mb-7">
        <SectionHeader title="News Highlights" onSeeAll={() => navigate('/news')} />
        <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
          {newsHighlights.map(([title, label]) => <NewsMiniCard key={title} title={title} label={label} />)}
        </div>
      </section>

      {musicItems.length > 0 && (
        <section className="mb-7">
          <SectionHeader title="Music For You" onSeeAll={() => setActiveHomeTab('Music')} />
          <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
            {musicItems.map((item) => <LandscapeCard key={item._id} item={item} onClick={navigateMedia} />)}
          </div>
        </section>
      )}

      {shorts.length > 0 && (
        <section className="mb-7">
          <SectionHeader title="Shorts" onSeeAll={() => navigate('/shorts')} />
          <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
            {shorts.slice(0, 18).map((item) => <PosterCard key={item._id} item={item} onClick={navigateMedia} />)}
          </div>
        </section>
      )}

      <div ref={movieSectionRef}>
        {genreSections.map((section) => (
          <section key={section.genre} className="mb-7">
            <SectionHeader title={section.genre} onSeeAll={() => setActiveCategory(HOME_CATEGORIES[0])} />
            <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
              {section.items.slice(0, 18).map((item) => <PosterCard key={item._id} item={item} onClick={navigateMedia} />)}
            </div>
          </section>
        ))}
      </div>

      <section className="mb-7 overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-900 via-purple-700 to-purple-950 p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl text-white">
              <RiGiftLine />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Go Premium Today!</h2>
              <p className="mt-1 max-w-xl text-white/80">Unlock unlimited access to all content and enjoy an ad-free experience.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/subscribe')}
            className="rounded-xl bg-purple-500 px-6 py-4 text-sm font-black text-white shadow-lg shadow-purple-950/40"
          >
            Subscribe Now
          </button>
        </div>
      </section>

      {!loading && visibleMedia.length === 0 && (
        <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.04] p-6 text-center text-white/60">
          No media found for the selected tab and category.
        </div>
      )}

      {loading && (
        <>
          <MediaRow title="" items={[]} loading />
          <MediaRow title="" items={[]} loading />
        </>
      )}

      <div ref={loadMoreRef} className="flex items-center justify-center py-8">
        {loadingMoreMedia && <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />}
      </div>

      <button
        type="button"
        onClick={() => navigate('/news')}
        className="fixed bottom-8 right-8 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-2xl shadow-purple-950/40 transition-transform hover:scale-105"
        aria-label="Open news"
      >
        <RiNewspaperLine className="text-2xl" />
        <span className="absolute right-1 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-red-500" />
      </button>
    </div>
  )
}
