import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RiGlobalLine, RiSearchLine, RiNewspaperLine, RiTimeLine } from 'react-icons/ri'
import { newsService } from '../services'

const NEWS_TABS = [
  { value: 'for-you', label: 'For you' },
  { value: 'headlines', label: 'Headlines' },
  { value: 'local', label: 'Local' },
  { value: 'nigeria', label: 'Nigeria' },
  { value: 'world', label: 'World' },
  { value: 'business', label: 'Business' },
  { value: 'technology', label: 'Technology' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'sports', label: 'Sports' },
  { value: 'science', label: 'Science' },
  { value: 'health', label: 'Health' },
]

const HUB_TABS = [
  { value: 'news', label: 'News' },
  { value: 'career', label: 'Career' },
  { value: 'unspoken', label: 'Unspoken' },
]

function timeAgo(value) {
  if (!value) return 'Today'
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff) || diff < 0) return 'Today'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${Math.max(minutes, 1)} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

function NewsCard({ article, featured = false, onOpen }) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(article)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(article)
      }}
      className={`cursor-pointer overflow-hidden rounded-xl transition-transform hover:-translate-y-1 ${featured ? 'p-0' : 'p-3'}`}
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {article.imageUrl && (
        <div className={`overflow-hidden ${featured ? 'aspect-[16/7]' : 'mb-3 aspect-video rounded-lg'}`}>
          <img src={article.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}
      <div className={featured ? 'p-4' : ''}>
        <div className="mb-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <RiNewspaperLine style={{ color: 'var(--color-primary)' }} />
          <span className="font-bold">{article.source || 'NendPlay News'}</span>
          <span>•</span>
          <RiTimeLine />
          <span>{timeAgo(article.publishedAt)}</span>
        </div>
        <h2 className={`${featured ? 'text-2xl md:text-3xl' : 'text-base'} font-black leading-tight`} style={{ color: 'var(--color-text)' }}>
          {article.header || article.title}
        </h2>
        {(article.subHeader || article.summary) && (
          <p className="mt-2 line-clamp-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {article.subHeader || article.summary}
          </p>
        )}
      </div>
    </article>
  )
}

export default function DailyNewsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [articles, setArticles] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const loadingMoreRef = useRef(false)
  const sentinelRef = useRef(null)
  const activeSection = searchParams.get('section') || 'news'
  const activeTab = searchParams.get('tab') || 'for-you'

  const params = useMemo(() => ({
    section: activeSection,
    tab: activeTab,
    search: searchParams.get('search') || undefined,
    country: 'Nigeria',
    page: Number(searchParams.get('page') || 1),
    limit: 18,
  }), [activeSection, activeTab, searchParams])

  useEffect(() => {
    loadNews(1, false)
  }, [activeSection, activeTab, searchParams.get('search')])

  const loadNews = async (page = 1, append = false) => {
    if (append && loadingMoreRef.current) return
    loadingMoreRef.current = append
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const res = await newsService.getDailyNews({ ...params, page })
      const payload = res.data?.data?.data || res.data?.data || {}
      setArticles((current) => append ? [...current, ...(payload.articles || [])] : (payload.articles || []))
      setPagination(payload.pagination || null)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }

  const loadNextPage = useCallback(() => {
    if (!pagination || loading || loadingMore || pagination.page >= pagination.pages) return
    loadNews((pagination.page || 1) + 1, true)
  }, [pagination, loading, loadingMore, params])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !pagination || pagination.page >= pagination.pages) return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadNextPage()
    }, { rootMargin: '450px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [loadNextPage, pagination])

  const openArticle = (article) => {
    if (article.kind === 'nendplay' || article._id) {
      navigate(`/news/${article._id || article.id}`)
      return
    }
    if (article.url) window.open(article.url, '_blank', 'noopener,noreferrer')
  }

  const submitSearch = (event) => {
    event.preventDefault()
    setSearchParams({ section: activeSection, tab: activeTab, ...(search.trim() ? { search: search.trim() } : {}) })
  }

  const featured = articles[0]
  const rest = articles.slice(1)

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'var(--color-primary)', color: '#fff' }}>
            <RiGlobalLine className="text-xl" />
          </div>
          <h1 className="font-display text-3xl font-black" style={{ color: 'var(--color-text)' }}>
            {HUB_TABS.find((tab) => tab.value === activeSection)?.label || 'News'} Globe
          </h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {activeSection === 'news'
              ? 'For you mixes every category, with NendPlay editorials shown first.'
              : 'Fresh NendPlay posts from the admin desk.'}
          </p>
        </div>
        <form onSubmit={submitSearch} className="relative w-full max-w-md">
          <RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            className="input-base py-2.5 pl-11 text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search news..."
          />
        </form>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {HUB_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSearchParams({ section: tab.value, tab: 'for-you', ...(search.trim() ? { search: search.trim() } : {}) })}
            className="whitespace-nowrap rounded-xl px-4 py-2 text-sm font-black"
            style={{
              background: activeSection === tab.value ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeSection === tab.value ? '#fff' : 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {NEWS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSearchParams({ section: activeSection, tab: tab.value, ...(search.trim() ? { search: search.trim() } : {}) })}
            className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-black"
            style={{
              background: activeTab === tab.value ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeTab === tab.value ? '#fff' : 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4">
          <div className="h-80 skeleton rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-56 skeleton rounded-2xl" />
            <div className="h-56 skeleton rounded-2xl" />
          </div>
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
          No news found.
        </div>
      ) : (
        <>
          {featured && <div className="mb-4"><NewsCard article={featured} featured onOpen={openArticle} /></div>}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rest.map((article, index) => (
              <NewsCard key={article._id || article.id || index} article={article} onOpen={openArticle} />
            ))}
          </div>
          <div ref={sentinelRef} className="mt-8 flex min-h-12 justify-center">
            {loadingMore && <span className="text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>Loading more news...</span>}
          </div>
        </>
      )}
    </div>
  )
}
